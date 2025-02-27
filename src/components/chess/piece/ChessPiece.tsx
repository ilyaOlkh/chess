import React, { useEffect, useRef, useState } from "react";
import { ChessPieceComponentProps, getPiecePath } from "@/types/chess-piece";
import { cn } from "@/utilities/cn";
import { chessGameConstants } from "@/constants/chess-game";
import { CellPosition } from "@/types/chess-board";
import Image from "next/image";

const ChessPiece: React.FC<ChessPieceComponentProps> = ({
    piece,
    position,
    isSelected = false,
    isAnimating = false,
    onAnimationComplete,
    onClick,
}) => {
    const [currentPosition, setCurrentPosition] =
        useState<CellPosition>(position);
    const pieceRef = useRef<HTMLDivElement>(null);

    const imagePath = getPiecePath(piece);

    useEffect(() => {
        if (!isAnimating) {
            setCurrentPosition(position);
        }
    }, [position, isAnimating]);

    useEffect(() => {
        if (!isAnimating || !pieceRef.current) return;

        const handleTransitionEnd = () => {
            setCurrentPosition(position);
            if (onAnimationComplete) {
                onAnimationComplete();
            }
        };

        const element = pieceRef.current;
        element.addEventListener("transitionend", handleTransitionEnd);

        return () => {
            element.removeEventListener("transitionend", handleTransitionEnd);
        };
    }, [isAnimating, onAnimationComplete, position]);

    const getTransformStyle = () => {
        if (isAnimating) {
            const deltaX = (position.col - currentPosition.col) * 12.5;
            const deltaY = (position.row - currentPosition.row) * 12.5;
            return { transform: `translate(${deltaX}%, ${deltaY}%)` };
        }
        return {};
    };

    const positionStyle = {
        left: `${currentPosition.col * 12.5}%`,
        top: `${currentPosition.row * 12.5}%`,
        width: "12.5%",
        height: "12.5%",
        transitionDuration: `${chessGameConstants.animationDuration}ms`,
    } as React.CSSProperties;

    const handleClick = () => {
        if (onClick && !isAnimating) {
            onClick(piece);
        }
    };

    return (
        <div
            ref={pieceRef}
            className={cn(
                "absolute flex items-center justify-center select-none cursor-pointer z-10 transition-transform ease-in-out",
                isSelected && "z-20 bg-highlight"
            )}
            style={{ ...positionStyle, ...getTransformStyle() }}
            onClick={handleClick}
            data-piece-type={piece.type}
            data-piece-color={piece.color}
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
