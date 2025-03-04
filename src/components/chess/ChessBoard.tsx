import React from "react";
import { ChessBoardBaseProps } from "@/types/chess-board";
import { ChessProvider } from "@/context/ChessContext";
import { useChessContext } from "@/context/ChessContext";
import { cn } from "@/utilities/cn";
import ChessBoardBase from "./board/ChessBoardBase";
import { chessGameText } from "@/constants/chess-game";
import { Button } from "@/components/shadcn/Button";

interface EnhancedChessBoardProps extends ChessBoardBaseProps {
    showControls?: boolean;
    showStatusBar?: boolean;
}

const ChessBoardContent: React.FC<EnhancedChessBoardProps> = ({
    className,
    readOnly = false,
    reversed = false,
    onTurn,
    showControls = true,
    showCapturedPieces = true,
    showStatusBar = true,
    playerLabels = {
        whitePlayer: chessGameText.localWhitePlayer,
        blackPlayer: chessGameText.localBlackPlayer,
    },
}) => {
    const { state, resetGame, undoMove } = useChessContext();

    return (
        <div className="h-full flex flex-col md:flex-row">
            <div className="flex-grow flex flex-col items-center">
                {showStatusBar && (
                    <div className="mb-4 p-3 bg-indigo-100 rounded-md shadow text-center">
                        <p className="font-semibold text-indigo-800">
                            {state.isCheckmate
                                ? chessGameText.checkmateMessage
                                : state.isDraw
                                ? chessGameText.drawMessage
                                : state.isCheck
                                ? chessGameText.checkMessage
                                : state.currentTurn === "w"
                                ? chessGameText.whiteTurn
                                : chessGameText.blackTurn}
                        </p>
                    </div>
                )}

                <div className="flex-grow w-full flex justify-center pb-4">
                    <ChessBoardBase
                        readOnly={readOnly}
                        reversed={reversed}
                        onTurn={onTurn}
                        className={cn(className)}
                        showCapturedPieces={showCapturedPieces}
                        playerLabels={playerLabels}
                    />
                </div>
            </div>

            {showControls && (
                <div className="md:w-80 flex flex-col space-y-4 p-4">
                    <div className="p-4 bg-white rounded-md shadow">
                        <h2 className="text-xl font-semibold mb-3 text-indigo-700">
                            {chessGameText.gameControlsTitle}
                        </h2>

                        <div className="space-y-3">
                            <Button
                                onClick={undoMove}
                                variant="outline"
                                className="w-full"
                                disabled={state.moveHistory.length === 0}
                            >
                                {chessGameText.undoButtonLabel}
                            </Button>

                            <Button
                                onClick={resetGame}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {chessGameText.resetButtonLabel}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ChessBoard: React.FC<EnhancedChessBoardProps> = (props) => {
    return (
        <ChessProvider>
            <div className={"h-full"}>
                <ChessBoardContent {...props} />
            </div>
        </ChessProvider>
    );
};

export default ChessBoard;
