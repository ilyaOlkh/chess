import { PlayerRole } from "@/lib/auth/player-auth";
import { GameEvent } from "@/lib/redis/redis-pubsub";
import { PlayerColor, TurnData } from "@/lib/redis/redis-setup";
import { MoveData } from "@/types/chess-board";

export interface RequestResponse {
    success: boolean;
    gameStatus?: string;
    fenPosition?: string;
    lastMove?: TurnData;
    error?: string;
    playerTurn?: boolean;
    checkmate?: boolean;
    draw?: boolean;
    winner?: string;
    newToken?: string;
    opponentConnected?: boolean;
    playerRole?: PlayerRole;
    playerColor?: PlayerColor;
    playerId?: string;
    playerToken?: string;
    missedEvents?: GameEvent[];
}

const longPollingConstants = {
    retryDelay: 1000,
    gatewayTimeoutStatus: 504,
};

export interface LongPollOptions {
    onSuccess: (data: RequestResponse) => void;
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
    let controller: AbortController;

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

            const data: RequestResponse = await response.json();

            if (
                data.gameStatus === "completed" ||
                data.gameStatus === "aborted"
            ) {
                onSuccess(data);
                isPolling = false;
                return;
            }

            onSuccess(data);

            if (isPolling) {
                setTimeout(poll, longPollingConstants.retryDelay);
            }
        } catch (error) {
            if (!isPolling) return;

            if (error instanceof Error && error.name !== "AbortError") {
                onError(error);
            }

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

export async function makeOnlineMove(
    gameId: string,
    playerToken: string,
    moveData: MoveData
): Promise<RequestResponse> {
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
): Promise<RequestResponse> {
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
