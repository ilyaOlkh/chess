import { chessGameConstants } from "@/constants/chess-game";
import { CellPosition } from "@/types/chess-board";
import { ChessPiece } from "@/types/chess-game";
import { Square, Chess } from "chess.js";

interface CapturedPeaces {
    w: ChessPiece[];
    b: ChessPiece[];
}

export const positionToAlgebraic = (position: CellPosition): Square => {
    const file = String.fromCharCode("a".charCodeAt(0) + position.col);
    const rank = 8 - position.row;
    return `${file}${rank}` as Square;
};

export const reversePosition = (
    position: CellPosition,
    isReversed: boolean
): CellPosition => {
    if (!isReversed) {
        return position;
    } else {
        return {
            row: 7 - position.row,
            col: 7 - position.col,
        };
    }
};

export const algebraicToPosition = (algebraic: Square): CellPosition => {
    const col = algebraic.charCodeAt(0) - "a".charCodeAt(0);
    const row = 8 - parseInt(algebraic[1]);
    return { row, col };
};

export const getCapturedPieces = (chess: Chess) => {
    const board = chess.board();

    const piecesCount = {
        w: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
        b: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
    };

    for (const row of board) {
        for (const piece of row) {
            if (piece) {
                piecesCount[piece.color][piece.type]++;
            }
        }
    }

    const captured: CapturedPeaces = {
        w: [],
        b: [],
    };

    for (const type of ["p", "r", "n", "b", "q"] as const) {
        const whiteLost =
            chessGameConstants.startingPiecesCount.w[type] -
            piecesCount.w[type];
        const blackLost =
            chessGameConstants.startingPiecesCount.b[type] -
            piecesCount.b[type];

        for (let i = 0; i < whiteLost; i++) {
            captured.w.push({
                type,
                color: "w",
                position: { row: -1, col: -1 },
            });
        }
        for (let i = 0; i < blackLost; i++) {
            captured.b.push({
                type,
                color: "b",
                position: { row: -1, col: -1 },
            });
        }
    }

    return captured;
};
