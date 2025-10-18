import { NextRequest, NextResponse } from "next/server";
import {
    hasMoveTimeExpired,
    updatePlayerTokenTimestamp,
    updatePlayerTimeAndTimestamp,
    PlayerTokenPayload,
} from "@/lib/auth/player-auth";
import {
    getGame,
    getLatestTurn,
    GameStatus,
    Winner,
    TurnData,
    GameData,
    getPlayerRemainingTimes,
} from "@/lib/redis/redis-setup";
import {
    waitForGameEvent,
    getEventsSince,
    GameEvent,
} from "@/lib/redis/redis-pubsub";
import { Chess } from "chess.js";
import { getToken, isGameIdValid } from "@server/auth/auths";
import { handleRequest, RouteParams } from "@server/api/handle-request";
import { RequestResponse } from "@/services/longPollingService";
import { createError, ErrorResponse } from "@server/response/error";
import { isPlayerTurn } from "@server/game/chess-game-service";
import { gameEventTypes, playerRoles } from "@/constants/online-game";

const LONG_POLL_TIMEOUT = 30 * 1000;

interface GameState {
    currentFen: string;
    gameStatus: GameStatus;
    winner?: Winner;
    lastMove?: TurnData;
}

interface ProcessEventData {
    game: GameData;
    tokenData: PlayerTokenPayload;
    event: GameEvent;
}

