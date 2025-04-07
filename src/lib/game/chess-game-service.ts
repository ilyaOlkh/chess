import { Chess } from "chess.js";
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
} from "../redis/redis-setup";
import {
    generatePlayerJoinToken,
    generateSpectatorToken,
    verifyPlayerToken,
    updatePlayerMoveTime,
    hasMoveTimeExpired,
} from "../auth/player-auth";

/**
 * Creates a new chess game
 */
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
        endDate: null,
        firstPlayerColor,
        firstPlayerId, // Set the first player ID
        secondPlayerId: null,
        status: "waiting",
        winner: null,
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
    playerToken: string | null;
    playerId: string | null;
    error?: string;
}> {
    const game = await getGame(gameId);

    if (!game) {
        return { playerToken: null, playerId: null, error: "Game not found" };
    }

    if (game.status !== "waiting") {
        return {
            playerToken: null,
            playerId: null,
            error: "Game is not in waiting status",
        };
    }

    if (game.secondPlayerId) {
        return {
            playerToken: null,
            playerId: null,
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

/**
 * Join a game as a spectator
 */
export async function spectateGame(gameId: string): Promise<{
    spectatorToken: string | null;
    error?: string;
}> {
    const game = await getGame(gameId);

    if (!game) {
        return { spectatorToken: null, error: "Game not found" };
    }

    // Generate spectator token
    const spectatorToken = generateSpectatorToken(gameId);

    return { spectatorToken };
}

/**
 * Make a move in the game
 */
export async function makeMove(
    token: string,
    from: string,
    to: string,
    promotion?: string
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

    // Get game data
    const gameId = tokenData.gameId;
    const game = await getGame(gameId);

    if (!game) {
        return { success: false, error: "Game not found" };
    }

    if (game.status !== "active") {
        return { success: false, error: "Game is not active" };
    }

    // Verify it's the player's turn
    const chess = new Chess(game.currentFen);
    const currentTurn = chess.turn() === "w" ? "white" : "black";

    if (tokenData.playerColor !== currentTurn) {
        return { success: false, error: "Not your turn" };
    }

    // Try to make the move
    try {
        const moveResult = chess.move({
            from: from,
            to: to,
            promotion: promotion,
        });

        if (!moveResult) {
            return { success: false, error: "Invalid move" };
        }

        // Check for game end conditions
        let gameOver = false;
        let gameResult: Winner = null;

        if (chess.isCheckmate()) {
            gameOver = true;
            gameResult = currentTurn;
            await updateGameStatus(gameId, "completed", gameResult);
        } else if (chess.isDraw()) {
            gameOver = true;
            gameResult = "draw";
            await updateGameStatus(gameId, "completed", gameResult);
        }

        // Move is valid, record it
        const newFen = chess.fen();
        await updateGameFen(gameId, newFen);

        // Record the turn
        const turnData: TurnData = {
            id: "",
            gameId,
            from,
            to,
            createTime: new Date().toISOString(),
            color: currentTurn,
            promotion: promotion,
        };

        await createTurn(turnData);

        // Update the opponent's token with fresh move time
        // For simplicity, getting the new token requires a separate call
        // in a real app you'd track both players

        // Return the updated FEN and game status
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
