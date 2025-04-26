import { Chess, Square } from "chess.js";
import {
    GameData,
    TurnData,
    PlayerColor,
    Winner,
    createGame,
    getGame,
    updateGameStatus,
    updateGameFen,
    createTurn,
    getWaitingGames,
    updateGame,
} from "@/lib/redis/redis-setup";
import {
    generatePlayerJoinToken,
    generateSpectatorToken,
    verifyPlayerToken,
    updatePlayerMoveTime,
    hasMoveTimeExpired,
} from "@/lib/auth/player-auth";
import { createError } from "@server/response/error";
import { PieceType } from "@/types/chess-game";

export async function createNewGame(
    timeControl: number,
    firstPlayerColor: PlayerColor = "white"
): Promise<{
    gameId: string;
    playerToken: string;
    playerId: string;
}> {
    // Default starting FEN position
    const initialFen =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    // Generate a unique player ID
    const firstPlayerId = crypto.randomUUID();

    const gameData: GameData = {
        id: "",
        currentFen: initialFen,
        startDate: new Date().toISOString(),
        firstPlayerColor,
        firstPlayerId,
        status: "waiting",
        timeControl,
    };

    const gameId = await createGame(gameData);

    // Generate player token for the first player
    const playerToken = generatePlayerJoinToken(
        gameId,
        true,
        timeControl,
        firstPlayerColor,
        firstPlayerId
    );

    return { gameId, playerToken, playerId: firstPlayerId };
}

/**
 * Join an existing game as the second player
 */
export async function joinGame(gameId: string): Promise<{
    playerToken?: string;
    playerId?: string;
    error?: string;
}> {
    const game = await getGame(gameId);

    if (!game) {
        return { error: "Game not found" };
    }

    if (game.status !== "waiting") {
        return {
            error: "Game is not in waiting status",
        };
    }

    if (game.secondPlayerId) {
        return {
            error: "Game already has a second player",
        };
    }

    // Generate a unique player ID for the second player
    const secondPlayerId = crypto.randomUUID();

    // Update game with the second player ID and change status to active
    await updateGame(gameId, {
        secondPlayerId,
        status: "active",
    });

    // Generate player token for the second player
    const playerToken = generatePlayerJoinToken(
        gameId,
        false,
        game.timeControl,
        game.firstPlayerColor,
        secondPlayerId
    );

    return { playerToken, playerId: secondPlayerId };
}

export async function spectateGame(gameId: string): Promise<{
    spectatorToken: string;
    error?: string;
}> {
    const game = await getGame(gameId);

    if (!game) {
        throw createError("Game not found", 404);
    }

    const spectatorToken = generateSpectatorToken(gameId);

    return { spectatorToken };
}

export async function makeMove(
    token: string,
    from: Square,
    to: Square,
    promotion?: PieceType
): Promise<{
    success: boolean;
    error?: string;
    newFen?: string;
    isGameOver?: boolean;
    gameResult?: Winner;
    newToken?: string;
}> {
    // Verify player token
    const tokenData = verifyPlayerToken(token);

    if (!tokenData) {
        return { success: false, error: "Invalid token" };
    }

    // Check if move time has expired
    if (hasMoveTimeExpired(token)) {
        // Game over due to time expiration
        const loserColor = tokenData.playerColor;
        const winnerColor = loserColor === "white" ? "black" : "white";

        await updateGameStatus(
            tokenData.gameId,
            "completed",
            winnerColor as Winner
        );

        return {
            success: false,
            error: "Move time expired",
            isGameOver: true,
            gameResult: winnerColor as Winner,
        };
    }

    const gameId = tokenData.gameId;
    const game = await getGame(gameId);

    if (!game) {
        return { success: false, error: "Game not found" };
    }

    if (game.status !== "active") {
        return { success: false, error: "Game is not active" };
    }

    const chess = new Chess(game.currentFen);
    const currentTurn = chess.turn() === "w" ? "white" : "black";

    if (tokenData.playerColor !== currentTurn) {
        return { success: false, error: "Not your turn" };
    }

    try {
        const moveResult = chess.move({
            from: from,
            to: to,
            promotion: promotion,
        });

        if (!moveResult) {
            return { success: false, error: "Invalid move" };
        }

        let gameOver = false;
        let gameResult: Winner | undefined;

        if (chess.isCheckmate()) {
            gameOver = true;
            gameResult = currentTurn;
            await updateGameStatus(gameId, "completed", gameResult);
        } else if (chess.isDraw()) {
            gameOver = true;
            gameResult = "draw";
            await updateGameStatus(gameId, "completed", gameResult);
        }

        const newFen = chess.fen();
        await updateGameFen(gameId, newFen);

        const turnData: TurnData = {
            id: "",
            gameId,
            from,
            to,
            createTime: new Date().toISOString(),
            color: currentTurn,
            promotion: promotion,
            currentFen: newFen,
        };

        await createTurn(turnData);

        return {
            success: true,
            newFen,
            isGameOver: gameOver,
            gameResult,
            newToken: updatePlayerMoveTime(token, game.timeControl + 1), // +1 second buffer
        };
    } catch (error) {
        return {
            success: false,
            error: "Move error: " + (error as Error).message,
        };
    }
}

/**
 * Find available games to join
 */
export async function findAvailableGames(): Promise<GameData[]> {
    return getWaitingGames();
}
