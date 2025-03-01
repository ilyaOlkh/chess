import { ChessGameState } from "@/types/chess-game";
import { Square } from "chess.js";

export function isValidMove(state: ChessGameState, to: Square) {
    return state.validMoves.some((move) => move.to === to);
}

export function getCellColor(row: number, col: number) {
    return (row + col) % 2 === 0 ? "bg-lightCell" : "bg-darkCell";
}

export function getTextColor(row: number, col: number) {
    return (row + col) % 2 === 0 ? "text-darkText" : "text-lightText";
}
