"use client";

import React from "react";
import { useChessContext } from "@/context/ChessContext";
import { ChessBoardBaseProps, CellPosition } from "@/types/chess-board";
import { chessBoard } from "@/constants/chess-board";
import { cn } from "@/utilities/cn";
import ChessPiece from "@/components/chess/piece/ChessPiece";
import { ChessPiece as ChessPieceType } from "@/types/chess-game";
import { positionToAlgebraic } from "@/utilities/chess";

const ChessBoard: React.FC<ChessBoardBaseProps> = ({ className }) => {
    const { state, selectPiece, makeMove } =
        useChessContext();

    const getCellColor = (row: number, col: number): string => {
        return (row + col) % 2 === 0 ? "bg-lightCell" : "bg-darkCell";
    };

    const getTextColor = (row: number, col: number): string => {
        return (row + col) % 2 === 0 ? "text-darkText" : "text-lightText";
    };

    const handlePieceClick = (piece: ChessPieceType) => {
        if (piece.color === state.currentTurn) {
            selectPiece(piece);
        } else {
            if (state.selectedPiece) {
                const from = positionToAlgebraic(state.selectedPiece.position);
                const to = positionToAlgebraic(piece.position);
                if (state.validMoves.includes(to)) {
                    makeMove(from, to);
                }
            }
        }
    };

    const handleCellClick = (position: CellPosition) => {
        if (state.selectedPiece) {
            const from = positionToAlgebraic(state.selectedPiece.position);
            const to = positionToAlgebraic(position);
            console.log(to);
            if (state.validMoves.includes(to)) {
                makeMove(from, to);
            } else {
                const pieceAtPosition = state.board[position.row][position.col];
                if (
                    pieceAtPosition &&
                    pieceAtPosition.color === state.currentTurn
                ) {
                    selectPiece(pieceAtPosition);
                } else {
                    selectPiece(null);
                }
            }
        } else {
            const pieceAtPosition = state.board[position.row][position.col];
            if (
                pieceAtPosition &&
                pieceAtPosition.color === state.currentTurn
            ) {
                selectPiece(pieceAtPosition);
            }
        }
    };

    const renderMoveHighlights = () => {
        if (!state.selectedPiece || !state.validMoves.length) return null;

        return state.validMoves.map((moveNotation) => {
            const col = moveNotation.charCodeAt(0) - "a".charCodeAt(0);
            const row = 8 - parseInt(moveNotation[1]);

            return (
                <div
                    key={`highlight-${moveNotation}`}
                    className="absolute rounded-full bg-highlight pointer-events-none"
                    style={{
                        width: "5%",
                        height: "5%",
                        left: `${col * 12.5 + 3.75}%`,
                        top: `${row * 12.5 + 3.75}%`,
                        zIndex: 5,
                    }}
                />
            );
        });
    };

    return (
        <div
            className={cn(
                `w-full max-w-md mx-auto aspect-square relative`,
                className
            )}
        >
            <div className="grid grid-cols-8 border border-gray-300 rounded shadow-md relative">
                {chessBoard.ranks
                    .slice()
                    .reverse()
                    .map((rank, rowIndex) =>
                        chessBoard.files.map((file, colIndex) => {
                            const isSelectedCell = state.selectedPiece
                                ? state.selectedPiece.position.row ===
                                      rowIndex &&
                                  state.selectedPiece.position.col === colIndex
                                : false;

                            return (
                                <div
                                    key={`${file}${rank}`}
                                    className={cn(
                                        `${getCellColor(
                                            rowIndex,
                                            colIndex
                                        )} aspect-square relative`,
                                        isSelectedCell &&
                                            "bg-highlight bg-opacity-50"
                                    )}
                                    onClick={() =>
                                        handleCellClick({
                                            row: rowIndex,
                                            col: colIndex,
                                        })
                                    }
                                >
                                    {rowIndex === chessBoard.size - 1 && (
                                        <span
                                            className={`select-none pointer-events-none absolute bottom-0 right-1 font-roboto font-medium text-sm ${getTextColor(
                                                rowIndex,
                                                colIndex
                                            )}`}
                                        >
                                            {file}
                                        </span>
                                    )}
                                    {colIndex === 0 && (
                                        <span
                                            className={`select-none pointer-events-none absolute top-0 left-1 font-roboto font-medium text-sm ${getTextColor(
                                                rowIndex,
                                                colIndex
                                            )}`}
                                        >
                                            {rank}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}

                {renderMoveHighlights()}

                {state.board.map((row, rowIndex) =>
                    row.map((piece, colIndex) => {
                        if (!piece) return null;

                        const pieceKey = `${piece.type}${piece.color}${rowIndex}${colIndex}`;

                        const isSelected = state.selectedPiece
                            ? state.selectedPiece.position.row === rowIndex &&
                              state.selectedPiece.position.col === colIndex
                            : false;

                        return (
                            <ChessPiece
                                key={pieceKey}
                                piece={piece}
                                position={{ row: rowIndex, col: colIndex }}
                                isSelected={isSelected}
                                onClick={handlePieceClick}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChessBoard;
