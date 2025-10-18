import React, { useState, useEffect } from 'react';
import { cn } from "@/utilities/cn";

interface TimerProps {
    timeRemaining: number; // время в миллисекундах
    isActive: boolean;
    lastMoveTimestamp: number;
    className?: string;
}

const Timer: React.FC<TimerProps> = ({ 
    timeRemaining,
    isActive,
    lastMoveTimestamp,
    className 
}) => {
    const [currentTime, setCurrentTime] = useState(timeRemaining);
    
    useEffect(() => {
        setCurrentTime(timeRemaining);
        
        let interval: NodeJS.Timeout | null = null;
        
        if (isActive) {
            interval = setInterval(() => {
                const elapsed = Date.now() - lastMoveTimestamp;
                const remaining = Math.max(0, timeRemaining - elapsed);
                setCurrentTime(remaining);
            }, 100);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [timeRemaining, isActive, lastMoveTimestamp]);

    // Форматирование времени в формат mm:ss
    const formatTime = (time: number): string => {
        const totalSeconds = Math.floor(time / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Определяем класс для стиля таймера в зависимости от оставшегося времени
    const getTimerClass = (): string => {
        if (currentTime <= 10000) { // Меньше 10 секунд
            return 'text-red-600 font-bold';
        } else if (currentTime <= 30000) { // Меньше 30 секунд
            return 'text-orange-500 font-bold';
        }
        return '';
    };

    return (
        <div className={cn(
            "px-3 py-1 rounded bg-gray-100 font-mono text-lg", 
            getTimerClass(), 
            className
        )}>
            {formatTime(currentTime)}
        </div>
    );
};

export default Timer;