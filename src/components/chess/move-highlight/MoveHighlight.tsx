import { cellSize } from "@/constants/chess-board";
import { ValidMove } from "@/types/chess-move";
import { cn } from "@/utilities/cn";
import React from "react";

export interface MoveHighlightProps {
    move: ValidMove;
}

const MoveHighlight: React.FC<MoveHighlightProps> = ({ move }) => {
    const col = move.to.charCodeAt(0) - "a".charCodeAt(0);
    const row = 8 - parseInt(move.to[1]);

    return (
        <div
            key={`highlight-${move}`}
            className={cn(
                "absolute rounded-full pointer-events-none z-[20] -translate-x-1/2 -translate-y-1/2",
                move.isCapture
                    ? "size-[12.3%]  border-highlight border-[5px]"
                    : "bg-highlight size-[5%]"
            )}
            style={{
                left: `${col * cellSize + cellSize / 2}%`,
                top: `${row * cellSize + cellSize / 2}%`,
            }}
        />
    );
};

export default MoveHighlight;
