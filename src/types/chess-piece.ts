import { ChessPiece, ChessPieceSimple } from "./chess-game";
import { CellPosition } from "./chess-board";

export interface ChessPieceComponentProps {
    piece: ChessPiece;
    position: CellPosition; // Реальная позиция на доске для вычислений
    isSelected?: boolean;
    isAnimating?: boolean;
    onClick?: (piece: ChessPiece) => void;
    reversed?: boolean;
}

export const chessPiecePaths = {
    wp: "/chess-pieces/white_pawn.svg",
    wn: "/chess-pieces/white_knight.svg",
    wb: "/chess-pieces/white_bishop.svg",
    wr: "/chess-pieces/white_rook.svg",
    wq: "/chess-pieces/white_queen.svg",
    wk: "/chess-pieces/white_king.svg",

    bp: "/chess-pieces/black_pawn.svg",
    bn: "/chess-pieces/black_knight.svg",
    bb: "/chess-pieces/black_bishop.svg",
    br: "/chess-pieces/black_rook.svg",
    bq: "/chess-pieces/black_queen.svg",
    bk: "/chess-pieces/black_king.svg",
};

export const getPiecePath = (piece: ChessPieceSimple): string => {
    const key = `${piece.color}${piece.type}` as keyof typeof chessPiecePaths;
    return chessPiecePaths[key];
};
