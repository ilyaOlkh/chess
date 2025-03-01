import { Square } from "chess.js";
import { CellPosition } from "./chess-board";
import { ValidMove } from "./chess-move";
import { PendingPromotion } from "./promotion";

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type PieceColor = "w" | "b";

export interface ChessPiece {
    type: PieceType;
    color: PieceColor;
    position: CellPosition;
}

export interface ChessPieceSimple {
    type: PieceType;
    color: PieceColor;
}

export interface PieceMovement {
    pieceType: PieceType;
    color: PieceColor;
    from: CellPosition;
    to: CellPosition;
    animationDuration?: number;
}

export type MoveType =
    | "normal"
    | "castling"
    | "en_passant"
    | "promotion"
    | "capture";

export interface ChessMove {
    type: MoveType;
    movements: PieceMovement[];
    notation: string;
    capturedPiece?: ChessPiece;
}

export interface ChessGameState {
    board: (ChessPiece | null)[][];
    currentTurn: PieceColor;
    moveHistory: ChessMove[];
    isCheck: boolean;
    isCheckmate: boolean;
    isDraw: boolean;
    selectedPiece: ChessPiece | null;
    validMoves: ValidMove[];
    capturedPieces: {
        w: ChessPiece[];
        b: ChessPiece[];
    };
    currentMove: ChessMove | null;
    animatingPieces: Map<string, boolean>;
    fenString: string;
    pendingPromotion: PendingPromotion | null;
}

export type ChessAction =
    | { type: "SELECT_PIECE"; payload: ChessPiece | null }
    | { type: "MAKE_MOVE"; payload: { from: Square; to: Square } }
    | { type: "ANIMATION_COMPLETE"; payload: string }
    | { type: "RESET_GAME" }
    | { type: "UNDO_MOVE" }
    | { type: "SET_POSITION"; payload: string }
    | { type: "SET_PENDING_PROMOTION"; payload: PendingPromotion | null }
    | { type: "COMPLETE_PROMOTION"; payload: { promotion: PieceType } };
