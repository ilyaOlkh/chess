import jwt from "jsonwebtoken";
import { PlayerColor } from "../redis/redis-setup";

// Define player roles
export type PlayerRole = "first" | "second" | "spectator";

export interface PlayerTokenPayload {
    gameId: string;
    playerId: string;
    playerColor: PlayerColor | null; // Null for spectators
    playerRole: PlayerRole;
    issuedAt: number; // Unix timestamp
    moveTimeRemaining: number | null; // In seconds, null for spectators
    lastEventTimestamp: number; // Timestamp of the last processed event
    iat?: number;
    exp?: number;
}

// Get the secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

// Token expiration settings (long enough for a chess game)
const TOKEN_EXPIRATION = "12h";

/**
 * Creates a JWT token for a player
 */
export function createPlayerToken(payload: PlayerTokenPayload): string {
    if (!payload.exp)
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: TOKEN_EXPIRATION,
        });
    else {
        return jwt.sign(payload, JWT_SECRET);
    }
}

/**
 * Verifies and decodes a player token
 */
export function verifyPlayerToken(token: string): PlayerTokenPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as PlayerTokenPayload;
        return decoded;
    } catch (error) {
        console.error("Token verification failed:", error);
        return null;
    }
}

/**
 * Updates the move time remaining in a player's token
 */
export function updatePlayerMoveTime(
    token: string,
    timeRemaining: number
): string {
    const payload = verifyPlayerToken(token);

    if (!payload) {
        throw new Error("Invalid token");
    }

    // Create a new token with updated time
    const newPayload: PlayerTokenPayload = {
        ...payload,
        moveTimeRemaining: timeRemaining,
        issuedAt: Math.floor(Date.now() / 1000),
    };

    return createPlayerToken(newPayload);
}

/**
 * Updates the player token with a new last event timestamp
 */
export function updatePlayerTokenTimestamp(
    token: string,
    timestamp: number
): string {
    const payload = verifyPlayerToken(token);

    if (!payload) {
        throw new Error("Invalid token");
    }

    // Create a new token with updated timestamp
    const newPayload: PlayerTokenPayload = {
        ...payload,
        lastEventTimestamp: timestamp,
    };

    return createPlayerToken(newPayload);
}

/**
 * Updates both move time and last event timestamp in a player's token
 */
export function updatePlayerTimeAndTimestamp(
    token: string,
    timeRemaining: number,
    timestamp: number
): string {
    const payload = verifyPlayerToken(token);

    if (!payload) {
        throw new Error("Invalid token");
    }

    // Create a new token with updated time and timestamp
    const newPayload: PlayerTokenPayload = {
        ...payload,
        moveTimeRemaining: timeRemaining,
        issuedAt: Math.floor(Date.now() / 1000),
        lastEventTimestamp: timestamp,
    };

    return createPlayerToken(newPayload);
}

/**
 * Checks if a player's move time has expired
 */
export function hasMoveTimeExpired(token: string): boolean {
    const payload = verifyPlayerToken(token);

    if (!payload || payload.moveTimeRemaining === null) {
        return false; // Spectators don't have time constraints
    }

    const secondsElapsed = Math.floor(Date.now() / 1000) - payload.issuedAt;
    return secondsElapsed > payload.moveTimeRemaining;
}

/**
 * Handles player joining a game
 */
export function generatePlayerJoinToken(
    gameId: string,
    isFirstPlayer: boolean,
    timeControl: number,
    firstPlayerColor: PlayerColor,
    playerId: string
): string {
    const playerRole: PlayerRole = isFirstPlayer ? "first" : "second";

    // Determine player color based on role and first player's color
    const playerColor: PlayerColor = isFirstPlayer
        ? firstPlayerColor
        : firstPlayerColor === "white"
        ? "black"
        : "white";

    const payload: PlayerTokenPayload = {
        gameId,
        playerId,
        playerColor,
        playerRole,
        issuedAt: Math.floor(Date.now() / 1000),
        moveTimeRemaining: timeControl,
        lastEventTimestamp: Date.now(),
    };

    return createPlayerToken(payload);
}

/**
 * Generates a spectator token
 */
export function generateSpectatorToken(gameId: string): string {
    const spectatorId = crypto.randomUUID();

    const payload: PlayerTokenPayload = {
        gameId,
        playerId: spectatorId,
        playerColor: null,
        playerRole: "spectator",
        issuedAt: Math.floor(Date.now() / 1000),
        moveTimeRemaining: null,
        lastEventTimestamp: Date.now(),
    };

    return createPlayerToken(payload);
}
