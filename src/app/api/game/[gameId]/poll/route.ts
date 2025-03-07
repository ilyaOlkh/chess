import { NextRequest, NextResponse } from "next/server";
import {
    verifyPlayerToken,
    updatePlayerMoveTime,
    hasMoveTimeExpired,
} from "@/lib/auth/player-auth";
import { getGame, getLatestTurn } from "@/lib/redis/redis-setup";
import { waitForGameEvent } from "@/lib/redis/redis-pubsub";
import { Chess } from "chess.js";

// Таймаут для long polling запроса
const LONG_POLL_TIMEOUT = 30 * 1000;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    // Получаем gameId из параметров маршрута
    const { gameId } = await params;
    console.log(`Long polling request for game ${gameId}`);

    try {
        // Проверяем авторизацию
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Unauthorized: No valid token provided" },
                { status: 401 }
            );
        }

        // Получаем и проверяем токен
        const token = authHeader.split(" ")[1];
        const tokenData = verifyPlayerToken(token);

        if (!tokenData) {
            return NextResponse.json(
                { error: "Unauthorized: Invalid token" },
                { status: 401 }
            );
        }

        // Проверяем, что токен соответствует запрошенной игре
        if (tokenData.gameId !== gameId) {
            return NextResponse.json(
                { error: "Unauthorized: Token does not match game ID" },
                { status: 401 }
            );
        }

        // Проверяем, истекло ли время хода
        if (tokenData.playerRole !== "spectator" && hasMoveTimeExpired(token)) {
            // Игрок проиграл из-за истечения времени
            return NextResponse.json({
                success: false,
                gameStatus: "completed",
                error: "Your time has expired",
                winner: tokenData.playerColor === "white" ? "black" : "white",
            });
        }

        // Получаем начальное состояние игры
        let game = await getGame(gameId);
        if (!game) {
            return NextResponse.json(
                { error: "Game not found" },
                { status: 404 }
            );
        }

        // Если игра уже завершена, просто возвращаем финальное состояние
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

        // Определяем, подключен ли оппонент
        const opponentConnected =
            tokenData.playerRole === "first"
                ? game.secondPlayerId !== null
                : tokenData.playerRole === "second"
                ? game.firstPlayerId !== null
                : game.firstPlayerId !== null && game.secondPlayerId !== null;

        // Определяем текущий ход на основе FEN
        const chess = new Chess(game.currentFen);
        const currentTurn = chess.turn() === "w" ? "white" : "black";

        // Определяем, ход ли игрока
        const isPlayerTurn =
            tokenData.playerRole !== "spectator" &&
            tokenData.playerColor === currentTurn;

        // Ждем событие с использованием Redis Pub/Sub
        const event = await waitForGameEvent(gameId, LONG_POLL_TIMEOUT);

        if (event) {
            console.log(`Received event for game ${gameId}:`, event);

            // Перезагружаем данные игры после события
            game = await getGame(gameId);
            if (!game) {
                return NextResponse.json(
                    { error: "Game no longer exists" },
                    { status: 404 }
                );
            }

            // Обрабатываем разные типы событий
            switch (event.type) {
                case "player_joined": {
                    // Игрок присоединился
                    const newOpponentConnected =
                        tokenData.playerRole === "first";

                    return NextResponse.json({
                        success: true,
                        gameStatus: game.status,
                        fenPosition: game.currentFen,
                        opponentConnected: newOpponentConnected,
                        playerTurn: isPlayerTurn,
                    });
                }

                case "move_made": {
                    // Был сделан ход
                    // Обновляем шахматную логику с новой позицией
                    const newChess = new Chess(game.currentFen);
                    const newCurrentTurn =
                        newChess.turn() === "w" ? "white" : "black";

                    // Получаем данные последнего хода
                    const latestTurn = await getLatestTurn(gameId);

                    // Определяем, ход ли игрока теперь
                    const newIsPlayerTurn =
                        tokenData.playerRole !== "spectator" &&
                        tokenData.playerColor === newCurrentTurn;

                    // Проверяем шах, мат и пат
                    const isCheckmate = newChess.isCheckmate();
                    const isDraw = newChess.isDraw();

                    // Если теперь ход игрока, обновляем время в его токене
                    let newToken = null;
                    if (
                        newIsPlayerTurn &&
                        tokenData.moveTimeRemaining !== null
                    ) {
                        newToken = updatePlayerMoveTime(
                            token,
                            game.timeControl
                        );
                    }

                    return NextResponse.json({
                        success: true,
                        gameStatus: game.status,
                        fenPosition: game.currentFen,
                        lastMove: latestTurn
                            ? {
                                  from: latestTurn.from,
                                  to: latestTurn.to,
                                  promotion: latestTurn.promotionPiece,
                              }
                            : null,
                        playerTurn: newIsPlayerTurn,
                        checkmate: isCheckmate,
                        draw: isDraw,
                        newToken: newToken,
                        opponentConnected: true,
                    });
                }

                case "game_status_changed": {
                    // Статус игры изменился
                    return NextResponse.json({
                        success: true,
                        gameStatus: game.status,
                        fenPosition: game.currentFen,
                        playerTurn: isPlayerTurn,
                        winner: game.winner,
                        opponentConnected: true,
                    });
                }

                default: {
                    // Неизвестный тип события, возвращаем текущее состояние
                    return NextResponse.json({
                        success: true,
                        gameStatus: game.status,
                        fenPosition: game.currentFen,
                        playerTurn: isPlayerTurn,
                        opponentConnected,
                    });
                }
            }
        }

        // Если не получили событие за время таймаута, возвращаем текущее состояние
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
