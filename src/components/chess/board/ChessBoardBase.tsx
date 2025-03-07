"use client";

import React from "react";
import { useChessContext } from "@/context/ChessContext";
import { ChessBoardBaseProps, CellPosition } from "@/types/chess-board";
import { chessBoard } from "@/constants/chess-board";
import { cn } from "@/utilities/cn";
import ChessPiece from "@/components/chess/piece/ChessPiece";
import { ChessPiece as ChessPieceType, PieceType } from "@/types/chess-game";
import { positionToAlgebraic } from "@/utilities/chess";
import MoveHighlight from "../move-highlight/MoveHighlight";
import PromotionModal from "../promotion/PromotionModal";
import {
    getCellColor,
    getTextColor,
    isValidMove,
} from "./ChessBoardBase.funcs";
import CapturedPieces from "../capturedPieces/capturedPieces";
import { chessGameText } from "@/constants/chess-game";

const ChessBoardBase: React.FC<ChessBoardBaseProps> = ({
    className,
    readOnly = false,
    reversed = false,
    onTurn,
    showCapturedPieces = true,
    playerLabels = {
        whitePlayer: chessGameText.localWhitePlayer,
        blackPlayer: chessGameText.localBlackPlayer,
    },
}) => {
    const { state, selectPiece, makeMove, promotePawn, cancelPromotion } =
        useChessContext();

    function handlePieceClick(piece: ChessPieceType) {
        if (readOnly) return;

        if (piece.color === state.currentTurn) {
            selectPiece(piece);
        } else {
            if (state.selectedPiece) {
                const from = positionToAlgebraic(state.selectedPiece.position);
                const to = positionToAlgebraic(piece.position);
                if (isValidMove(state, to)) {
                    const { isPawnPromotion } = makeMove(from, to);

                    if (onTurn && !isPawnPromotion) {
                        onTurn({
                            from,
                            to,
                            fen: state.fenString,
                        });
                    }
                }
            }
        }
    }

    function handleCellClick(position: CellPosition) {
        if (readOnly) return;

        if (state.selectedPiece) {
            const from = positionToAlgebraic(state.selectedPiece.position);
            const to = positionToAlgebraic(position);

            if (isValidMove(state, to)) {
                const { isPawnPromotion } = makeMove(from, to);
                if (onTurn && !isPawnPromotion) {
                    onTurn({
                        from,
                        to,
                        fen: state.fenString,
                    });
                }
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

    function handlePromotionSelect(pieceType: PieceType) {
        if (readOnly) return;

        if (state.pendingPromotion && onTurn) {
            const from = state.pendingPromotion.from;
            const to = state.pendingPromotion.to;

            // Вызываем колбек с информацией о продвижении пешки
            onTurn({
                from,
                to,
                promotion: pieceType,
                fen: state.fenString,
            });
        }

        promotePawn(pieceType);
    }

    function isCurrentMoveSquare(colIndex: number, rowIndex: number) {
        return (
            (state.currentMove?.from.row === rowIndex &&
                state.currentMove?.from.col === colIndex) ||
            (state.currentMove?.to.row === rowIndex &&
                state.currentMove?.to.col === colIndex)
        );
    }

    // Подготавливаем ранги и файлы с учетом поворота доски
    const displayRanks = reversed
        ? [...chessBoard.ranks]
        : [...chessBoard.ranks].reverse();
    const displayFiles = reversed
        ? [...chessBoard.files].reverse()
        : [...chessBoard.files];

    return (
        <div className={"h-full relative flex flex-col"}>
            {showCapturedPieces && (
                <div className="w-full flex justify-start items-center mt-2 px-4">
                    <div className="font-medium text-md">
                        {reversed
                            ? playerLabels.whitePlayer
                            : playerLabels.blackPlayer}
                    </div>
                    <CapturedPieces
                        pieces={
                            reversed
                                ? state.capturedPieces.w
                                : state.capturedPieces.b
                        }
                    />
                </div>
            )}
            <div className={cn("relative aspect-square ", className)}>
                <div className={""}>
                    <div className="grid grid-cols-8 border border-gray-300 rounded shadow-md relative">
                        {displayRanks.map((rank, rowIndex) =>
                            displayFiles.map((file, colIndex) => {
                                // Расчет реальных координат с учетом разворота доски
                                const boardRow = reversed
                                    ? 7 - rowIndex
                                    : rowIndex;
                                const boardCol = reversed
                                    ? 7 - colIndex
                                    : colIndex;

                                const realRank = chessBoard.ranks[7 - boardRow];
                                const realFile = chessBoard.files[boardCol];

                                const isSelectedCell = state.selectedPiece
                                    ? state.selectedPiece.position.row ===
                                          boardRow &&
                                      state.selectedPiece.position.col ===
                                          boardCol
                                    : false;

                                return (
                                    <div
                                        key={`${file}${rank}`}
                                        className={cn(
                                            `${getCellColor(
                                                boardRow,
                                                boardCol
                                            )} aspect-square relative`,
                                            isSelectedCell &&
                                                "bg-highlight bg-opacity-50",
                                            readOnly && "cursor-default"
                                        )}
                                        onClick={() =>
                                            handleCellClick({
                                                row: boardRow,
                                                col: boardCol,
                                            })
                                        }
                                    >
                                        {isCurrentMoveSquare(
                                            boardCol,
                                            boardRow
                                        ) && (
                                            <div className="absolute top-0 left-0 w-full h-full bg-yellow-100/75"></div>
                                        )}
                                        {rowIndex === chessBoard.size - 1 && (
                                            <span
                                                className={cn(
                                                    "select-none pointer-events-none absolute bottom-0 right-1 font-roboto font-medium text-sm",
                                                    getTextColor(
                                                        boardRow,
                                                        boardCol
                                                    )
                                                )}
                                            >
                                                {realFile}
                                            </span>
                                        )}
                                        {colIndex === 0 && (
                                            <span
                                                className={cn(
                                                    "select-none pointer-events-none absolute top-0 left-1 font-roboto font-medium text-sm",
                                                    getTextColor(
                                                        boardRow,
                                                        boardCol
                                                    )
                                                )}
                                            >
                                                {realRank}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}

                        {state.validMoves.length &&
                        state.selectedPiece &&
                        !readOnly ? (
                            state.validMoves.map((move) => {
                                // Для корректного отображения подсветок ходов при развороте доски
                                // нужно преобразовать позиции с учетом разворота
                                const adjustedMove = {
                                    ...move,
                                    to: move.to, // Не меняем алгебраическую нотацию, т.к. MoveHighlight конвертирует ее сам
                                };

                                return (
                                    <MoveHighlight
                                        key={`highlight-${move.to}`}
                                        move={adjustedMove}
                                        reversed={reversed}
                                    />
                                );
                            })
                        ) : (
                            <></>
                        )}

                        {state.board.map((row, rowIndex) =>
                            row.map((piece, colIndex) => {
                                if (!piece) return null;

                                const pieceKey = `${piece.type}${piece.color}${rowIndex}${colIndex}`;

                                const isSelected = state.selectedPiece
                                    ? state.selectedPiece.position.row ===
                                          rowIndex &&
                                      state.selectedPiece.position.col ===
                                          colIndex
                                    : false;

                                return (
                                    <ChessPiece
                                        key={pieceKey}
                                        piece={piece}
                                        position={{
                                            row: rowIndex,
                                            col: colIndex,
                                        }}
                                        isSelected={isSelected && !readOnly}
                                        onClick={
                                            !readOnly
                                                ? handlePieceClick
                                                : undefined
                                        }
                                        reversed={reversed}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>
                {state.pendingPromotion && !readOnly && (
                    <>
                        <div
                            className="fixed inset-0 bg-opacity-50 z-50"
                            onClick={cancelPromotion}
                        ></div>
                        <PromotionModal
                            color={state.currentTurn}
                            onSelect={handlePromotionSelect}
                            position={{
                                top: reversed
                                    ? (7 -
                                          Math.floor(
                                              state.pendingPromotion.position
                                                  .top / 12.5
                                          )) *
                                      12.5
                                    : state.pendingPromotion.position.top,
                                left: reversed
                                    ? (7 -
                                          Math.floor(
                                              state.pendingPromotion.position
                                                  .left / 12.5
                                          )) *
                                      12.5
                                    : state.pendingPromotion.position.left,
                            }}
                        />
                    </>
                )}
            </div>

            {showCapturedPieces && (
                <div className="w-full flex justify-start items-center mt-2 px-4">
                    <div className="font-medium text-md">
                        {reversed
                            ? playerLabels.blackPlayer
                            : playerLabels.whitePlayer}
                    </div>
                    <CapturedPieces
                        pieces={
                            reversed
                                ? state.capturedPieces.b
                                : state.capturedPieces.w
                        }
                    />
                </div>
            )}
        </div>
    );
};

export default ChessBoardBase;
