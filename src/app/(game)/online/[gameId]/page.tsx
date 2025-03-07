"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ChessBoard from "@/components/chess/ChessBoard";
import { Button } from "@/components/shadcn/Button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/shadcn/Dialog";
import { MoveData } from "@/types/chess-board";
import { onlineGameText } from "@/constants/online-game";
import { useCurrentUrl } from "@/hooks/useCurrentUrl";
import { useOnlineGame } from "@/hooks/useOnlineGame";

export default function OnlineGame({
    params,
}: {
    params: Promise<{ gameId: string }>;
}) {
    const { gameId } = use(params);

    const { gameState, makeMove } = useOnlineGame({ gameId: gameId });

    const router = useRouter();
    const currentUrl = useCurrentUrl();
    const [showCopied, setShowCopied] = useState<boolean>(false);
    const [showError, setShowError] = useState<boolean>(false);
    const [isReadOnly, setIsReadOnly] = useState<boolean>(
        gameState.playerRole === "spectator" || !gameState.isPlayerTurn
    );

    const handleMove = useCallback(
        async (moveData: MoveData) => {
            setIsReadOnly(false);
            const success = await makeMove(moveData);

            if (!success) {
                setIsReadOnly(true);
            }

            return success;
        },
        [makeMove]
    );

    const copyInviteLink = () => {
        navigator.clipboard.writeText(currentUrl);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    // Show error dialog if needed
    useEffect(() => {
        if (gameState.error) {
            setShowError(true);
        }
    }, [gameState.error]);

    // Determine board settings
    const isPlayerWhite = useMemo(
        () => gameState.playerColor === "white",
        [gameState.playerColor]
    );

    useEffect(() => {
        setIsReadOnly(
            gameState.playerRole === "spectator" || !gameState.isPlayerTurn
        );
    }, [gameState.playerRole, gameState.isPlayerTurn]);

    return (
        <>
            {/* Waiting for opponent dialog */}
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

            {/* Error dialog */}
            <Dialog open={showError}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">
                            Error
                        </DialogTitle>
                    </DialogHeader>
                    <DialogDescription>{gameState.error}</DialogDescription>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                setShowError(false);
                                router.push("/");
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            Return to Home
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Game completed dialog */}
            <Dialog open={gameState.status === "completed"}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-indigo-700">
                            Game Over
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-2">
                        <p className="mb-3">
                            {gameState.winner === "draw"
                                ? "Game ended in a draw!"
                                : gameState.winner === gameState.playerColor
                                ? "You won the game!"
                                : "You lost the game."}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => router.push("/")}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            Return to Home
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="h-full">
                <ChessBoard
                    readOnly={isReadOnly}
                    onTurn={handleMove}
                    showControls={false}
                    showCapturedPieces={true}
                    showStatusBar={true}
                    className="h-[min(calc(100%-58px),calc(100vw-50px))]"
                    reversed={!isPlayerWhite}
                    playerLabels={{
                        whitePlayer:
                            gameState.playerColor === "white"
                                ? "You (White)"
                                : "Opponent (White)",
                        blackPlayer:
                            gameState.playerColor === "black"
                                ? "You (Black)"
                                : "Opponent (Black)",
                    }}
                />
            </div>
        </>
    );
}
