import { NextRequest, NextResponse } from "next/server";
import { getGame, PlayerColor } from "@/lib/redis/redis-setup";
import {
    verifyPlayerToken,
    generatePlayerJoinToken,
    generateSpectatorToken,
} from "@/lib/auth/player-auth";
import { updateGame } from "@/lib/redis/redis-setup";
import { isPlayerTurn } from "@server/game/chess-game-service";
import { handleRequest, RouteParams } from "@server/api/handle-request";
import { RequestResponse } from "@/services/longPollingService";
import { createError } from "@server/response/error";
import { playerRoles } from "@/constants/online-game";

export const POST = handleRequest<RequestResponse>(postHandler);

async function postHandler(request: NextRequest, { params }: RouteParams) {
    const { gameId } = await params;
    const game = await getGame(gameId);

    if (!game) throw createError("Game not found", 404);

    const authHeader = request.headers.get("Authorization");
    let playerToken;
    let tokenData;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        playerToken = authHeader.split(" ")[1];
        tokenData = verifyPlayerToken(playerToken);
    }

    const requestBody = await request.json().catch(() => ({}));
    if (!playerToken && requestBody.token) {
        playerToken = requestBody.token;
        tokenData = verifyPlayerToken(playerToken);
    }

    if (tokenData && tokenData.gameId === gameId) {
        return NextResponse.json({
            fenPosition: game.currentFen,
            success: true,
            playerToken: playerToken,
            playerRole: tokenData.playerRole,
            playerColor: tokenData.playerColor,
            playerId: tokenData.playerId,
            gameStatus: game.status,
            playerTurn: isPlayerTurn(game.currentFen, tokenData),
            opponentConnected:
                tokenData.playerRole === playerRoles.first
                    ? !!game.secondPlayerId
                    : !!game.firstPlayerId,
        });
    }

    if (game.status !== "waiting" && game.status !== "active") {
        const spectatorToken = generateSpectatorToken(gameId);

        return NextResponse.json({
            fenPosition: game.currentFen,
            success: true,
            playerToken: spectatorToken,
            playerRole: playerRoles.spectator,
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

    if (!game.firstPlayerId) {
        const firstPlayerId = crypto.randomUUID();

        await updateGame(gameId, {
            firstPlayerId,
            status: "waiting",
        });

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
            playerRole: playerRoles.first,
            playerColor: game.firstPlayerColor,
            playerId: firstPlayerId,
            gameStatus: "waiting",
            opponentConnected: false,
        });
    }

    if (!game.secondPlayerId && game.status === "waiting") {
        const secondPlayerId = crypto.randomUUID();

        await updateGame(gameId, {
            secondPlayerId,
            status: "active",
        });

        const secondPlayerColor: PlayerColor =
            game.firstPlayerColor === "white" ? "black" : "white";

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
            playerRole: playerRoles.second,
            playerColor: secondPlayerColor,
            playerId: secondPlayerId,
            gameStatus: "active",
            opponentConnected: true,
        });
    }

    const spectatorToken = generateSpectatorToken(gameId);

    return NextResponse.json({
        fenPosition: game.currentFen,
        success: true,
        playerToken: spectatorToken,
        playerRole: playerRoles.spectator,
        gameStatus: game.status,
        opponentConnected: true,
    });
}
