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
