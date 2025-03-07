import { NextRequest, NextResponse } from "next/server";
import { createNewGame } from "@/lib/game/chess-game-service";

export async function POST(request: NextRequest) {
    try {
        // Парсим тело запроса
        const body = await request.json().catch(() => ({}));
        const timeControl = body.timeControl || 300; // По умолчанию 5 минут

        // Создаем новую игру
        const result = await createNewGame(timeControl);

        if (!result.gameId || !result.playerToken) {
            return NextResponse.json(
                { error: "Failed to create game" },
                { status: 500 }
            );
        }

        // Возвращаем идентификатор игры, токен игрока и ID игрока
        return NextResponse.json({
            success: true,
            gameId: result.gameId,
            playerToken: result.playerToken,
            playerId: result.playerId,
        });
    } catch (error) {
        console.error("Error creating game:", error);
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
