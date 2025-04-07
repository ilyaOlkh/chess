import { PieceColor, PieceType, PromotionPieceType } from "@/types/chess-game";

export const promotionConstants = {
    availablePieces: ["q", "r", "b", "n"] as PieceType[],
};

export const pieceNames = {
    w: {
        q: "Білий ферзь",
        r: "Біла тура",
        b: "Білий слон",
        n: "Білий кінь",
    },
    b: {
        q: "Чорний ферзь",
        r: "Чорна тура",
        b: "Чорний слон",
        n: "Чорний кінь",
    },
} as const;

export const promotionText = {
    pieceAltText: (color: PieceColor, type: PromotionPieceType): string =>
        pieceNames[color][type],
};
