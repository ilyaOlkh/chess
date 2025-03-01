import React from "react";
import Image from "next/image";
import { getPiecePath } from "@/types/chess-piece";
import { cn } from "@/utilities/cn";
import { promotionConstants, promotionText } from "@/constants/promotion";
import { ChessPieceSimple, PieceColor, PieceType } from "@/types/chess-game";

export interface PromotionModalProps {
    color: PieceColor;
    onSelect: (pieceType: PieceType) => void;
    position: {
        top: number;
        left: number;
    };
}

const PromotionModal: React.FC<PromotionModalProps> = ({
    color,
    onSelect,
    position,
}) => {
    return (
        <div
            className={cn(
                "absolute bg-white grid grid-cols-1 gap-2 p-1 z-[50] w-[12.5%]",
                position.top <= 3 ? "top-0" : "bottom-0"
            )}
            style={{
                left: `calc(${position.left}% - 1px)`,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {promotionConstants.availablePieces.map((pieceType) => {
                const piece: ChessPieceSimple = { type: pieceType, color };
                const imagePath = getPiecePath(piece);

                return (
                    <div
                        key={pieceType}
                        className={cn(
                            "relative flex items-center justify-center hover:bg-gray-100 cursor-pointer w-full"
                        )}
                        onClick={() => onSelect(pieceType)}
                    >
                        <div className={cn("w-full aspect-square")}>
                            <Image
                                src={imagePath}
                                alt={promotionText.pieceAltText(
                                    color,
                                    pieceType
                                )}
                                fill
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default PromotionModal;
