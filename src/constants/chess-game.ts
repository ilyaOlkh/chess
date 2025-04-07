export const chessGameConstants = {
    initialPosition: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    animationDuration: 300,
    moveTypes: {
        normal: "normal",
        castling: "castling",
        enPassant: "en_passant",
        promotion: "promotion",
        capture: "capture",
    },
    startingPiecesCount: {
        w: { p: 8, r: 2, n: 2, b: 2, q: 1 },
        b: { p: 8, r: 2, n: 2, b: 2, q: 1 },
    },
};

export const chessGameText = {
    checkMessage: "Шах!",
    checkmateMessage: "Мат! Гру завершено.",
    drawMessage: "Нічия! Гру завершено.",
    whiteTurn: "Хід білих",
    blackTurn: "Хід чорних",
    undoButtonLabel: "Скасувати хід",
    resetButtonLabel: "Нова гра",
    gameControlsTitle: "Керування грою",
    localWhitePlayer: "Білі",
    localBlackPlayer: "Чорні",
    onlineFirstPlayer: "Гравець 1",
    onlineSecondPlayer: "Гравець 2",
};
