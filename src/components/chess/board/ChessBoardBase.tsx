import React from "react";
import { ChessBoardBaseProps } from "@/types/chess";
import { chessBoard } from "@/constants/chess";
import { cn } from "@/utilities/cn";

const ChessBoardBase: React.FC<ChessBoardBaseProps> = ({ className }) => {
    // Функция для определения цвета клетки
    const getCellColor = (row: number, col: number): string => {
        return (row + col) % 2 === 0 ? "bg-lightCell" : "bg-darkCell";
    };

    // Функция для определения цвета текста (противоположного цвету клетки)
    const getTextColor = (row: number, col: number): string => {
        return (row + col) % 2 === 0 ? "text-darkText" : "text-lightText";
    };

    return (
        <div className={cn(`w-full max-w-md mx-auto aspect-square`, className)}>
            <div
                className={
                    "grid grid-cols-8 border border-gray-300 rounded shadow-md"
                }
            >
                {chessBoard.ranks
                    .slice()
                    .reverse()
                    .map((rank, rowIndex) =>
                        chessBoard.files.map((file, colIndex) => (
                            <div
                                key={`${file}${rank}`}
                                className={`${getCellColor(
                                    rowIndex,
                                    colIndex
                                )} aspect-square relative`}
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

                                {/* Цифры в левом столбце */}
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
                        ))
                    )}
            </div>
        </div>
    );
};

export default ChessBoardBase;
