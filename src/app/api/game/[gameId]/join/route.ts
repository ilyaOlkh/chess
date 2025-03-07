import { NextRequest, NextResponse } from "next/server";
import { getGame, PlayerColor } from "@/lib/redis/redis-setup";
import {
    verifyPlayerToken,
    generatePlayerJoinToken,
    generateSpectatorToken,
} from "@/lib/auth/player-auth";
import { updateGame } from "@/lib/redis/redis-setup";
import { Chess } from "chess.js";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    try {
        const { gameId } = await params;

        // Получаем данные игры из Redis
        const game = await getGame(gameId);

        if (!game) {
            return NextResponse.json(
                { error: "Game not found" },
                { status: 404 }
            );
        }

        // Проверяем, если получен JWT токен в заголовке
        const authHeader = request.headers.get("Authorization");
        let playerToken = null;
        let tokenData = null;

        if (authHeader && authHeader.startsWith("Bearer ")) {
            playerToken = authHeader.split(" ")[1];
            tokenData = verifyPlayerToken(playerToken);
        }

        // Также проверяем, есть ли токен в теле запроса
        const requestBody = await request.json().catch(() => ({}));
        if (!playerToken && requestBody.token) {
            playerToken = requestBody.token;
            tokenData = verifyPlayerToken(playerToken);
        }

        const chess = new Chess(game.currentFen);
        const currentTurn = chess.turn() === "w" ? "white" : "black";
        const isPlayerTurn =
            tokenData?.playerRole !== "spectator" &&
            tokenData?.playerColor === currentTurn;

        // Если есть валидный токен - проверяем на соответствие
        if (tokenData && tokenData.gameId === gameId) {
            // Токен валиден для этой игры - возвращаем текущую роль
            return NextResponse.json({
                fenPosition: game.currentFen,
                success: true,
                playerToken: playerToken,
                playerRole: tokenData.playerRole,
                playerColor: tokenData.playerColor,
                playerId: tokenData.playerId,
                gameStatus: game.status,
                playerTurn: isPlayerTurn,
                opponentConnected:
                    tokenData.playerRole === "first"
                        ? game.secondPlayerId !== null
                        : game.firstPlayerId !== null,
            });
        }

        // Если нет валидного токена или токен для другой игры - определяем роль

        // Проверяем статус игры
        if (game.status !== "waiting" && game.status !== "active") {
            // Игра завершена - разрешаем только наблюдатель
            const spectatorToken = generateSpectatorToken(gameId);

            return NextResponse.json({
                success: true,
                playerToken: spectatorToken,
                playerRole: "spectator",
                playerColor: null,
                gameStatus: game.status,
            });
        }

        if (
            game.status === "active" &&
            (tokenData?.playerId === game.firstPlayerId ||
                tokenData?.playerId === game.secondPlayerId)
        ) {
            return NextResponse.json({
                success: true,
                playerToken: playerToken,
                playerRole: tokenData?.playerRole,
                playerColor: tokenData?.playerColor,
                playerId: tokenData?.playerId,
                gameStatus: "active",
            });
        }

        // Если нет первого игрока (это не должно происходить, но на всякий случай)
        if (!game.firstPlayerId) {
            // Генерируем UUID для первого игрока
            const firstPlayerId = crypto.randomUUID();

            // Обновляем игру
            await updateGame(gameId, {
                firstPlayerId,
                status: "waiting",
            });

            // Создаем токен для первого игрока
            const firstPlayerToken = generatePlayerJoinToken(
                gameId,
                true,
                game.timeControl,
                game.firstPlayerColor,
                firstPlayerId
            );

            return NextResponse.json({
                success: true,
                playerToken: firstPlayerToken,
                playerRole: "first",
                playerColor: game.firstPlayerColor,
                playerId: firstPlayerId,
                gameStatus: "waiting",
                opponentConnected: false,
            });
        }

        // Если нет второго игрока и игра в ожидании
        if (!game.secondPlayerId && game.status === "waiting") {
            // Генерируем UUID для второго игрока
            const secondPlayerId = crypto.randomUUID();

            // Обновляем игру
            await updateGame(gameId, {
                secondPlayerId,
                status: "active",
            });

            // Определяем цвет второго игрока (противоположный первому)
            const secondPlayerColor: PlayerColor =
                game.firstPlayerColor === "white" ? "black" : "white";

            // Создаем токен для второго игрока
            const secondPlayerToken = generatePlayerJoinToken(
                gameId,
                false,
                game.timeControl,
                game.firstPlayerColor,
                secondPlayerId
            );

            return NextResponse.json({
                success: true,
                playerToken: secondPlayerToken,
                playerRole: "second",
                playerColor: secondPlayerColor,
                playerId: secondPlayerId,
                gameStatus: "active",
                opponentConnected: true,
            });
        }

        // Если все роли заняты - назначаем наблюдателя
        const spectatorToken = generateSpectatorToken(gameId);

        return NextResponse.json({
            success: true,
            playerToken: spectatorToken,
            playerRole: "spectator",
            playerColor: null,
            gameStatus: game.status,
            opponentConnected: true,
        });
    } catch (error) {
        console.error("Error joining game:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}
