import React from "react";
import { ChessBoardBaseProps } from "@/types/chess-board";
import { ChessProvider } from "@/context/ChessContext";
import { useChessContext } from "@/context/ChessContext";
import { cn } from "@/utilities/cn";
import ChessBoardBase from "./board/ChessBoardBase";
import { chessGameText } from "@/constants/chess-game";
import { Button } from "@/components/shadcn/Button";
import CapturedPieces from "./capturedPieces/capturedPieces";

interface EnhancedChessBoardProps extends ChessBoardBaseProps {
    showControls?: boolean;
    showCapturedPieces?: boolean;
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
}) => {
    const { state, resetGame, undoMove } = useChessContext();

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="grid md:grid-cols-[1fr_auto] gap-6">
                <div className="flex flex-col items-center">
                    <div className="w-full max-w-md">
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
                        <ChessBoardBase
                            readOnly={readOnly}
                            reversed={reversed}
                            onTurn={onTurn}
                            className={className}
                        />
                    </div>
                </div>

                {(showControls || showCapturedPieces) && (
                    <div className="flex flex-col space-y-4">
                        {showControls && (
                            <div className="p-4 bg-white rounded-md shadow">
                                <h2 className="text-xl font-semibold mb-3 text-indigo-700">
                                    Управление игрой
                                </h2>

                                <div className="space-y-3">
                                    <Button
                                        onClick={undoMove}
                                        variant="outline"
                                        className="w-full"
                                        disabled={
                                            state.moveHistory.length === 0
                                        }
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
                        )}

                        {showCapturedPieces && (
                            <div className="p-4 bg-white rounded-md shadow">
                                <h2 className="text-xl font-semibold mb-3 text-indigo-700">
                                    {chessGameText.capturedPiecesLabel}
                                </h2>

                                <div className="grid grid-cols-2 gap-4">
                                    <CapturedPieces
                                        pieces={state.capturedPieces.b}
                                        title="Белые"
                                    />

                                    <CapturedPieces
                                        pieces={state.capturedPieces.w}
                                        title="Черные"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const ChessBoard: React.FC<EnhancedChessBoardProps> = (props) => {
    return (
        <ChessProvider>
            <div
                className={cn(
                    "w-full flex flex-col items-center",
                    props.className
                )}
            >
                <ChessBoardContent {...props} />
            </div>
        </ChessProvider>
    );
};

export default ChessBoard;
