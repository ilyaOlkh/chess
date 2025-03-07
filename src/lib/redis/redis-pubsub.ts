import Redis from "ioredis";

if (!process.env.UPSTASH_REDIS_URL) {
    throw "process.env.UPSTASH_REDIS_URL is undefined";
}

// Create an Upstash Redis Subscriber instance
const redisPublisher = new Redis(process.env.UPSTASH_REDIS_URL);
const redisSubscriber = new Redis(process.env.UPSTASH_REDIS_URL);

// Типы событий
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

// Формирование имени канала
export function getGameChannel(gameId: string): string {
    return `game:${gameId}:events`;
}

/**
 * Публикация события в канал игры
 */
export async function publishGameEvent(
    event: Omit<GameEvent, "timestamp">
): Promise<void> {
    const channel = getGameChannel(event.gameId);
    const fullEvent: GameEvent = {
        ...event,
        timestamp: Date.now(),
    };

    console.log(`Publishing event to ${channel}:`, fullEvent);

    try {
        await redisPublisher.publish(channel, JSON.stringify(fullEvent));
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

    // Настраиваем обработчик сообщений
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

    // Подписываемся на канал
    redisSubscriber.subscribe(channel, (err) => {
        if (err) {
            console.error(`Error subscribing to channel ${channel}:`, err);
        } else {
            console.log(`Successfully subscribed to channel ${channel}`);
        }
    });

    // Возвращаем функцию для отписки
    return async () => {
        await redisSubscriber.unsubscribe(channel);
        console.log(`Unsubscribed from channel ${channel}`);
    };
}

/**
 * Ожидание события в канале игры с таймаутом
 * Использует блокирующий подход для long polling
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

        // Устанавливаем таймер для таймаута
        const timeoutId = setTimeout(() => {
            unsubscribe().then(() => {
                console.log(
                    `Timeout reached while waiting for event on channel ${channel}`
                );
                resolve(null);
            });
        }, timeoutMs);

        // Подписываемся на канал и настраиваем обработчик
        const unsubscribe = subscribeToGameEvents(gameId, (event) => {
            clearTimeout(timeoutId);
            unsubscribe().then(() => {
                resolve(event);
            });
        });
    });
}

/**
 * Проверка наличия подписчиков в канале
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
 * Инициализация событий для публикации в разных частях приложения
 */

// Публикация события при присоединении игрока
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

// Публикация события при выполнении хода
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

// Публикация события при изменении статуса игры
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
