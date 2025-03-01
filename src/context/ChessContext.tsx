"use client";

import React, { createContext, useContext, useReducer } from "react";
import { Chess, Square, Move } from "chess.js";
import {
    ChessGameState,
    ChessAction,
    ChessMove,
    PieceMovement,
    MoveType,
    ChessPiece,
    PieceColor,
} from "@/types/chess-game";
import { ValidMove } from "@/types/chess-move";
import { chessGameConstants } from "@/constants/chess-game";
import { algebraicToPosition, positionToAlgebraic } from "@/utilities/chess";

const getMoveType = (flags: string): MoveType => {
    if (flags.includes("k") || flags.includes("q")) return "castling";
    if (flags.includes("e")) return "en_passant";
    if (flags.includes("p")) return "promotion";
    if (flags.includes("c")) return "capture";
    return "normal";
};

const parseBoard = (chess: Chess): (ChessPiece | null)[][] => {
    const board = Array(8)
        .fill(null)
        .map(() => Array(8).fill(null));

    const chessBoard = chess.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = chessBoard[row][col];
            if (square) {
                board[row][col] = {
                    type: square.type,
                    color: square.color,
                    position: { row, col },
                };
            }
        }
    }

    return board;
};

const createInitialState = (): ChessGameState => {
    const chess = new Chess();

    return {
        board: parseBoard(chess),
        currentTurn: "w",
        moveHistory: [],
        isCheck: chess.isCheck(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        selectedPiece: null,
        validMoves: [],
        capturedPieces: {
            w: [],
            b: [],
        },
        currentMove: null,
        animatingPieces: new Map(),
        fenString: chess.fen(),
    };
};

const chessReducer = (
    state: ChessGameState,
    action: ChessAction
): ChessGameState => {
    const chess = new Chess(state.fenString);

    switch (action.type) {
        case "SELECT_PIECE": {
            const piece = action.payload;

            if (!piece || piece.color !== state.currentTurn) {
                return { ...state, selectedPiece: null, validMoves: [] };
            }

            const position = positionToAlgebraic(piece.position);
            const moves: Move[] = chess.moves({
                square: position as Square,
                verbose: true,
            });

            const validMoves: ValidMove[] = moves.map((move) => ({
                to: move.to,
                isCapture: Boolean(move.captured),
            }));

            return {
                ...state,
                selectedPiece: piece,
                validMoves,
            };
        }

        case "MAKE_MOVE": {
            console.log("move");
            const { from, to } = action.payload;

            const moveDetails = chess.move({ from, to });

            if (!moveDetails) {
                return state;
            }

            const movements: PieceMovement[] = [
                {
                    pieceType: moveDetails.piece,
                    color: moveDetails.color,
                    from: algebraicToPosition(from as Square),
                    to: algebraicToPosition(to as Square),
                    animationDuration: chessGameConstants.animationDuration,
                },
            ];

            const moveType = getMoveType(moveDetails.flags);

            if (moveType === "castling") {
                if (moveDetails.flags.includes("k")) {
                    const rookFromSquare: Square = (
                        moveDetails.color === "w" ? "h1" : "h8"
                    ) as Square;
                    const rookToSquare: Square = (
                        moveDetails.color === "w" ? "f1" : "f8"
                    ) as Square;
                    movements.push({
                        pieceType: "r",
                        color: moveDetails.color,
                        from: algebraicToPosition(rookFromSquare),
                        to: algebraicToPosition(rookToSquare),
                        animationDuration: chessGameConstants.animationDuration,
                    });
                } else {
                    const rookFromSquare: Square = (
                        moveDetails.color === "w" ? "a1" : "a8"
                    ) as Square;
                    const rookToSquare: Square = (
                        moveDetails.color === "w" ? "d1" : "d8"
                    ) as Square;
                    movements.push({
                        pieceType: "r",
                        color: moveDetails.color,
                        from: algebraicToPosition(rookFromSquare),
                        to: algebraicToPosition(rookToSquare),
                        animationDuration: chessGameConstants.animationDuration,
                    });
                }
            }

            const newMove: ChessMove = {
                type: moveType,
                movements,
                notation: moveDetails.san,
            };

            const capturedPieces = { ...state.capturedPieces };
            if (moveDetails.captured) {
                const capturedColor: PieceColor =
                    moveDetails.color === "w" ? "b" : "w";
                const capturedPosition =
                    moveType === "en_passant"
                        ? {
                              row:
                                  algebraicToPosition(to).row +
                                  (capturedColor === "w" ? -1 : 1),
                              col: algebraicToPosition(to).col,
                          }
                        : algebraicToPosition(to);

                const capturedPiece: ChessPiece = {
                    type: moveDetails.captured,
                    color: capturedColor,
                    position: capturedPosition,
                };

                newMove.capturedPiece = capturedPiece;
                capturedPieces[capturedColor] = [
                    ...capturedPieces[capturedColor],
                    capturedPiece,
                ];
            }

            const animatingPieces = new Map<string, boolean>();
            movements.forEach((movement) => {
                const fromPosition = positionToAlgebraic(movement.from);
                const key = `${movement.pieceType}${movement.color}${fromPosition}`;
                animatingPieces.set(key, true);
            });

            return {
                ...state,
                fenString: chess.fen(),
                board: parseBoard(chess),
                currentTurn: chess.turn(),
                isCheck: chess.isCheck(),
                isCheckmate: chess.isCheckmate(),
                isDraw: chess.isDraw(),
                selectedPiece: null,
                validMoves: [],
                moveHistory: [...state.moveHistory, newMove],
                capturedPieces,
                currentMove: newMove,
                animatingPieces,
            };
        }

        case "RESET_GAME": {
            return createInitialState();
        }

        case "UNDO_MOVE": {
            if (state.moveHistory.length === 0) {
                return state;
            }

            chess.undo();

            return {
                ...state,
                fenString: chess.fen(),
                board: parseBoard(chess),
                currentTurn: chess.turn(),
                isCheck: chess.isCheck(),
                isCheckmate: chess.isCheckmate(),
                isDraw: chess.isDraw(),
                selectedPiece: null,
                validMoves: [],
                moveHistory: state.moveHistory.slice(0, -1),
                capturedPieces: {
                    w: state.capturedPieces.w.filter(
                        (_, index) =>
                            index <
                            state.capturedPieces.w.length -
                                (state.moveHistory[state.moveHistory.length - 1]
                                    ?.capturedPiece?.color === "w"
                                    ? 1
                                    : 0)
                    ),
                    b: state.capturedPieces.b.filter(
                        (_, index) =>
                            index <
                            state.capturedPieces.b.length -
                                (state.moveHistory[state.moveHistory.length - 1]
                                    ?.capturedPiece?.color === "b"
                                    ? 1
                                    : 0)
                    ),
                },
                currentMove: null,
                animatingPieces: new Map(),
            };
        }

        case "SET_POSITION": {
            const fen = action.payload;
            try {
                chess.load(fen);

                return {
                    ...state,
                    fenString: chess.fen(),
                    board: parseBoard(chess),
                    currentTurn: chess.turn(),
                    isCheck: chess.isCheck(),
                    isCheckmate: chess.isCheckmate(),
                    isDraw: chess.isDraw(),
                    selectedPiece: null,
                    validMoves: [],
                    moveHistory: [],
                    capturedPieces: {
                        w: [],
                        b: [],
                    },
                    currentMove: null,
                    animatingPieces: new Map(),
                };
            } catch (error) {
                console.error("Недопустимая FEN-строка:", error);
                return state;
            }
        }

        default:
            return state;
    }
};

type ChessContextType = {
    state: ChessGameState;
    selectPiece: (piece: ChessPiece | null) => void;
    makeMove: (from: Square, to: Square) => void;
    resetGame: () => void;
    undoMove: () => void;
    setPosition: (fen: string) => void;
};

const ChessContext = createContext<ChessContextType | undefined>(undefined);

export const ChessProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [state, dispatch] = useReducer(
        chessReducer,
        null,
        createInitialState
    );

    const selectPiece = (piece: ChessPiece | null) => {
        dispatch({ type: "SELECT_PIECE", payload: piece });
    };

    const makeMove = (from: Square, to: Square) => {
        dispatch({ type: "MAKE_MOVE", payload: { from, to } });
    };

    const resetGame = () => {
        dispatch({ type: "RESET_GAME" });
    };

    const undoMove = () => {
        dispatch({ type: "UNDO_MOVE" });
    };

    const setPosition = (fen: string) => {
        dispatch({ type: "SET_POSITION", payload: fen });
    };

    return (
        <ChessContext.Provider
            value={{
                state,
                selectPiece,
                makeMove,
                resetGame,
                undoMove,
                setPosition,
            }}
        >
            {children}
        </ChessContext.Provider>
    );
};

export const useChessContext = () => {
    const context = useContext(ChessContext);
    if (context === undefined) {
        throw new Error(
            "useEnhancedChessContext must be used within EnhancedChessProvider"
        );
    }
    return context;
};
