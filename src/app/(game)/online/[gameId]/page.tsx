"use client";

import { useEffect, useState } from "react";
import ChessBoard from "@/components/chess/ChessBoard";
import { Button } from "@/components/shadcn/Button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/shadcn/Card";
import { MoveData } from "@/types/chess-board";
import { onlineGameText } from "@/constants/online-game";
import { chessGameText } from "@/constants/chess-game";

type GameStatus = "waiting" | "active" | "completed" | "aborted";
type PlayerColor = "white" | "black";
type PlayerRole = "first" | "second" | "spectator";

interface OnlineGameState {
    status: GameStatus;
    playerColor: PlayerColor | null;
    playerRole: PlayerRole;
    opponentConnected: boolean;
    lastMoveTime: number | null;
}

export default function OnlineGame() {
    const [gameState, setGameState] = useState<OnlineGameState>({
        status: "waiting",
        playerColor: "white",
        playerRole: "first",
        opponentConnected: false,
        lastMoveTime: null,
    });

    const [showCopied, setShowCopied] = useState(false);

    const handleMove = (moveData: MoveData) => {
        console.log("Move made:", moveData);

        if (gameState.status === "waiting") {
            setGameState((prev) => ({
                ...prev,
                status: "active",
                opponentConnected: true,
                lastMoveTime: Date.now(),
            }));
        }
    };

    const copyInviteLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (gameState.status === "waiting") {
                setGameState((prev) => ({
                    ...prev,
                    opponentConnected: true,
                    status: "active",
                }));
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [gameState.status]);

    return (
        <>
            {gameState.status === "waiting" && (
                <Card className="w-full mb-6 bg-white">
                    <CardHeader>
                        <CardTitle className="text-indigo-700">
                            {onlineGameText.waitingTitle}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-3">
                            {onlineGameText.inviteInstructions}
                        </p>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                className="flex-1 p-2 border rounded-md text-sm"
                                value={window.location.href}
                                readOnly
                            />
                            <Button
                                onClick={copyInviteLink}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {showCopied
                                    ? onlineGameText.copiedButton
                                    : onlineGameText.copyButton}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="h-full">
                <ChessBoard
                    readOnly={
                        gameState.playerColor !== "white" &&
                        !gameState.opponentConnected
                    }
                    onTurn={handleMove}
                    showControls={false}
                    showCapturedPieces={true}
                    showStatusBar={true}
                    className="h-[min(calc(100%-58px),calc(100vw-50px))]"
                    reversed
                    playerLabels={{
                        whitePlayer: chessGameText.onlineFirstPlayer,
                        blackPlayer: chessGameText.onlineSecondPlayer,
                    }}
                />
            </div>
        </>
    );
}