function processMissedEvent(event: GameEvent, state: GameState): void {
    switch (event.type) {
        case gameEventTypes.move_made: {
            const data = event.data as TurnData;
            state.lastMove = data;
            state.currentFen = data.currentFen;
            break;
        }
        case gameEventTypes.game_status_changed: {
            const data = event.data as {
                status: string;
                winner?: string;
            };
            state.gameStatus = data.status as GameStatus;
            state.winner = data.winner as Winner;
            break;
        }
        case gameEventTypes.player_joined: {
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

    const tokenData = isGameIdValid(request, gameId);

    if (
        tokenData.playerRole !== playerRoles.spectator &&
        hasMoveTimeExpired(tokenData)
    ) {
        return NextResponse.json({
            success: false,
            gameStatus: "completed",
            error: "Your time has expired",
            winner: tokenData.playerColor === "white" ? "black" : "white",
        });
    }

    let game = await getGame(gameId);
    if (!game) {
        throw createError("Game not found", 404);
    }

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

    const opponentConnected =
        tokenData.playerRole === playerRoles.first
            ? !!game.secondPlayerId
            : tokenData.playerRole === playerRoles.second
            ? !!game.firstPlayerId
            : !!game.firstPlayerId && !!game.secondPlayerId;

    const missedEvents = await getEventsSince(
        gameId,
        tokenData.lastEventTimestamp || 0
    );

    if (missedEvents.length > 0) {
        const state: GameState = {
            currentFen: game.currentFen,
            gameStatus: game.status,
            winner: game.winner,
        };

        missedEvents.forEach((event) => {
            processMissedEvent(event, state);
        });

        const currentChess = new Chess(state.currentFen);
        const updatedIsPlayerTurn = isPlayerTurn(state.currentFen, tokenData);
        const isCheckmate = currentChess.isCheckmate();
        const isDraw = currentChess.isDraw();

        let newToken;

        if (updatedIsPlayerTurn) {
            newToken = await updatePlayerTimeAndTimestamp(
                tokenData,
                missedEvents[missedEvents.length - 1].timestamp
            );
        } else {
            newToken = await updatePlayerTokenTimestamp(
                tokenData,
                missedEvents[missedEvents.length - 1].timestamp
            );
        }

        const response: RequestResponse = {
            success: true,
            gameStatus: state.gameStatus,
            fenPosition: state.currentFen,
            lastMove: state.lastMove || (await getLatestTurn(gameId)),
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

    const event = await waitForGameEvent(gameId, LONG_POLL_TIMEOUT);

    if (event) {
        game = await getGame(gameId);
        if (!game) {
            throw createError("Game no longer exists", 404);
        }

        const processEventData: ProcessEventData = {
            game,
            tokenData,
            event,
        };

        switch (event.type) {
            case gameEventTypes.player_joined: {
                return await processPlayerJoinedEvent(processEventData);
            }

            case gameEventTypes.move_made: {
                return await processMoveMadeEvent(processEventData);
            }

            case gameEventTypes.game_status_changed: {
                return await processGameStatusChangedEvent(processEventData);
            }

            default: {
                const newToken = await updatePlayerTokenTimestamp(
                    tokenData,
                    event.timestamp
                );

                return NextResponse.json({
                    success: true,
                    gameStatus: game.status,
                    fenPosition: game.currentFen,
                    playerTurn: isPlayerTurn(game.currentFen, tokenData),
                    opponentConnected: opponentConnected,
                    newToken: newToken,
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

    return NextResponse.json({
        success: true,
        playerToken: getToken(request),
        gameStatus: game.status,
        fenPosition: game.currentFen,
        playerTurn: isPlayerTurn(game.currentFen, tokenData),
        opponentConnected,
    });
}

async function processPlayerJoinedEvent(processEventData: ProcessEventData) {
    const newOpponentConnected =
        processEventData.tokenData.playerRole === playerRoles.first;

    const newToken = await updatePlayerTokenTimestamp(
        processEventData.tokenData,
        processEventData.event.timestamp
    );

    const playerTimes = await getPlayerRemainingTimes(processEventData.game.id);

    return NextResponse.json({
        success: true,
        gameStatus: processEventData.game.status,
        fenPosition: processEventData.game.currentFen,
        opponentConnected: newOpponentConnected,
        playerTurn: isPlayerTurn(
            processEventData.game.currentFen,
            processEventData.tokenData
        ),
        newToken,
        playerTimes: playerTimes,
        events: [
            {
                type: processEventData.event.type,
                timestamp: processEventData.event.timestamp,
                data: processEventData.event.data,
            },
        ],
    });
}

async function processMoveMadeEvent(processEventData: ProcessEventData) {
    const moveData = processEventData.event.data as TurnData;
    const newChess = new Chess(processEventData.game.currentFen);
    const newCurrentTurn = newChess.turn() === "w" ? "white" : "black";
    const newIsPlayerTurn =
        processEventData.tokenData.playerRole !== playerRoles.spectator &&
        processEventData.tokenData.playerColor === newCurrentTurn;
    const isCheckmate = newChess.isCheckmate();
    const isDraw = newChess.isDraw();

    let newToken;

    if (newIsPlayerTurn) {
        newToken = await updatePlayerTimeAndTimestamp(
            processEventData.tokenData,
            processEventData.event.timestamp
        );
    } else {
        newToken = await updatePlayerTokenTimestamp(
            processEventData.tokenData,
            processEventData.event.timestamp
        );
    }

    const playerTimes = await getPlayerRemainingTimes(processEventData.game.id);

    return NextResponse.json({
        success: true,
        gameStatus: processEventData.game.status,
        fenPosition: processEventData.game.currentFen,
        lastMove: moveData,
        playerTurn: newIsPlayerTurn,
        checkmate: isCheckmate,
        draw: isDraw,
        newToken,
        opponentConnected: true,
        playerTimes: playerTimes,
        events: [
            {
                type: processEventData.event.type,
                timestamp: processEventData.event.timestamp,
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

async function processGameStatusChangedEvent(
    processEventData: ProcessEventData
) {
    const statusData = processEventData.event.data as {
        status: string;
        winner?: string;
    };
    const newToken = await updatePlayerTokenTimestamp(
        processEventData.tokenData,
        processEventData.event.timestamp
    );

    const playerTimes = await getPlayerRemainingTimes(processEventData.game.id);

    return NextResponse.json({
        success: true,
        gameStatus: statusData.status,
        fenPosition: processEventData.game.currentFen,
        playerTurn: isPlayerTurn(
            processEventData.game.currentFen,
            processEventData.tokenData
        ),
        winner: statusData.winner,
        opponentConnected: true,
        newToken,
        playerTimes: playerTimes,
        events: [
            {
                type: processEventData.event.type,
                timestamp: processEventData.event.timestamp,
                data: {
                    status: statusData.status,
                    winner: statusData.winner,
                },
            },
        ],
    });
}
