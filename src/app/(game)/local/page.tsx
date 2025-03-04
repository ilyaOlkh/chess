"use client";

import ChessBoard from "@/components/chess/ChessBoard";
import { chessGameText } from "@/constants/chess-game";

export default function LocalGame() {
    return (
        <ChessBoard
            reversed
            showControls={true}
            showCapturedPieces={true}
            showStatusBar={true}
            className="h-[min(calc(100%-58px),calc(100vw-50px))] md:h-[min(calc(100%-58px),calc(100vw-350px))]"
            playerLabels={{
                whitePlayer: chessGameText.localWhitePlayer,
                blackPlayer: chessGameText.localBlackPlayer,
            }}
        />
    );
}
