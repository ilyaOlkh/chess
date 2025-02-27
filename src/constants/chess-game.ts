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
};

export const chessGameText = {
    checkMessage: "Шах!",
    checkmateMessage: "Мат! Игра окончена.",
    drawMessage: "Ничья! Игра окончена.",
    whiteTurn: "Ход белых",
    blackTurn: "Ход черных",
    capturedPiecesLabel: "Взятые фигуры",
    undoButtonLabel: "Отменить ход",
    resetButtonLabel: "Новая игра",
};
