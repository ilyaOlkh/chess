import { Redis } from "@upstash/redis";
import {
    publishGameStatusChanged,
    publishPlayerJoined,
    publishMoveMade,
} from "./redis-pubsub";
import { Square } from "chess.js";
import { PieceType } from "@/types/chess-game";
import { playerRoles } from "@/constants/online-game";

const redis = Redis.fromEnv();

export type GameStatus = "waiting" | "active" | "completed" | "aborted";
export type PlayerColor = "white" | "black";
export type Winner = "white" | "black" | "draw";

type WithIndexer = Record<string, unknown>;

export interface GameData extends WithIndexer {
    id: string;
    currentFen: string;
    startDate: string;
    endDate?: string;
    firstPlayerColor: PlayerColor;
    firstPlayerId?: string;
    secondPlayerId?: string;
    status: GameStatus;
    winner?: Winner;
    timeControl: number;
}

export interface TurnData extends WithIndexer {
    id: string;
    gameId: string;
    from: Square;
    to: Square;
    createTime: string;
    color: PlayerColor;
    promotion?: PieceType;
    currentFen: string;
}

const keyStructure = {
    game: (gameId: string) => `game:${gameId}`,
    gamesList: "games:list",
    turn: (turnId: string) => `turn:${turnId}`,
    gameTurns: (gameId: string) => `game:${gameId}:turns`,
    activeGames: "games:active",
    waitingGames: "games:waiting",
    completedGames: "games:completed",
    // Добавляем ключи для хранения времени игроков
    gameTime: (gameId: string) => `game:${gameId}:time`,
};

// Интерфейс для данных о времени игроков
export interface PlayerTimeData {
    firstPlayer: {
        timeRemaining: number;
        lastMoveTimestamp: number;
    };
    secondPlayer: {
        timeRemaining: number;
        lastMoveTimestamp: number;
    };
}

export async function createGame(gameData: GameData): Promise<string> {
    const gameId = crypto.randomUUID();

    const game: GameData = {
        ...gameData,
        id: gameId,
    };

    await redis.hset(keyStructure.game(gameId), game);

    await redis.lpush(keyStructure.gamesList, gameId);

    if (game.status === "waiting") {
        await redis.sadd(keyStructure.waitingGames, gameId);
    } else if (game.status === "active") {
        await redis.sadd(keyStructure.activeGames, gameId);
    }

    return gameId;
}

export async function updateGame(
    gameId: string,
    updateData: Partial<GameData>
): Promise<void> {
    const game = await getGame(gameId);

    if (!game) {
        throw new Error(`Game with ID ${gameId} not found`);
    }

    await redis.hset(keyStructure.game(gameId), updateData);

    if (updateData.secondPlayerId && !game.secondPlayerId) {
        await publishPlayerJoined(
            gameId,
            updateData.secondPlayerId,
            playerRoles.second
        );
    }

    if (updateData.status && updateData.status !== game.status) {
        if (game.status === "waiting") {
            await redis.srem(keyStructure.waitingGames, gameId);
        } else if (game.status === "active") {
            await redis.srem(keyStructure.activeGames, gameId);
        }

        if (updateData.status === "waiting") {
            await redis.sadd(keyStructure.waitingGames, gameId);
        } else if (updateData.status === "active") {
            await redis.sadd(keyStructure.activeGames, gameId);
        } else if (updateData.status === "completed") {
            await redis.sadd(keyStructure.completedGames, gameId);
        }

        await publishGameStatusChanged(
            gameId,
            updateData.status,
            updateData.winner || game.winner
        );
    }
}

export async function getGame(gameId: string) {
    const gameData = await redis.hgetall(keyStructure.game(gameId));
    if (gameData) {
        return gameData as GameData;
    }
}

export async function updateGameStatus(
    gameId: string,
    status: GameStatus,
    winner?: Winner
): Promise<void> {
    const game = await getGame(gameId);

    if (!game) {
        throw new Error(`Game with ID ${gameId} not found`);
    }

    if (game.status === "waiting") {
        await redis.srem(keyStructure.waitingGames, gameId);
    } else if (game.status === "active") {
        await redis.srem(keyStructure.activeGames, gameId);
    }

    await redis.hset(keyStructure.game(gameId), {
        status,
        winner,
        ...(status === "completed" || status === "aborted"
            ? { endDate: new Date().toISOString() }
            : {}),
    });

    if (status === "waiting") {
        await redis.sadd(keyStructure.waitingGames, gameId);
    } else if (status === "active") {
        await redis.sadd(keyStructure.activeGames, gameId);
    } else if (status === "completed") {
        await redis.sadd(keyStructure.completedGames, gameId);
    }
}

export async function updateGameFen(
    gameId: string,
    fen: string
): Promise<void> {
    await redis.hset(keyStructure.game(gameId), { currentFen: fen });
}

