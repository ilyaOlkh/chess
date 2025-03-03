import React from "react";
import Image from "next/image";
import { ChessPiece } from "@/types/chess-game";
import { chessPiecePaths } from "@/types/chess-piece";

interface CapturedPiecesProps {
    pieces: ChessPiece[];
    title: string;
}

const CapturedPieces: React.FC<CapturedPiecesProps> = ({ pieces, title }) => {
    return (
        <div>
            <h3 className="font-medium mb-2">{title}</h3>
            <div className="flex flex-wrap max-w-15">
                {pieces.map((piece, index) => {
                    const key =
                        `${piece.color}${piece.type}` as keyof typeof chessPiecePaths;
                    const imagePath = chessPiecePaths[key];

                    return (
                        <div
                            key={`${title.toLowerCase()}-${index}`}
                            className="w-6 h-6 relative -ml-3 first:ml-0"
                        >
                            <Image
                                src={imagePath}
                                alt={`Captured ${piece.type}`}
                                width={24}
                                height={24}
                                className="w-full h-full"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CapturedPieces;
