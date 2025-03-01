"use client";

import React from "react";
import { useChessContext } from "@/context/ChessContext";
import { ChessBoardBaseProps, CellPosition } from "@/types/chess-board";
import { chessBoard } from "@/constants/chess-board";
import { cn } from "@/utilities/cn";
import ChessPiece from "@/components/chess/piece/ChessPiece";
import { ChessPiece as ChessPieceType } from "@/types/chess-game";
import { positionToAlgebraic } from "@/utilities/chess";
import MoveHighlight from "../move-highlight/MoveHighlight";
import {
    getCellColor,
    getTextColor,
    isValidMove,
} from "./ChessBoardBase.funcs";

const ChessBoard: React.FC<ChessBoardBaseProps> = ({ className }) => {
    const { state, selectPiece, makeMove } = useChessContext();

    function handlePieceClick(piece: ChessPieceType) {
        if (piece.color === state.currentTurn) {
            selectPiece(piece);
        } else {
            if (state.selectedPiece) {
                const from = positionToAlgebraic(state.selectedPiece.position);
                const to = positionToAlgebraic(piece.position);
                if (isValidMove(state, to)) {
                    makeMove(from, to);
                }
            }
        }
    }

    function handleCellClick(position: CellPosition) {
        if (state.selectedPiece) {
            const from = positionToAlgebraic(state.selectedPiece.position);
            const to = positionToAlgebraic(position);

            if (isValidMove(state, to)) {
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
    }

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
                                            className={cn(
                                                "select-none pointer-events-none absolute bottom-0 right-1 font-roboto font-medium text-sm",
                                                getTextColor(rowIndex, colIndex)
                                            )}
                                        >
                                            {file}
                                        </span>
                                    )}
                                    {colIndex === 0 && (
                                        <span
                                            className={cn(
                                                "select-none pointer-events-none absolute top-0 left-1 font-roboto font-medium text-sm",
                                                getTextColor(rowIndex, colIndex)
                                            )}
                                        >
                                            {rank}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}

                {state.validMoves.length && state.selectedPiece ? (
                    state.validMoves.map((move) => (
                        <MoveHighlight
                            key={`highlight-${move.to}`}
                            move={move}
                        />
                    ))
                ) : (
                    <></>
                )}

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
