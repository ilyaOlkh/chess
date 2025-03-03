import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL || "",
    token: process.env.UPSTASH_REDIS_TOKEN || "",
});

export type GameStatus = "waiting" | "active" | "completed" | "aborted";
export type PlayerColor = "white" | "black";
export type Winner = null | "white" | "black" | "draw";

type WithIndexer = Record<string, unknown>;

export interface GameData extends WithIndexer {
    id: string;
    currentFen: string;
    startDate: string;
    endDate: string | null;
    firstPlayerColor: PlayerColor;
    status: GameStatus;
    winner: Winner;
    timeControl: number;
}

export interface TurnData extends WithIndexer {
    id: string;
    gameId: string;
    from: string;
    to: string;
    createTime: string;
    color: PlayerColor;
    promotionPiece: string | null;
}

const keyStructure = {
    game: (gameId: string) => `game:${gameId}`,
    gamesList: "games:list",
    turn: (turnId: string) => `turn:${turnId}`,
    gameTurns: (gameId: string) => `game:${gameId}:turns`,
    activeGames: "games:active",
    waitingGames: "games:waiting",
    completedGames: "games:completed",
};

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

export async function getGame(gameId: string): Promise<GameData | null> {
    const gameData = await redis.hgetall(keyStructure.game(gameId));
    return (gameData as GameData) || null;
}

export async function updateGameStatus(
    gameId: string,
    status: GameStatus,
    winner: Winner = null
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

    await redis.hset(keyStructure.turn(turnId), turn);

    await redis.zadd(keyStructure.gameTurns(turn.gameId), {
        score: new Date(turn.createTime).getTime(),
        member: turnId,
    });

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

export async function getLatestTurn(gameId: string): Promise<TurnData | null> {
    const turnIds: string[] = await redis.zrange(
        keyStructure.gameTurns(gameId),
        -1,
        -1
    );

    if (!turnIds.length) {
        return null;
    }

    const turnData = await redis.hgetall(keyStructure.turn(turnIds[0]));
    return (turnData as TurnData) || null;
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
