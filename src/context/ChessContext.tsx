"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useReducer,
} from "react";
import { Chess, Square, Move } from "chess.js";
import {
    ChessGameState,
    ChessAction,
    ChessMove,
    PieceMovement,
    MoveType,
    ChessPiece,
    PieceColor,
    PieceType,
} from "@/types/chess-game";
import { ValidMove } from "@/types/chess-move";
import { chessGameConstants } from "@/constants/chess-game";
import {
    algebraicToPosition,
    getCapturedPieces,
    positionToAlgebraic,
} from "@/utilities/chess";
import { cellSize } from "@/constants/chess-board";
import { PendingPromotion } from "@/types/promotion";

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
    const initialFen = chess.fen();

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
        fenString: initialFen,
        pendingPromotion: null,
        fenHistory: [initialFen],
    };
};

const isPawnPromotion = (chess: Chess, from: Square, to: Square): boolean => {
    const piece = chess.get(from);
    if (!piece || piece.type !== "p") return false;

    const rank = to.charAt(1);
    return (
        (piece.color === "w" && rank === "8") ||
        (piece.color === "b" && rank === "1")
    );
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

            // Group moves by destination square to avoid duplicate highlights for promotion
            const movesByDestination = moves.reduce((acc, move) => {
                if (!acc[move.to]) {
                    acc[move.to] = move;
                }
                return acc;
            }, {} as Record<string, Move>);

            const validMoves: ValidMove[] = Object.values(
                movesByDestination
            ).map((move) => ({
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
            const { from, to } = action.payload;

            if (isPawnPromotion(chess, from, to)) {
                const toPos = algebraicToPosition(to as Square);
                const modalPosition = {
                    top: toPos.row * cellSize,
                    left: toPos.col * cellSize,
                };

                const pendingPromotion: PendingPromotion = {
                    from,
                    to,
                    position: modalPosition,
                };

                return {
                    ...state,
                    pendingPromotion,
                };
            }

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
                from: algebraicToPosition(from),
                to: algebraicToPosition(to),
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

            const newFen = chess.fen();

            return {
                ...state,
                fenString: newFen,
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
                fenHistory: [...state.fenHistory, newFen],
            };
        }

        case "SET_PENDING_PROMOTION": {
            return {
                ...state,
                pendingPromotion: action.payload,
            };
        }

        case "COMPLETE_PROMOTION": {
            if (!state.pendingPromotion) {
                return state;
            }

            const { from, to } = state.pendingPromotion;
            const { promotion } = action.payload;

            const moveDetails = chess.move({ from, to, promotion });

            if (!moveDetails) {
                return {
                    ...state,
                    pendingPromotion: null,
                };
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

            const newMove: ChessMove = {
                type: moveType,
                movements,
                notation: moveDetails.san,
                from: algebraicToPosition(from),
                to: algebraicToPosition(to),
            };

            const capturedPieces = { ...state.capturedPieces };
            if (moveDetails.captured) {
                const capturedColor: PieceColor =
                    moveDetails.color === "w" ? "b" : "w";
                const capturedPosition = algebraicToPosition(to);

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

            const newFen = chess.fen();

            return {
                ...state,
                fenString: newFen,
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
                pendingPromotion: null,
                fenHistory: [...state.fenHistory, newFen],
            };
        }

        case "RESET_GAME": {
            return createInitialState();
        }

        case "UNDO_MOVE": {
            if (
                state.moveHistory.length === 0 ||
                state.fenHistory.length <= 1
            ) {
                return state;
            }

            // Получаем предыдущий FEN из истории
            const previousFenHistory = state.fenHistory.slice(0, -1);
            const previousFen =
                previousFenHistory[previousFenHistory.length - 1];

            // Создаем новый экземпляр шахмат с предыдущей позицией
            const previousChess = new Chess(previousFen);

            return {
                ...state,
                fenString: previousFen,
                board: parseBoard(previousChess),
                currentTurn: previousChess.turn(),
                isCheck: previousChess.isCheck(),
                isCheckmate: previousChess.isCheckmate(),
                isDraw: previousChess.isDraw(),
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
                pendingPromotion: null,
                fenHistory: previousFenHistory,
            };
        }

        case "SET_POSITION": {
            const fen = action.payload;
            try {
                chess.load(fen);
                const newFen = chess.fen();

                return {
                    ...state,
                    fenString: newFen,
                    board: parseBoard(chess),
                    currentTurn: chess.turn(),
                    isCheck: chess.isCheck(),
                    isCheckmate: chess.isCheckmate(),
                    isDraw: chess.isDraw(),
                    selectedPiece: null,
                    validMoves: [],
                    moveHistory: [],
                    capturedPieces: getCapturedPieces(chess),
                    currentMove: null,
                    animatingPieces: new Map(),
                    pendingPromotion: null,
                    fenHistory: [newFen],
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
    makeMove: (from: Square, to: Square) => { isPawnPromotion: boolean };
    resetGame: () => void;
    undoMove: () => void;
    setPosition: (fen: string) => void;
    promotePawn: (pieceType: PieceType) => void;
    cancelPromotion: () => void;
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

    const selectPiece = useCallback((piece: ChessPiece | null) => {
        dispatch({ type: "SELECT_PIECE", payload: piece });
    }, []);

    const makeMove = useCallback(
        (from: Square, to: Square) => {
            const chess = new Chess(state.fenString);
            dispatch({ type: "MAKE_MOVE", payload: { from, to } });
            return { isPawnPromotion: isPawnPromotion(chess, from, to) };
        },
        [state.fenString]
    );

    const resetGame = useCallback(() => {
        dispatch({ type: "RESET_GAME" });
    }, []);

    const undoMove = useCallback(() => {
        dispatch({ type: "UNDO_MOVE" });
    }, []);

    const setPosition = useCallback((fen: string) => {
        dispatch({ type: "SET_POSITION", payload: fen });
    }, []);

    const promotePawn = useCallback((pieceType: PieceType) => {
        dispatch({
            type: "COMPLETE_PROMOTION",
            payload: { promotion: pieceType },
        });
    }, []);

    const cancelPromotion = useCallback(() => {
        dispatch({ type: "SET_PENDING_PROMOTION", payload: null });
    }, []);

    return (
        <ChessContext.Provider
            value={{
                state,
                selectPiece,
                makeMove,
                resetGame,
                undoMove,
                setPosition,
                promotePawn,
                cancelPromotion,
            }}
        >
            {children}
        </ChessContext.Provider>
    );
};

export const useChessContext = () => {
    const context = useContext(ChessContext);
    if (context === undefined) {
        throw new Error("useChessContext must be used within ChessProvider");
    }
    return context;
};
