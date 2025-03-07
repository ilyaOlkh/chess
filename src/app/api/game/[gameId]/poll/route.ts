import { NextRequest, NextResponse } from "next/server";
import {
    verifyPlayerToken,
    hasMoveTimeExpired,
    updatePlayerTokenTimestamp,
    updatePlayerTimeAndTimestamp,
} from "@/lib/auth/player-auth";
import {
    getGame,
    getLatestTurn,
    GameStatus,
    Winner,
} from "@/lib/redis/redis-setup";
import {
    waitForGameEvent,
    getEventsSince,
    GameEvent,
} from "@/lib/redis/redis-pubsub";
import { Chess } from "chess.js";

// Long polling timeout in milliseconds
const LONG_POLL_TIMEOUT = 30 * 1000;

// State interface for event processing
interface GameState {
    currentFen: string;
    gameStatus: GameStatus;
    winner: Winner;
    lastMove?: {
        from: string;
        to: string;
        promotion?: string | null;
    };
}

// Process missed event and extract relevant data
function processMissedEvent(event: GameEvent, state: GameState): void {
    switch (event.type) {
        case "move_made": {
            const data = event.data as {
                from: string;
                to: string;
                promotion?: string | null;
                fen: string;
            };
            state.lastMove = {
                from: data.from,
                to: data.to,
                promotion: data.promotion,
            };
            state.currentFen = data.fen;
            break;
        }
        case "game_status_changed": {
            const data = event.data as {
                status: string;
                winner: string | null;
            };
            state.gameStatus = data.status as GameStatus;
            state.winner = data.winner as Winner;
            break;
        }
        case "player_joined": {
            // Usually no state change needed
            break;
        }
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    // Get gameId from route parameters
    const { gameId } = await params;

    try {
        // Check authorization
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Unauthorized: No valid token provided" },
                { status: 401 }
            );
        }

        // Get and verify token
        const token = authHeader.split(" ")[1];
        const tokenData = verifyPlayerToken(token);

        if (!tokenData) {
            return NextResponse.json(
                { error: "Unauthorized: Invalid token" },
                { status: 401 }
            );
        }

        // Check if token matches requested game
        if (tokenData.gameId !== gameId) {
            return NextResponse.json(
                { error: "Unauthorized: Token does not match game ID" },
                { status: 401 }
            );
        }

        // Check if move time has expired
        if (tokenData.playerRole !== "spectator" && hasMoveTimeExpired(token)) {
            // Player lost due to time expiration
            return NextResponse.json({
                success: false,
                gameStatus: "completed",
                error: "Your time has expired",
                winner: tokenData.playerColor === "white" ? "black" : "white",
            });
        }

        // Get initial game state
        let game = await getGame(gameId);
        if (!game) {
            return NextResponse.json(
                { error: "Game not found" },
                { status: 404 }
            );
        }

        // If game is already completed, just return final state
        if (game.status === "completed" || game.status === "aborted") {
            return NextResponse.json({
                success: true,
                gameStatus: game.status,
                fenPosition: game.currentFen,
                winner: game.winner,
                playerTurn: false,
                opponentConnected: true,
            });
        }

        // Determine if opponent is connected
        const opponentConnected =
            tokenData.playerRole === "first"
                ? game.secondPlayerId !== null
                : tokenData.playerRole === "second"
                ? game.firstPlayerId !== null
                : game.firstPlayerId !== null && game.secondPlayerId !== null;

        // Determine current turn based on FEN
        const chess = new Chess(game.currentFen);
        const currentTurn = chess.turn() === "w" ? "white" : "black";

        // Determine if it's player's turn
        const isPlayerTurn =
            tokenData.playerRole !== "spectator" &&
            tokenData.playerColor === currentTurn;

        // Check for missed events
        const lastClientEventTimestamp = tokenData.lastEventTimestamp || 0;
        const missedEvents = await getEventsSince(
            gameId,
            lastClientEventTimestamp
        );

        if (missedEvents.length > 0) {
            // Initialize state with current game data
            const state: GameState = {
                currentFen: game.currentFen,
                gameStatus: game.status,
                winner: game.winner,
            };

            // Process each missed event to build up the state
            missedEvents.forEach((event) => {
                processMissedEvent(event, state);
            });

            // Get the latest timestamp from the missed events
            const latestEventTimestamp =
                missedEvents[missedEvents.length - 1].timestamp;

            // Get the latest turn information
            const latestTurn = await getLatestTurn(gameId);

            // If we have a move in state from missed events, use that
            // Otherwise, use the latest turn from the database
            const lastMove =
                state.lastMove ||
                (latestTurn
                    ? {
                          from: latestTurn.from,
                          to: latestTurn.to,
                          promotion: latestTurn.promotionPiece,
                      }
                    : null);

            // Check for checkmate, stalemate, etc. based on current FEN
            const currentChess = new Chess(state.currentFen);
            const currentChessTurn =
                currentChess.turn() === "w" ? "white" : "black";

            // Determine if it's the player's turn based on processed events
            const updatedIsPlayerTurn =
                tokenData.playerRole !== "spectator" &&
                tokenData.playerColor === currentChessTurn;

            const isCheckmate = currentChess.isCheckmate();
            const isDraw = currentChess.isDraw();

            // Create a new token with updated timestamp
            let newToken;
            if (updatedIsPlayerTurn && tokenData.moveTimeRemaining !== null) {
                newToken = updatePlayerTimeAndTimestamp(
                    token,
                    game.timeControl,
                    latestEventTimestamp
                );
            } else {
                newToken = updatePlayerTokenTimestamp(
                    token,
                    latestEventTimestamp
                );
            }

            return NextResponse.json({
                success: true,
                gameStatus: state.gameStatus,
                fenPosition: state.currentFen,
                lastMove,
                playerTurn: updatedIsPlayerTurn,
                checkmate: isCheckmate,
                draw: isDraw,
                winner: state.winner,
                newToken,
                opponentConnected: true,
                missedEvents: missedEvents.map((e) => ({
                    type: e.type,
                    timestamp: e.timestamp,
                })),
            });
        }

        // Wait for new event using Redis Pub/Sub
        const event = await waitForGameEvent(gameId, LONG_POLL_TIMEOUT);

        if (event) {
            // Reload game data after event
            game = await getGame(gameId);
            if (!game) {
                return NextResponse.json(
                    { error: "Game no longer exists" },
                    { status: 404 }
                );
            }

            // Process different event types
            switch (event.type) {
                case "player_joined": {
                    // Player joined
                    const newOpponentConnected =
                        tokenData.playerRole === "first";

                    // Update token with new timestamp
                    const newToken = updatePlayerTokenTimestamp(
                        token,
                        event.timestamp
                    );

                    return NextResponse.json({
                        success: true,
                        gameStatus: game.status,
                        fenPosition: game.currentFen,
                        opponentConnected: newOpponentConnected,
                        playerTurn: isPlayerTurn,
                        newToken,
                        events: [
                            {
                                type: event.type,
                                timestamp: event.timestamp,
                                data: event.data,
                            },
                        ],
                    });
                }

                case "move_made": {
                    // Move was made
                    const moveData = event.data as {
                        from: string;
                        to: string;
                        promotion?: string;
                        color: string;
                        fen: string;
                    };

                    // Update chess logic with new position
                    const newChess = new Chess(game.currentFen);
                    const newCurrentTurn =
                        newChess.turn() === "w" ? "white" : "black";

                    // Determine if it's player's turn now
                    const newIsPlayerTurn =
                        tokenData.playerRole !== "spectator" &&
                        tokenData.playerColor === newCurrentTurn;

                    // Check for checkmate, stalemate, etc.
                    const isCheckmate = newChess.isCheckmate();
                    const isDraw = newChess.isDraw();

                    // If it's now player's turn, update time in token
                    let newToken;
                    if (
                        newIsPlayerTurn &&
                        tokenData.moveTimeRemaining !== null
                    ) {
                        // Update both move time and event timestamp
                        newToken = updatePlayerTimeAndTimestamp(
                            token,
                            game.timeControl,
                            event.timestamp
                        );
                    } else {
                        // Just update event timestamp
                        newToken = updatePlayerTokenTimestamp(
                            token,
                            event.timestamp
                        );
                    }

                    return NextResponse.json({
                        success: true,
                        gameStatus: game.status,
                        fenPosition: game.currentFen,
                        lastMove: {
                            from: moveData.from,
                            to: moveData.to,
                            promotion: moveData.promotion,
                        },
                        playerTurn: newIsPlayerTurn,
                        checkmate: isCheckmate,
                        draw: isDraw,
                        newToken,
                        opponentConnected: true,
                        events: [
                            {
                                type: event.type,
                                timestamp: event.timestamp,
                                data: {
                                    from: moveData.from,
                                    to: moveData.to,
                                    promotion: moveData.promotion,
                                    color: moveData.color,
                                },
                            },
                        ],
                    });
                }

                case "game_status_changed": {
                    // Game status changed
                    const statusData = event.data as {
                        status: string;
                        winner: string | null;
                    };

                    // Update token with new timestamp
                    const newToken = updatePlayerTokenTimestamp(
                        token,
                        event.timestamp
                    );

                    return NextResponse.json({
                        success: true,
                        gameStatus: statusData.status,
                        fenPosition: game.currentFen,
                        playerTurn: isPlayerTurn,
                        winner: statusData.winner,
                        opponentConnected: true,
                        newToken,
                        events: [
                            {
                                type: event.type,
                                timestamp: event.timestamp,
                                data: {
                                    status: statusData.status,
                                    winner: statusData.winner,
                                },
                            },
                        ],
                    });
                }

                default: {
                    // Unknown event type, return current state
                    // Update token with new timestamp
                    const newToken = updatePlayerTokenTimestamp(
                        token,
                        event.timestamp
                    );

                    return NextResponse.json({
                        success: true,
                        gameStatus: game.status,
                        fenPosition: game.currentFen,
                        playerTurn: isPlayerTurn,
                        opponentConnected,
                        newToken,
                        events: [
                            {
                                type: event.type,
                                timestamp: event.timestamp,
                            },
                        ],
                    });
                }
            }
        }

        // If no event received within timeout, return current state
        return NextResponse.json({
            success: true,
            gameStatus: game.status,
            fenPosition: game.currentFen,
            playerTurn: isPlayerTurn,
            opponentConnected,
        });
    } catch (error) {
        console.error(`Error in long polling for game ${gameId}:`, error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
