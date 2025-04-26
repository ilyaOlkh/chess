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
} from "@/lib/redis/redis-setup";
import {
    generatePlayerJoinToken,
    verifyPlayerToken,
    updatePlayerMoveTime,
    hasMoveTimeExpired,
    PlayerTokenPayload,
} from "@/lib/auth/player-auth";
import { PieceType } from "@/types/chess-game";
import { playerColors } from "@/constants/chess-game";
import { playerRoles } from "@/constants/online-game";

export async function createNewGame(
    timeControl: number,
    firstPlayerColor: PlayerColor = playerColors.white
): Promise<{
    gameId: string;
    playerToken: string;
    playerId: string;
}> {
    const initialFen =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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
    if (hasMoveTimeExpired(tokenData)) {
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

    if (!isPlayerTurn(game.currentFen, tokenData)) {
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

export async function findAvailableGames(): Promise<GameData[]> {
    return getWaitingGames();
}

export function isPlayerTurn(
    currentFen: string,
    tokenData?: PlayerTokenPayload
): boolean {
    const chess = new Chess(currentFen);
    const currentTurn = chess.turn() === "w" ? "white" : "black";

    return (
        tokenData?.playerRole !== playerRoles.spectator &&
        tokenData?.playerColor === currentTurn
    );
}
