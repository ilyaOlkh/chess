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
    getLatestTurn,
    getWaitingGames,
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
}> {
    // Default starting FEN position
    const initialFen =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    const gameData: GameData = {
        id: "",
        currentFen: initialFen,
        startDate: new Date().toISOString(),
        endDate: null,
        firstPlayerColor,
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
        firstPlayerColor
    );

    return { gameId, playerToken };
}

/**
 * Join an existing game as the second player
 */
export async function joinGame(gameId: string): Promise<{
    playerToken: string | null;
    error?: string;
}> {
    const game = await getGame(gameId);

    if (!game) {
        return { playerToken: null, error: "Game not found" };
    }

    if (game.status !== "waiting") {
        return { playerToken: null, error: "Game is not in waiting status" };
    }

    // Change game status to active
    await updateGameStatus(gameId, "active");

    // Generate player token for the second player
    const playerToken = generatePlayerJoinToken(
        gameId,
        false,
        game.timeControl,
        game.firstPlayerColor
    );

    return { playerToken };
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
    promotionPiece: string | null = null
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
            from: from as Square,
            to: to as Square,
            promotion: (promotionPiece as "q" | "r" | "b" | "n") || undefined,
        });

        if (!moveResult) {
            return { success: false, error: "Invalid move" };
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
            promotionPiece,
        };

        await createTurn(turnData);

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

/**
 * Abort a game (e.g., if a player disconnects)
 */
export async function abortGame(
    token: string
): Promise<{ success: boolean; error?: string }> {
    const tokenData = verifyPlayerToken(token);

    if (!tokenData) {
        return { success: false, error: "Invalid token" };
    }

    const gameId = tokenData.gameId;
    const game = await getGame(gameId);

    if (!game) {
        return { success: false, error: "Game not found" };
    }

    // Only players (not spectators) can abort games
    if (tokenData.playerRole === "spectator") {
        return { success: false, error: "Spectators cannot abort games" };
    }

    // Only abort if game is waiting or active
    if (game.status !== "waiting" && game.status !== "active") {
        return { success: false, error: "Game is already finished" };
    }

    await updateGameStatus(gameId, "aborted");

    return { success: true };
}

/**
 * Get current game state
 */
export async function getGameState(token: string): Promise<{
    game: GameData | null;
    error?: string;
}> {
    const tokenData = verifyPlayerToken(token);

    if (!tokenData) {
        return { game: null, error: "Invalid token" };
    }

    const game = await getGame(tokenData.gameId);

    if (!game) {
        return { game: null, error: "Game not found" };
    }

    return { game };
}

/**
 * Refresh player token with updated time (after opponent's move)
 */
export async function refreshPlayerToken(token: string): Promise<{
    newToken: string | null;
    error?: string;
}> {
    const tokenData = verifyPlayerToken(token);

    if (!tokenData) {
        return { newToken: null, error: "Invalid token" };
    }

    const game = await getGame(tokenData.gameId);

    if (!game) {
        return { newToken: null, error: "Game not found" };
    }

    // Get the latest turn to see if it's this player's turn now
    const latestTurn = await getLatestTurn(tokenData.gameId);

    // If no turns yet, white goes first
    const isPlayerTurn = !latestTurn
        ? tokenData.playerColor === "white"
        : latestTurn.color !== tokenData.playerColor;

    if (isPlayerTurn) {
        // Reset the move timer for this player
        const newToken = updatePlayerMoveTime(token, game.timeControl);
        return { newToken };
    }

    // No need to update timer, not player's turn
    return { newToken: token };
}
