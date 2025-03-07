export interface CellPosition {
    row: number;
    col: number;
}

export interface ChessBoardBaseProps {
    className?: string;
    readOnly?: boolean;
    reversed?: boolean;
    onTurn?: (moveData: {
        from: string;
        to: string;
        promotion?: string;
        fen: string;
    }) => void;
    showCapturedPieces?: boolean;
    playerLabels?: PlayerLabels;
    fenPosition?: string;
}

export interface PlayerLabels {
    whitePlayer: string;
    blackPlayer: string;
}

export type BoardCoordinates = {
    files: string[];
    ranks: number[];
};

export interface MoveData {
    from: string;
    to: string;
    promotion?: string;
    fen: string;
}
