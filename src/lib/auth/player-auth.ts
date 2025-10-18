import jwt from "jsonwebtoken";
import { getPlayerRemainingTimes, PlayerColor } from "../redis/redis-setup";
import { PlayerRole, playerRoles } from "@/constants/online-game";

export interface PlayerTokenPayload {
    gameId: string;
    playerId: string;
    playerColor?: PlayerColor;
    playerRole: PlayerRole;
    lastEventTimestamp?: number;
    iat?: number;
    exp?: number;
    playerTimes: {
        firstPlayer: {
            timeRemaining: number;
            lastMoveTimestamp: number;
        };
        secondPlayer: {
            timeRemaining: number;
            lastMoveTimestamp: number;
        };
    };
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

const TOKEN_EXPIRATION = "12h";

export function createPlayerToken(payload: PlayerTokenPayload) {
    if (!payload.exp)
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: TOKEN_EXPIRATION,
        });
    else {
        return jwt.sign(payload, JWT_SECRET);
    }
}

export function verifyPlayerToken(token: string) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as PlayerTokenPayload;
        return decoded;
    } catch (error) {
        console.error("Token verification failed:", error);
    }
}

export async function updatePlayerTokenTimestamp(
    tokenData: PlayerTokenPayload,
    timestamp: number
) {
    if (!tokenData) {
        throw new Error("Invalid token");
    }

    const playerTimes = (await getPlayerRemainingTimes(tokenData.gameId))!;

    const newPayload: PlayerTokenPayload = {
        ...tokenData,
        lastEventTimestamp: timestamp,
        playerTimes: playerTimes,
    };

    return createPlayerToken(newPayload);
}

export async function updatePlayerTimeAndTimestamp(
    tokenData: PlayerTokenPayload,
    timestamp: number
) {
    if (!tokenData) {
        throw new Error("Invalid token");
    }

    const playerTimes = (await getPlayerRemainingTimes(tokenData.gameId))!;

    const newPayload: PlayerTokenPayload = {
        ...tokenData,
        lastEventTimestamp: timestamp,
        playerTimes: playerTimes,
    };

    return createPlayerToken(newPayload);
}

export function hasMoveTimeExpired(tokenData: PlayerTokenPayload): boolean {
    if (tokenData.playerColor !== undefined) {
        const playerTimeData =
            tokenData.playerColor === "white"
                ? tokenData.playerTimes.firstPlayer
                : tokenData.playerTimes.secondPlayer;

        return playerTimeData.timeRemaining <= 0;
    }
    return false;
}

export function generatePlayerJoinToken(
    gameId: string,
    isFirstPlayer: boolean,
    moveTimeRemaining: number,
    firstPlayerColor: PlayerColor,
    playerId: string
): string {
    const playerRole = isFirstPlayer ? playerRoles.first : playerRoles.second;

    const playerColor: PlayerColor = isFirstPlayer
        ? firstPlayerColor
        : firstPlayerColor === "white"
        ? "black"
        : "white";

    const currentTimestamp = Date.now();

    const payload: PlayerTokenPayload = {
        gameId,
        playerId,
        playerColor,
        playerRole,
        lastEventTimestamp: currentTimestamp,
        playerTimes: {
            firstPlayer: {
                timeRemaining: moveTimeRemaining,
                lastMoveTimestamp: currentTimestamp,
            },
            secondPlayer: {
                timeRemaining: moveTimeRemaining,
                lastMoveTimestamp: currentTimestamp,
            },
        },
    };

    return createPlayerToken(payload);
}

export function generateSpectatorToken(gameId: string): string {
    const spectatorId = crypto.randomUUID();
    const currentTimestamp = Date.now();

    const payload: PlayerTokenPayload = {
        gameId,
        playerId: spectatorId,
        playerRole: playerRoles.spectator,
        lastEventTimestamp: currentTimestamp,
        playerTimes: {
            firstPlayer: {
                timeRemaining: 0,
                lastMoveTimestamp: currentTimestamp,
            },
            secondPlayer: {
                timeRemaining: 0,
                lastMoveTimestamp: currentTimestamp,
            },
        },
    };

    return createPlayerToken(payload);
}
