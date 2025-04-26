import { useState, useEffect, useCallback } from "react";
import { MoveData } from "@/types/chess-board";
import {
    startLongPolling,
    makeOnlineMove,
    joinGame,
    createGame,
    RequestResponse,
} from "@/services/longPollingService";
import { useChessContext } from "@/context/ChessContext";
import { PlayerRole, playerRoles } from "@/constants/online-game";
import { PlayerColor } from "@/constants/chess-game";

export type GameStatus =
    | "connecting"
    | "waiting"
    | "active"
    | "completed"
    | "aborted"
    | "error";

export interface OnlineGameState {
    status: GameStatus;
    playerColor?: PlayerColor;
    playerRole: PlayerRole;
    isPlayerTurn: boolean;
    currentTurn: PlayerColor;
    lastMove?: {
        from: string;
        to: string;
        promotion?: string;
    };
    opponentConnected: boolean;
    error?: string;
    isCheckmate: boolean;
    isDraw: boolean;
    winner?: string;
    playerId?: string;
}

export interface UseOnlineGameProps {
    gameId: string;
}

export function useOnlineGame({ gameId }: UseOnlineGameProps) {
    const {
        makeMove: makeIntermalMove,
        promotePawn,
        setPosition,
    } = useChessContext();
    const [gameState, setGameState] = useState<OnlineGameState>({
        status: "connecting",
        playerColor: "white",
        playerRole: playerRoles.spectator,
        isPlayerTurn: false,
        currentTurn: "white",
        opponentConnected: false,
        isCheckmate: false,
        isDraw: false,
    });

    // JWT токен для аутентификации
    const [playerToken, setPlayerToken] = useState<string>();

    // Флаг инициализации
    const [initialized, setInitialized] = useState(false);

    // Обновление состояния игры на основе данных от long polling
    const handleGameUpdate = useCallback(
        (data: RequestResponse) => {
            // Извлечь текущий ход из FEN если доступен
            let currentTurn: PlayerColor = "white";
            if (data.fenPosition) {
                const fenParts = data.fenPosition.split(" ");
                if (fenParts.length > 1) {
                    currentTurn = fenParts[1] === "w" ? "white" : "black";
                }
            }

            const lastMove = data.lastMove;
            if (
                lastMove &&
                (data.playerTurn ||
                    gameState.playerRole === playerRoles.spectator)
            ) {
                makeIntermalMove(lastMove.from, lastMove.to);
                if (lastMove.promotion) {
                    promotePawn(lastMove.promotion);
                }
            }

            setGameState((prev) => ({
                ...prev,
                status: (data.gameStatus as GameStatus) || prev.status,
                lastMove: data.lastMove || prev.lastMove,
                isPlayerTurn: data.playerTurn ?? prev.isPlayerTurn,
                currentTurn,
                opponentConnected:
                    data.opponentConnected ?? prev.opponentConnected,
                error: data.error,
                isCheckmate: data.checkmate || false,
                isDraw: data.draw || false,
                winner: data.winner,
            }));

            // Если получен новый токен, обновить его
            if (data.newToken) {
                setPlayerToken(data.newToken);
                localStorage.setItem(`chess_token_${gameId}`, data.newToken);
            }
        },
        [gameId, makeIntermalMove, promotePawn, gameState.playerRole]
    );

    // Инициализация подключения к игре
    useEffect(() => {
        if (!gameId || initialized) return;

        const initializeGame = async () => {
            try {
                // Проверяем, есть ли сохраненный токен для этой игры
                const savedToken = localStorage.getItem(
                    `chess_token_${gameId}`
                );

                const response = await joinGame(
                    gameId,
                    savedToken || undefined
                );

                if (response.error) {
                    throw new Error(response.error);
                }

                if (response.playerToken) {
                    setPlayerToken(response.playerToken);
                    localStorage.setItem(
                        `chess_token_${gameId}`,
                        response.playerToken
                    );

                    setGameState((prev) => ({
                        ...prev,
                        playerRole:
                            response.playerRole || playerRoles.spectator,
                        playerColor: response.playerColor,
                        playerId: response.playerId,
                        isPlayerTurn: !!response.playerTurn,
                        status:
                            (response.gameStatus as GameStatus) || "waiting",
                        opponentConnected: response.opponentConnected || false,
                    }));
                }

                if (response.fenPosition) {
                    setPosition(response.fenPosition);
                }

                setInitialized(true);
            } catch (error) {
                console.error("Error initializing game:", error);
                setGameState((prev) => ({
                    ...prev,
                    status: "error",
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to join the game",
                }));
            }
        };

        initializeGame();
    }, [gameId, initialized, setPosition]);

    // Запуск long polling при наличии токена
    useEffect(() => {
        if (!playerToken || !gameId || !initialized) return;

        const pollingController = startLongPolling({
            gameId,
            playerToken,
            onSuccess: handleGameUpdate,
            onError: (error) => {
                console.error("Long polling error:", error);

                // Если токен недействителен, удаляем его
                if (
                    error.message.includes("token") ||
                    error.message.includes("unauthorized") ||
                    error.message.includes("invalid")
                ) {
                    localStorage.removeItem(`chess_token_${gameId}`);
                    setPlayerToken(undefined);
                }

                setGameState((prev) => ({
                    ...prev,
                    error: error.message,
                }));
            },
        });

        return () => {
            pollingController.stopPolling();
        };
    }, [gameId, playerToken, initialized, handleGameUpdate]);

    // Функция для выполнения хода
    const makeMove = useCallback(
        async (moveData: MoveData) => {
            if (!playerToken || !gameState.isPlayerTurn) {
                console.warn("Cannot make move: no token or not player's turn");
                return false;
            }

            try {
                const response = await makeOnlineMove(
                    gameId,
                    playerToken,
                    moveData
                );

                if (!response.success) {
                    throw new Error(response.error || "Failed to make move");
                }

                // Обновляем состояние на основе ответа
                handleGameUpdate({ ...response, playerTurn: false });
                return true;
            } catch (error) {
                console.error("Error making move:", error);
                setGameState((prev) => ({
                    ...prev,
                    isPlayerTurn: true,
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to make move",
                }));
                return false;
            }
        },
        [gameId, playerToken, gameState.isPlayerTurn, handleGameUpdate]
    );

    // Функция для создания новой игры
    const createNewGame = useCallback(async (timeControl: number = 300) => {
        try {
            const response = await createGame(timeControl);

            if (!response.gameId || !response.playerToken) {
                throw new Error("Failed to create game: invalid response");
            }

            // Сохраняем токен для новой игры
            localStorage.setItem(
                `chess_token_${response.gameId}`,
                response.playerToken
            );

            return response.gameId;
        } catch (error) {
            console.error("Error creating game:", error);
            setGameState((prev) => ({
                ...prev,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create game",
            }));
        }
    }, []);

    return {
        gameState,
        makeMove,
        createNewGame,
        playerToken,
    };
}
