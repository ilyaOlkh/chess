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
    TurnData,
} from "@/lib/redis/redis-setup";
import {
    waitForGameEvent,
    getEventsSince,
    GameEvent,
} from "@/lib/redis/redis-pubsub";
import { Chess } from "chess.js";
import { isAuthTokenProvided } from "@server/auth/auths";
import { handleRequest, RouteParams } from "@server/api/handle-request";
import { RequestResponse } from "@/services/longPollingService";
import { ErrorResponse } from "@server/response/error";

const LONG_POLL_TIMEOUT = 30 * 1000;

interface GameState {
    currentFen: string;
    gameStatus: GameStatus;
    winner?: Winner;
    lastMove?: TurnData;
}

function processMissedEvent(event: GameEvent, state: GameState): void {
    switch (event.type) {
        case "move_made": {
            const data = event.data as TurnData;
            state.lastMove = data;
            state.currentFen = data.currentFen;
            break;
        }
        case "game_status_changed": {
            const data = event.data as {
                status: string;
                winner?: string;
            };
            state.gameStatus = data.status as GameStatus;
            state.winner = data.winner as Winner;
            break;
        }
        case "player_joined": {
            break;
        }
    }
}

export const GET = handleRequest<RequestResponse>(getHandler);

async function getHandler(
    request: NextRequest,
    { params }: RouteParams
): Promise<NextResponse<RequestResponse | ErrorResponse>> {
    const { gameId } = await params;

    try {
        const authHeader = isAuthTokenProvided(request);

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

            missedEvents.forEach((event) => {
                processMissedEvent(event, state);
            });

            // Get the latest timestamp from the missed events
            const latestEventTimestamp =
                missedEvents[missedEvents.length - 1].timestamp;

            // Get the latest turn information
            const latestTurn = await getLatestTurn(gameId);

            const lastMove = state.lastMove || latestTurn;

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

            const response: RequestResponse = {
                success: true,
                gameStatus: state.gameStatus,
                fenPosition: state.currentFen,
                lastMove: lastMove,
                playerTurn: updatedIsPlayerTurn,
                checkmate: isCheckmate,
                draw: isDraw,
                winner: state.winner,
                newToken,
                opponentConnected: true,
                missedEvents: missedEvents,
            };

            return NextResponse.json(response);
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
                    const moveData = event.data as TurnData;

                    const newChess = new Chess(game.currentFen);
                    const newCurrentTurn =
                        newChess.turn() === "w" ? "white" : "black";

                    const newIsPlayerTurn =
                        tokenData.playerRole !== "spectator" &&
                        tokenData.playerColor === newCurrentTurn;

                    const isCheckmate = newChess.isCheckmate();
                    const isDraw = newChess.isDraw();

                    let newToken;
                    if (
                        newIsPlayerTurn &&
                        tokenData.moveTimeRemaining !== null
                    ) {
                        newToken = updatePlayerTimeAndTimestamp(
                            token,
                            game.timeControl,
                            event.timestamp
                        );
                    } else {
                        newToken = updatePlayerTokenTimestamp(
                            token,
                            event.timestamp
                        );
                    }

                    return NextResponse.json({
                        success: true,
                        gameStatus: game.status,
                        fenPosition: game.currentFen,
                        lastMove: moveData,
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
                    const statusData = event.data as {
                        status: string;
                        winner?: string;
                    };

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
