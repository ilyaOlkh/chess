import { PieceType } from "@/types/chess-game";

export const promotionConstants = {
    availablePieces: ["q", "r", "b", "n"] as PieceType[],
};

export const promotionText = {
    pieceAltText: (color: string, type: string): string =>
        `${color === "w" ? "Белая" : "Черная"} ${
            type === "q"
                ? "ферзь"
                : type === "r"
                ? "ладья"
                : type === "b"
                ? "слон"
                : "конь"
        }`,
};
