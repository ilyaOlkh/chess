import { NextRequest, NextResponse } from "next/server";
import { makeMove } from "@/lib/game/chess-game-service";

export async function POST(request: NextRequest) {
    try {
        // Get the Authorization header
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Unauthorized: No valid token provided" },
                { status: 401 }
            );
        }

        const token = authHeader.split(" ")[1];

        // Parse the move data from the request body
        const moveData = await request.json();
        const { from, to, promotion } = moveData;

        if (!from || !to) {
            return NextResponse.json(
                { error: "Bad Request: Missing required move data" },
                { status: 400 }
            );
        }

        // Make the move using the game service
        const result = await makeMove(token, from, to, promotion || null);

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

        // Move was successful
        return NextResponse.json({
            success: true,
            newFen: result.newFen,
            isGameOver: result.isGameOver,
            gameResult: result.gameResult,
            newToken: result.newToken,
        });
    } catch (error) {
        console.error("Error making move:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
