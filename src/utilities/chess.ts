import { CellPosition } from "@/types/chess-board";
import { Square } from "chess.js";

export const positionToAlgebraic = (position: CellPosition): Square => {
    const file = String.fromCharCode("a".charCodeAt(0) + position.col);
    const rank = 8 - position.row;
    return `${file}${rank}` as Square;
};

export const algebraicToPosition = (algebraic: Square): CellPosition => {
    const col = algebraic.charCodeAt(0) - "a".charCodeAt(0);
    const row = 8 - parseInt(algebraic[1]);
    return { row, col };
};
