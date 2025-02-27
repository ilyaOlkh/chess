import React from "react";
import { ChessBoardBaseProps } from "@/types/chess-board";
import { ChessProvider } from "@/context/ChessContext";
import { cn } from "@/utilities/cn";
import ChessBoardBase from "./board/ChessBoardBase";

const ChessBoard: React.FC<ChessBoardBaseProps> = ({ className }) => {
    return (
        <ChessProvider>
            <div className={cn("w-full flex flex-col items-center", className)}>
                <ChessBoardBase />
            </div>
        </ChessProvider>
    );
};

export default ChessBoard;
