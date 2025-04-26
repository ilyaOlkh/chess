import { NextRequest, NextResponse } from "next/server";
import { spectateGame } from "@server/game/chess-game-service";
import { handleRequest, RouteParams } from "@server/api/handle-request";
import { RequestResponse } from "@/services/longPollingService";

export const POST = handleRequest<RequestResponse>(PostHandler);

async function PostHandler(request: NextRequest, { params }: RouteParams) {
    try {
        const gameId = (await params).gameId;

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
