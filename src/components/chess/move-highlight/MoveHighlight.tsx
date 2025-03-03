import { cellSize } from "@/constants/chess-board";
import { ValidMove } from "@/types/chess-move";
import { cn } from "@/utilities/cn";
import React from "react";

export interface MoveHighlightProps {
    move: ValidMove;
    reversed?: boolean;
}

const MoveHighlight: React.FC<MoveHighlightProps> = ({
    move,
    reversed = false,
}) => {
    // Преобразуем алгебраическую нотацию в координаты доски
    const col = move.to.charCodeAt(0) - "a".charCodeAt(0);
    const row = 8 - parseInt(move.to[1]);

    // Учитываем разворот доски при расчете позиции
    const displayCol = reversed ? 7 - col : col;
    const displayRow = reversed ? 7 - row : row;

    return (
        <div
            key={`highlight-${move.to}`}
            className={cn(
                "absolute rounded-full pointer-events-none z-[20] -translate-x-1/2 -translate-y-1/2",
                move.isCapture
                    ? "size-[12.3%]  border-highlight border-[5px]"
                    : "bg-highlight size-[5%]"
            )}
            style={{
                left: `${displayCol * cellSize + cellSize / 2}%`,
                top: `${displayRow * cellSize + cellSize / 2}%`,
            }}
        />
    );
};

export default MoveHighlight;
