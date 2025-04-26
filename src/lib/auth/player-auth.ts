import jwt from "jsonwebtoken";
import { PlayerColor } from "../redis/redis-setup";
import { PlayerRole, playerRoles } from "@/constants/online-game";

export interface PlayerTokenPayload {
    gameId: string;
    playerId: string;
    playerColor?: PlayerColor;
    playerRole: PlayerRole;
    issuedAt: number; // Unix timestamp
    moveTimeRemaining?: number; // In seconds, null for spectators
    lastEventTimestamp?: number; // Timestamp of the last processed event
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
export function createPlayerToken(payload: PlayerTokenPayload) {
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
export function verifyPlayerToken(token: string) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as PlayerTokenPayload;
        return decoded;
    } catch (error) {
        console.error("Token verification failed:", error);
    }
}

export function updatePlayerMoveTime(
    token: string,
    timeRemaining: number
): string {
    const payload = verifyPlayerToken(token);

    if (!payload) {
        throw new Error("Invalid token");
    }

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
    tokenData: PlayerTokenPayload,
    timestamp: number
): string {
    if (!tokenData) {
        throw new Error("Invalid token");
    }

    // Create a new token with updated timestamp
    const newPayload: PlayerTokenPayload = {
        ...tokenData,
        lastEventTimestamp: timestamp,
    };

    return createPlayerToken(newPayload);
}

/**
 * Updates both move time and last event timestamp in a player's token
 */
export function updatePlayerTimeAndTimestamp(
    tokenData: PlayerTokenPayload,
    timeRemaining: number,
    timestamp: number
): string {
    if (!tokenData) {
        throw new Error("Invalid token");
    }

    // Create a new token with updated time and timestamp
    const newPayload: PlayerTokenPayload = {
        ...tokenData,
        moveTimeRemaining: timeRemaining,
        issuedAt: Math.floor(Date.now() / 1000),
        lastEventTimestamp: timestamp,
    };

    return createPlayerToken(newPayload);
}

export function hasMoveTimeExpired(tokenData: PlayerTokenPayload): boolean {
    if (!tokenData?.moveTimeRemaining) {
        return false;
    }

    const secondsElapsed = Math.floor(Date.now() / 1000) - tokenData.issuedAt;
    return secondsElapsed > tokenData.moveTimeRemaining;
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
    const playerRole = isFirstPlayer ? playerRoles.first : playerRoles.second;

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

export function generateSpectatorToken(gameId: string): string {
    const spectatorId = crypto.randomUUID();

    const payload: PlayerTokenPayload = {
        gameId,
        playerId: spectatorId,
        playerRole: playerRoles.spectator,
        issuedAt: Math.floor(Date.now() / 1000),
        lastEventTimestamp: Date.now(),
    };

    return createPlayerToken(payload);
}
