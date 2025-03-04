"use client";

import { useEffect, useState } from "react";
import ChessBoard from "@/components/chess/ChessBoard";
import { Button } from "@/components/shadcn/Button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/shadcn/Dialog";
import { MoveData } from "@/types/chess-board";
import { onlineGameText } from "@/constants/online-game";
import { chessGameText } from "@/constants/chess-game";
import { useCurrentUrl } from "@/hooks/useCurrentUrl";

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
    const currentUrl = useCurrentUrl();
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
        const url = currentUrl;
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
            <Dialog open={gameState.status === "waiting"}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-indigo-700">
                            {onlineGameText.waitingTitle}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-2">
                        <p className="mb-3">
                            {onlineGameText.inviteInstructions}
                        </p>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                className="flex-1 p-2 border rounded-md text-sm"
                                value={currentUrl}
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
                    </div>
                </DialogContent>
            </Dialog>

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
