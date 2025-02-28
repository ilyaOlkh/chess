import React, { useEffect, useState } from "react";
import { ChessPieceComponentProps, getPiecePath } from "@/types/chess-piece";
import { cn } from "@/utilities/cn";
import { chessGameConstants } from "@/constants/chess-game";
import { CellPosition } from "@/types/chess-board";
import Image from "next/image";
import { useChessContext } from "@/context/ChessContext";
import { ChessMove, ChessPiece as ChessPieceType } from "@/types/chess-game";
import { chessBoard } from "@/constants/chess-board";

const ChessPiece: React.FC<ChessPieceComponentProps> = ({
    piece,
    position,
    isSelected = false,
    onClick,
}) => {
    const { state } = useChessContext();
    const [renderPosition, setRenderPosition] = useState<CellPosition>(
        getInitRenderPosition(piece, position, state.currentMove)
    );
    const [isAnimationFinished, setIsAnimationFinished] = useState(
        !shoudAnimatedChessPiece(piece, position, state.currentMove)
    );

    const imagePath = getPiecePath(piece);

    useEffect(() => {
        if (!isAnimationFinished) {
            setRenderPosition(position);
            setIsAnimationFinished(true);
        }
    }, [isAnimationFinished, position]);

    const handleClick = () => {
        if (onClick) {
            onClick(piece);
        }
    };

    const cellSize = 100 / chessBoard.size;

    const positionStyle: React.CSSProperties = {
        left: `${renderPosition.col * cellSize}%`,
        top: `${renderPosition.row * cellSize}%`,
        width: `${cellSize}%`,
        height: `${cellSize}%`,
        transitionProperty: "left, top",
        transitionDuration: isAnimationFinished
            ? `${chessGameConstants.animationDuration}ms`
            : "0ms",
        transitionTimingFunction: "ease-in-out",
    };

    return (
        <div
            className={cn(
                "absolute flex items-center justify-center select-none cursor-pointer z-10",
                isSelected && "z-20 bg-highlight"
            )}
            style={positionStyle}
            onClick={handleClick}
            data-piece-type={piece.type}
            data-piece-color={piece.color}
            data-animating={isAnimationFinished ? "false" : "true"}
        >
            <div className="pointer-events-none w-[85%] h-[85%] relative">
                <Image
                    src={imagePath}
                    alt={`${piece.color === "w" ? "White" : "Black"} ${
                        piece.type
                    }`}
                    fill
                    priority
                    sizes="(max-width: 768px) 10vw, 5vw"
                />
            </div>
        </div>
    );
};

export default ChessPiece;

function getInitRenderPosition(
    piece: ChessPieceType,
    position: CellPosition,
    currentMove: ChessMove | null
) {
    const movement = findCheckPieceInMovement(piece, position, currentMove);

    return movement ? movement.from : position;
}

function shoudAnimatedChessPiece(
    piece: ChessPieceType,
    position: CellPosition,
    currentMove: ChessMove | null
) {
    const movement = findCheckPieceInMovement(piece, position, currentMove);

    return !!movement;
}

function findCheckPieceInMovement(
    piece: ChessPieceType,
    position: CellPosition,
    currentMove: ChessMove | null
) {
    if (!currentMove) {
        return;
    }

    const movement = currentMove.movements.find(
        (move) =>
            move.pieceType === piece.type &&
            move.color === piece.color &&
            move.to.row === position.row &&
            move.to.col === position.col
    );

    return movement;
}
