import Redis from "ioredis";

if (!process.env.UPSTASH_REDIS_URL) {
    throw "process.env.UPSTASH_REDIS_URL is undefined";
}

// Create an Upstash Redis Subscriber instance
const redisPublisher = new Redis(process.env.UPSTASH_REDIS_URL);
const redisSubscriber = new Redis(process.env.UPSTASH_REDIS_URL);

// Game event types
export type GameEventType =
    | "player_joined"
    | "move_made"
    | "game_status_changed";

interface PlayerJoinedData {
    playerId: string;
    playerRole: string;
}

interface MoveMadeData {
    turnId: string;
    from: string;
    to: string;
    color: string;
    fen: string;
}

interface GameStatusChangedData {
    status: string;
    winner: string | null;
}

export interface GameEvent {
    type: GameEventType;
    gameId: string;
    data: PlayerJoinedData | MoveMadeData | GameStatusChangedData;
    timestamp: number;
}

// Redis key structures
const getGameChannel = (gameId: string): string => `game:${gameId}:events`;
const getEventHistoryKey = (gameId: string): string =>
    `game:${gameId}:event_history`;
const getLastEventTimestampKey = (gameId: string): string =>
    `game:${gameId}:lastEventTimestamp`;

// How long to keep events in history (in seconds)
const EVENT_HISTORY_TTL = 60 * 60; // 1 hour

/**
 * Gets the timestamp of the last event for a game
 */
export async function getLastEventTimestamp(gameId: string): Promise<number> {
    const key = getLastEventTimestampKey(gameId);
    const timestamp = await redisPublisher.get(key);
    return timestamp ? parseInt(timestamp) : 0;
}

/**
 * Sets the timestamp of the last event for a game
 */
async function setLastEventTimestamp(
    gameId: string,
    timestamp: number
): Promise<void> {
    const key = getLastEventTimestampKey(gameId);
    await redisPublisher.set(key, timestamp.toString());
}

/**
 * Stores an event in the event history
 */
async function storeEventInHistory(event: GameEvent): Promise<void> {
    const key = getEventHistoryKey(event.gameId);
    await redisPublisher.zadd(key, event.timestamp, JSON.stringify(event));
    // Set expiration on history to prevent unlimited growth
    await redisPublisher.expire(key, EVENT_HISTORY_TTL);
}

/**
 * Gets all events after a specific timestamp
 */
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

/**
 * Publish an event to the game channel and store in history
 */
export async function publishGameEvent(
    event: Omit<GameEvent, "timestamp">
): Promise<void> {
    const channel = getGameChannel(event.gameId);
    const timestamp = Date.now();
    const fullEvent: GameEvent = {
        ...event,
        timestamp,
    };

    console.log(`Publishing event to ${channel}:`, fullEvent);

    try {
        // Publish to subscribers
        await redisPublisher.publish(channel, JSON.stringify(fullEvent));

        // Store in event history
        await storeEventInHistory(fullEvent);

        // Update last event timestamp
        await setLastEventTimestamp(event.gameId, timestamp);

        console.log(`Event published successfully to ${channel}`);
    } catch (error) {
        console.error(`Failed to publish event to ${channel}:`, error);
        throw error;
    }
}

export function subscribeToGameEvents(
    gameId: string,
    callback: (event: GameEvent) => void
): () => Promise<void> {
    const channel = getGameChannel(gameId);
    console.log(`Subscribing to game events on channel ${channel}`);

    // Set up message handler
    redisSubscriber.on("message", (receivedChannel, message) => {
        if (receivedChannel === channel) {
            try {
                const event = JSON.parse(message) as GameEvent;
                console.log(`Received event on channel ${channel}:`, event);
                callback(event);
            } catch (error) {
                console.error(
                    `Failed to parse message on channel ${channel}:`,
                    error
                );
            }
        }
    });

    // Subscribe to channel
    redisSubscriber.subscribe(channel, (err) => {
        if (err) {
            console.error(`Error subscribing to channel ${channel}:`, err);
        } else {
            console.log(`Successfully subscribed to channel ${channel}`);
        }
    });

    // Return unsubscribe function
    return async () => {
        await redisSubscriber.unsubscribe(channel);
        console.log(`Unsubscribed from channel ${channel}`);
    };
}

/**
 * Wait for a game event with timeout
 * Uses a blocking approach for long polling
 */
export function waitForGameEvent(
    gameId: string,
    timeoutMs: number = 30000
): Promise<GameEvent | null> {
    return new Promise((resolve) => {
        const channel = getGameChannel(gameId);
        console.log(
            `Waiting for event on channel ${channel} with timeout ${timeoutMs}ms`
        );

        // Set timeout timer
        const timeoutId = setTimeout(() => {
            unsubscribe().then(() => {
                console.log(
                    `Timeout reached while waiting for event on channel ${channel}`
                );
                resolve(null);
            });
        }, timeoutMs);

        // Subscribe to channel and set up handler
        const unsubscribe = subscribeToGameEvents(gameId, (event) => {
            clearTimeout(timeoutId);
            unsubscribe().then(() => {
                resolve(event);
            });
        });
    });
}

/**
 * Check if there are subscribers to a channel
 */
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

/**
 * Event publication functions for different parts of the application
 */

// Publish player joined event
export async function publishPlayerJoined(
    gameId: string,
    playerId: string,
    playerRole: string
): Promise<void> {
    await publishGameEvent({
        type: "player_joined",
        gameId,
        data: {
            playerId,
            playerRole,
        },
    });
}

// Publish move made event
export async function publishMoveMade(
    gameId: string,
    turnId: string,
    from: string,
    to: string,
    color: string,
    fen: string
): Promise<void> {
    await publishGameEvent({
        type: "move_made",
        gameId,
        data: {
            turnId,
            from,
            to,
            color,
            fen,
        },
    });
}

// Publish game status changed event
export async function publishGameStatusChanged(
    gameId: string,
    status: string,
    winner: string | null = null
): Promise<void> {
    await publishGameEvent({
        type: "game_status_changed",
        gameId,
        data: {
            status,
            winner,
        },
    });
}
