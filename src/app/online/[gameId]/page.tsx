"use client";

import { useEffect, useState } from "react";
import ChessBoard from "@/components/chess/ChessBoard";
import { Button } from "@/components/shadcn/Button";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/shadcn/Card";
import { MoveData } from "@/types/chess-board";

// Типы для статуса онлайн-игры
type GameStatus = "waiting" | "active" | "completed" | "aborted";
type PlayerColor = "white" | "black";
type PlayerRole = "first" | "second" | "spectator";

interface OnlineGameState {
    status: GameStatus;
    playerColor: PlayerColor | null;
    playerRole: PlayerRole;
    opponentConnected: boolean;
    lastMoveTime: number | null;
}

export default function OnlineGame() {
    // Состояние онлайн-игры (в реальной реализации будет синхронизироваться с сервером)
    const [gameState, setGameState] = useState<OnlineGameState>({
        status: "waiting",
        playerColor: "white", // В реальной реализации будет приходить с сервера
        playerRole: "first",
        opponentConnected: false,
        lastMoveTime: null,
    });

    // Флаг для отображения информации о копировании ссылки
    const [showCopied, setShowCopied] = useState(false);

    // Функция для обработки хода
    const handleMove = (moveData: MoveData) => {
        console.log("Ход сделан:", moveData);
        // В реальной реализации здесь будет отправка хода на сервер

        // Для демонстрации имитируем, что второй игрок присоединился после первого хода
        if (gameState.status === "waiting") {
            setGameState((prev) => ({
                ...prev,
                status: "active",
                opponentConnected: true,
                lastMoveTime: Date.now(),
            }));
        }
    };

    // Функция для копирования ссылки-приглашения
    const copyInviteLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    // Для демо: имитируем подключение противника после загрузки страницы
    useEffect(() => {
        const timer = setTimeout(() => {
            if (gameState.status === "waiting") {
                setGameState((prev) => ({
                    ...prev,
                    opponentConnected: true,
                    status: "active",
                }));
            }
        }, 5000); // 5 секунд для демонстрации

        return () => clearTimeout(timer);
    }, [gameState.status]);

    return (
        <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-8">
            <div className="w-full max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <Button
                        variant="outline"
                        asChild
                        className="flex items-center"
                    >
                        <Link href="/">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="mr-2"
                            >
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Назад
                        </Link>
                    </Button>

                    <h1 className="text-2xl font-bold text-indigo-700">
                        Гра онлайн
                    </h1>

                    <div className="w-[100px]">
                        {/* Пустой div для выравнивания */}
                    </div>
                </div>

                {gameState.status === "waiting" && (
                    <Card className="w-full mb-6 bg-white">
                        <CardHeader>
                            <CardTitle className="text-indigo-700">
                                Очікування суперника
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-3">
                                Запросіть друга, надіславши йому це посилання:
                            </p>
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    className="flex-1 p-2 border rounded-md text-sm"
                                    value={window.location.href}
                                    readOnly
                                />
                                <Button
                                    onClick={copyInviteLink}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    {showCopied ? "Скопійовано!" : "Копіювати"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid md:grid-cols-[1fr_auto] gap-6">
                    <div>
                        <ChessBoard
                            readOnly={
                                gameState.playerColor !== "white" &&
                                !gameState.opponentConnected
                            }
                            // reversed={gameState.playerColor === "black"}
                            onTurn={handleMove}
                            showControls={false}
                            showCapturedPieces={true}
                            showStatusBar={true}
                            reversed
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
