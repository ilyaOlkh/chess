import Redis from "ioredis";
import { TurnData } from "./redis-setup";
import { GameEventType, gameEventTypes } from "@/constants/online-game";

if (!process.env.UPSTASH_REDIS_URL) {
    throw "process.env.UPSTASH_REDIS_URL is undefined";
}

const redisPublisher = new Redis(process.env.UPSTASH_REDIS_URL);
const redisSubscriber = new Redis(process.env.UPSTASH_REDIS_URL);

interface PlayerJoinedData {
    playerId: string;
    playerRole: string;
}

interface GameStatusChangedData {
    status: string;
    winner?: string;
}

export interface GameEvent {
    type: GameEventType;
    gameId: string;
    data: PlayerJoinedData | TurnData | GameStatusChangedData;
    timestamp: number;
}

const getGameChannel = (gameId: string): string => `game:${gameId}:events`;
const getEventHistoryKey = (gameId: string): string =>
    `game:${gameId}:event_history`;
const getLastEventTimestampKey = (gameId: string): string =>
    `game:${gameId}:lastEventTimestamp`;

// How long to keep events in history (in seconds)
const EVENT_HISTORY_TTL = 60 * 60; // 1 hour

export async function getLastEventTimestamp(gameId: string): Promise<number> {
    const key = getLastEventTimestampKey(gameId);
    const timestamp = await redisPublisher.get(key);
    return timestamp ? parseInt(timestamp) : 0;
}

async function setLastEventTimestamp(
    gameId: string,
    timestamp: number
): Promise<void> {
    const key = getLastEventTimestampKey(gameId);
    await redisPublisher.set(key, timestamp.toString());
}

async function storeEventInHistory(event: GameEvent): Promise<void> {
    const key = getEventHistoryKey(event.gameId);
    await redisPublisher.zadd(key, event.timestamp, JSON.stringify(event));
    await redisPublisher.expire(key, EVENT_HISTORY_TTL);
}

export async function getEventsSince(
    gameId: string,
    timestamp: number
): Promise<GameEvent[]> {
    const key = getEventHistoryKey(gameId);
    const eventStrings = await redisPublisher.zrangebyscore(
        key,
        timestamp + 1,
        "+inf"
    );

    if (!eventStrings || eventStrings.length === 0) {
        return [];
    }

    return eventStrings.map((eventStr) => JSON.parse(eventStr) as GameEvent);
}

export async function publishGameEvent(
    event: Omit<GameEvent, "timestamp">
): Promise<void> {
    const channel = getGameChannel(event.gameId);
    const timestamp = Date.now();
    const fullEvent: GameEvent = {
        ...event,
        timestamp,
    };

    try {
        await redisPublisher.publish(channel, JSON.stringify(fullEvent));

        await storeEventInHistory(fullEvent);

        await setLastEventTimestamp(event.gameId, timestamp);
    } catch (error) {
        throw error;
    }
}

export function subscribeToGameEvents(
    gameId: string,
    callback: (event: GameEvent) => void
): () => Promise<void> {
    const channel = getGameChannel(gameId);

    redisSubscriber.on("message", (receivedChannel, message) => {
        if (receivedChannel === channel) {
            try {
                const event = JSON.parse(message) as GameEvent;
                callback(event);
            } catch (error) {
                console.error(
                    `Failed to parse message on channel ${channel}:`,
                    error
                );
            }
        }
    });

    redisSubscriber.subscribe(channel, (err) => {
        if (err) {
            console.error(`Error subscribing to channel ${channel}:`, err);
        }
    });

    return async () => {
        await redisSubscriber.unsubscribe(channel);
    };
}

export function waitForGameEvent(
    gameId: string,
    timeoutMs: number = 300000
): Promise<GameEvent | undefined> {
    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
            unsubscribe().then(() => {
                resolve(undefined);
            });
        }, timeoutMs);

        const unsubscribe = subscribeToGameEvents(gameId, (event) => {
            clearTimeout(timeoutId);
            unsubscribe().then(() => {
                resolve(event);
            });
        });
    });
}

export async function hasSubscribers(gameId: string): Promise<boolean> {
    const channel = getGameChannel(gameId);
    try {
        const numSub = await redisPublisher.pubsub("NUMSUB", channel);
        return Number(numSub[1]) > 0;
    } catch (error) {
        console.error(`Error checking subscribers for ${channel}:`, error);
        return false;
    }
}

export async function publishPlayerJoined(
    gameId: string,
    playerId: string,
    playerRole: string
): Promise<void> {
    await publishGameEvent({
        type: gameEventTypes.player_joined,
        gameId,
        data: {
            playerId,
            playerRole,
        },
    });
}

export async function publishMoveMade(turn: TurnData) {
    await publishGameEvent({
        type: gameEventTypes.move_made,
        gameId: turn.gameId,
        data: turn,
    });
}

export async function publishGameStatusChanged(
    gameId: string,
    status: string,
    winner?: string
): Promise<void> {
    await publishGameEvent({
        type: gameEventTypes.game_status_changed,
        gameId,
        data: {
            status,
            winner,
        },
    });
}
