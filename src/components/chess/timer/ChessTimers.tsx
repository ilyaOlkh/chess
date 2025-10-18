import React from "react";
import { PlayerTimeData } from "@/lib/redis/redis-setup";
import Timer from "./Timer";
import { PlayerColor } from "@/lib/redis/redis-setup";

interface ChessTimersProps {
    playerTimes: PlayerTimeData;
    currentTurn: PlayerColor;
    playerColor?: PlayerColor;
    className?: string;
}

const ChessTimers: React.FC<ChessTimersProps> = ({
    playerTimes,
    currentTurn,
    playerColor,
    className,
}) => {
    if (!playerTimes) return null;
    
    const { firstPlayer, secondPlayer } = playerTimes;
    const isFirstPlayerActive = currentTurn === "white";
    const isSecondPlayerActive = currentTurn === "black";
    
    // Определяем, какой таймер показывать сверху на основе цвета игрока
    const isWhiteOnTop = playerColor === "black";
    
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="flex items-center justify-between">
                <span className="font-medium">
                    {isWhiteOnTop ? "Белые" : "Черные"}:
                </span>
                <Timer
                    timeRemaining={isWhiteOnTop ? firstPlayer.timeRemaining : secondPlayer.timeRemaining}
                    isActive={isWhiteOnTop ? isFirstPlayerActive : isSecondPlayerActive}
                    lastMoveTimestamp={isWhiteOnTop ? firstPlayer.lastMoveTimestamp : secondPlayer.lastMoveTimestamp}
                />
            </div>
            
            <div className="flex items-center justify-between">
                <span className="font-medium">
                    {isWhiteOnTop ? "Черные" : "Белые"}:
                </span>
                <Timer
                    timeRemaining={isWhiteOnTop ? secondPlayer.timeRemaining : firstPlayer.timeRemaining}
                    isActive={isWhiteOnTop ? isSecondPlayerActive : isFirstPlayerActive}
                    lastMoveTimestamp={isWhiteOnTop ? secondPlayer.lastMoveTimestamp : firstPlayer.lastMoveTimestamp}
                />
            </div>
        </div>
    );
};

export default ChessTimers;