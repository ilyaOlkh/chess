import { PlayerRole } from "@/lib/auth/player-auth";
import { PlayerColor } from "@/lib/redis/redis-setup";
import { MoveData } from "@/types/chess-board";
import { PieceType } from "@/types/chess-game";
import { Square } from "chess.js";

export interface LongPollResponse {
    success: boolean;
    gameStatus?: string;
    fenPosition?: string;
    lastMove?: {
        from: Square;
        to: Square;
        promotion?: PieceType;
    };
    error?: string;
    playerTurn?: boolean;
    checkmate?: boolean;
    draw?: boolean;
    winner?: string | null;
    newToken?: string;
    opponentConnected?: boolean;
    playerRole?: PlayerRole;
    playerColor?: PlayerColor;
    playerId?: string;
    playerToken?: string;
}

const longPollingConstants = {
    retryDelay: 1000,
    gatewayTimeoutStatus: 504,
};

export interface LongPollOptions {
    onSuccess: (data: LongPollResponse) => void;
    onError: (error: Error) => void;
    gameId: string;
    playerToken: string;
    pollTimeoutMs?: number;
}

/**
 * Initiates a long polling connection to receive game updates
 */
export function startLongPolling({
    onSuccess,
    onError,
    gameId,
    playerToken,
}: // pollTimeoutMs = 30000,
LongPollOptions): { stopPolling: () => void } {
    let isPolling = true;
    let controller: AbortController | null = null;

    const poll = async (): Promise<void> => {
        if (!isPolling) return;

        try {
            controller = new AbortController();
            const signal = controller.signal;

            const response = await fetch(`/api/game/${gameId}/poll`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${playerToken}`,
                },
                signal,
                cache: "no-store",
            });

            if (!isPolling) return;

            // Handle game completion by status code first
            if (response.status === longPollingConstants.gatewayTimeoutStatus) {
                // Gateway timeout, just retry
                setTimeout(poll, longPollingConstants.retryDelay);
                return;
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to poll for game updates"
                );
            }

            const data: LongPollResponse = await response.json();

            // Check if the game has been completed or aborted
            if (
                data.gameStatus === "completed" ||
                data.gameStatus === "aborted"
            ) {
                // Process this final state update
                onSuccess(data);
                // Stop polling after game completion
                isPolling = false;
                return;
            }

            // Continue with normal processing
            onSuccess(data);

            // Continue polling
            if (isPolling) {
                setTimeout(poll, longPollingConstants.retryDelay);
            }
        } catch (error) {
            if (!isPolling) return;

            // Don't report abort errors
            if (error instanceof Error && error.name !== "AbortError") {
                onError(error);
            }

            // Continue polling even after errors (unless it's an abort)
            if (
                isPolling &&
                error instanceof Error &&
                error.name !== "AbortError"
            ) {
                setTimeout(poll, longPollingConstants.retryDelay);
            }
        }
    };

    // Start the initial poll
    poll();

    return {
        stopPolling: () => {
            isPolling = false;
            if (controller) {
                controller.abort();
            }
        },
    };
}

/**
 * Makes a move in the online game
 */
export async function makeOnlineMove(
    gameId: string,
    playerToken: string,
    moveData: MoveData
): Promise<LongPollResponse> {
    const response = await fetch(`/api/game/${gameId}/move`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({
            from: moveData.from,
            to: moveData.to,
            promotion: moveData.promotion,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to make move");
    }

    return response.json();
}

/**
 * Joins an existing game
 */
export async function joinGame(
    gameId: string,
    token?: string
): Promise<LongPollResponse> {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };

    // Если есть токен, добавляем его в заголовок
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/game/${gameId}/join`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to join game");
    }

    return data;
}

/**
 * Creates a new game
 */
export async function createGame(
    timeControl: number = 300
): Promise<{ gameId: string; playerToken: string; playerId: string }> {
    const response = await fetch("/api/game/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ timeControl }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to create game");
    }

    return data;
}

/**
 * Spectates a game
 */
export async function spectateGame(
    gameId: string
): Promise<{ spectatorToken: string }> {
    const response = await fetch(`/api/game/${gameId}/spectate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to spectate game");
    }

    return response.json();
}

/**
 * Checks if a game exists
 */
export async function checkGameExists(
    gameId: string
): Promise<{ exists: boolean; status?: string; startDate?: string }> {
    const response = await fetch(`/api/game/${gameId}/exists`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error("Failed to check if game exists");
    }

    return response.json();
}
