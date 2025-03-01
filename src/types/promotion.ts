import { Square } from "chess.js";

export interface PendingPromotion {
    from: Square;
    to: Square;
    position: {
        top: number;
        left: number;
    };
}
