import { NextRequest, NextResponse } from "next/server";
import { makeMove } from "@server/game/chess-game-service";
import { handleRequest } from "@server/api/handle-request";
import { RequestResponse } from "@/services/longPollingService";
import { isAuthTokenProvided } from "@server/auth/auths";
import { createError } from "@server/response/error";

export const POST = handleRequest<RequestResponse>(PostHandler);

async function PostHandler(request: NextRequest) {
    const authHeader = isAuthTokenProvided(request);

    const token = authHeader.split(" ")[1];

    const moveData = await request.json();
    const { from, to, promotion } = moveData;

    if (!from || !to) {
        throw createError("Bad Request: Missing required move data", 400);
    }

    const result = await makeMove(token, from, to, promotion);

    // Handle move result
    if (!result.success) {
        return NextResponse.json(
            {
                success: false,
                error: result.error,
                isGameOver: result.isGameOver,
                gameResult: result.gameResult,
            },
            { status: result.isGameOver ? 200 : 400 }
        );
    }

    return NextResponse.json({
        success: true,
        newFen: result.newFen,
        isGameOver: result.isGameOver,
        gameResult: result.gameResult,
        newToken: result.newToken,
    });
}