export async function createTurn(turnData: TurnData): Promise<string> {
    const turnId = crypto.randomUUID();

    const turn: TurnData = {
        ...turnData,
        id: turnId,
    };

    const turnKey = keyStructure.turn(turnId);

    const flatTurnData: Record<string, string> = {};
    for (const [key, value] of Object.entries(turn)) {
        flatTurnData[key] = !value ? "" : String(value);
    }

    await redis.hset(turnKey, flatTurnData);

    const turnsKey = keyStructure.gameTurns(turn.gameId);

    const score = new Date(turn.createTime).getTime();

    await redis.zadd(turnsKey, {
        score: score,
        member: turnId,
    });

    // Публикуем событие хода
    try {
        // Получаем текущую FEN позицию игры
        const game = await getGame(turn.gameId);
        if (game) {
            await publishMoveMade({ ...turn, id: turnId });
        }
    } catch (error) {
        console.error(`Error publishing move event: ${error}`);
        // Не даем ошибке прервать основной процесс
    }

    return turnId;
}

export async function getGameTurns(gameId: string): Promise<TurnData[]> {
    const turnIds: string[] = await redis.zrange(
        keyStructure.gameTurns(gameId),
        0,
        -1
    );

    if (!turnIds.length) {
        return [];
    }

    const turns: TurnData[] = await Promise.all(
        turnIds.map(async (id) => {
            const turnData = await redis.hgetall(keyStructure.turn(id));
            return turnData as TurnData;
        })
    );

    return turns;
}

export async function getLatestTurn(gameId: string) {
    const turnsKey = keyStructure.gameTurns(gameId);
    const turnIds: string[] = await redis.zrange(turnsKey, -1, -1);

    if (turnIds.length) {
        const turnKey = keyStructure.turn(turnIds[0]);
        const turnData = await redis.hgetall(turnKey);

        if (turnData && typeof turnData === "object") {
            return turnData as TurnData;
        }
    }
}

export async function getWaitingGames(): Promise<GameData[]> {
    const gameIds: string[] = await redis.smembers(keyStructure.waitingGames);

    if (!gameIds.length) {
        return [];
    }

    const games: GameData[] = await Promise.all(
        gameIds.map(async (id) => {
            const gameData = await redis.hgetall(keyStructure.game(id));
            return gameData as GameData;
        })
    );

    return games;
}

export async function cleanupOldGames(
    maxAgeInDays: number = 30
): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - maxAgeInDays);

    const gameIds = await redis.smembers(keyStructure.completedGames);
    let removedCount = 0;

    for (const gameId of gameIds) {
        const game = await getGame(gameId);

        if (game && game.endDate) {
            const endDate = new Date(game.endDate);

            if (endDate < cutoffTime) {
                const turnIds: string[] = await redis.zrange(
                    keyStructure.gameTurns(gameId),
                    0,
                    -1
                );

                for (const turnId of turnIds) {
                    await redis.del(keyStructure.turn(turnId));
                }

                await redis.del(keyStructure.gameTurns(gameId));
                await redis.del(keyStructure.game(gameId));
                await redis.srem(keyStructure.completedGames, gameId);
                await redis.lrem(keyStructure.gamesList, 0, gameId);

                removedCount++;
            }
        }
    }

    return removedCount;
}

export async function updatePlayerTimes(
    gameId: string,
    timeData: PlayerTimeData
): Promise<void> {
    await redis.hset(
        keyStructure.gameTime(gameId),
        timeData as unknown as Record<string, unknown>
    );
}

export async function getPlayerRemainingTimes(gameId: string) {
    const timeData = (await redis.hgetall(
        keyStructure.gameTime(gameId)
    )) as unknown as PlayerTimeData;

    if (!timeData || Object.keys(timeData).length === 0) {
        const game = await getGame(gameId);
        if (game) {
            const currentTime = Date.now();
            const initialTime = game.timeControl;

            const newTimeData: PlayerTimeData = {
                firstPlayer: {
                    timeRemaining: initialTime,
                    lastMoveTimestamp: currentTime,
                },
                secondPlayer: {
                    timeRemaining: initialTime,
                    lastMoveTimestamp: currentTime,
                },
            };

            await updatePlayerTimes(gameId, newTimeData);
            return newTimeData;
        }
        return;
    }

    return {
        firstPlayer: {
            timeRemaining: timeData.firstPlayer.timeRemaining,
            lastMoveTimestamp: timeData.firstPlayer.lastMoveTimestamp,
        },
        secondPlayer: {
            timeRemaining: timeData.secondPlayer.timeRemaining,
            lastMoveTimestamp: timeData.secondPlayer.lastMoveTimestamp,
        },
    };
}

export async function updatePlayerTimeAfterMove(
    gameId: string,
    color: PlayerColor
) {
    const timeData = await getPlayerRemainingTimes(gameId);
    if (!timeData) return;

    const currentTime = Date.now();

    if (color === "white") {
        const elapsedTime =
            currentTime - timeData.firstPlayer.lastMoveTimestamp;
        timeData.firstPlayer.timeRemaining = Math.max(
            0,
            timeData.firstPlayer.timeRemaining - elapsedTime
        );
        timeData.firstPlayer.lastMoveTimestamp = currentTime;
    } else {
        const elapsedTime =
            currentTime - timeData.secondPlayer.lastMoveTimestamp;
        timeData.secondPlayer.timeRemaining = Math.max(
            0,
            timeData.secondPlayer.timeRemaining - elapsedTime
        );
        timeData.secondPlayer.lastMoveTimestamp = currentTime;
    }

    await updatePlayerTimes(gameId, timeData);
    return timeData;
}
