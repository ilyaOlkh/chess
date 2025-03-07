import { NextRequest, NextResponse } from "next/server";
import { spectateGame } from "@/lib/game/chess-game-service";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    try {
        const gameId = (await params).gameId;

        // Attempt to spectate the game
        const result = await spectateGame(gameId);

        if (!result.spectatorToken) {
            return NextResponse.json(
                { error: result.error || "Failed to spectate game" },
                { status: 400 }
            );
        }

        // Successfully joined as spectator
        return NextResponse.json({
            success: true,
            spectatorToken: result.spectatorToken,
        });
    } catch (error) {
        console.error("Error spectating game:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
