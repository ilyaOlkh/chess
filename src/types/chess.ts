export interface CellPosition {
    row: number;
    col: number;
}

export interface ChessBoardBaseProps {
    className?: string;
}

export type BoardCoordinates = {
    files: string[];
    ranks: number[];
};
