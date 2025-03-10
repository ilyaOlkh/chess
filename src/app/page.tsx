"use client";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/shadcn/Card";
import { Button } from "@/components/shadcn/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { createGame } from "@/services/longPollingService";

export default function Home() {
    const router = useRouter();
    const [isCreatingGame, setIsCreatingGame] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreateOnlineGame = async () => {
        try {
            setIsCreatingGame(true);
            setError(null);

            // Create a new game
            const response = await createGame();

            if (response.gameId) {
                // Save the token to localStorage
                localStorage.setItem(
                    `chess_token_${response.gameId}`,
                    response.playerToken
                );

                // Redirect to the game page
                router.push(`/online/${response.gameId}`);
            } else {
                setError("Failed to create game");
                setIsCreatingGame(false);
            }
        } catch (error) {
            console.error("Error creating game:", error);
            setError(
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred"
            );
            setIsCreatingGame(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-50 to-purple-100">
            <Card className="w-full max-w-xl mx-auto shadow-lg border-t-4 border-t-indigo-600">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-6">
                        <div className="relative w-24 h-24 bg-indigo-600 rounded-full p-4 shadow-lg">
                            <Image
                                src="/chess-pieces/black_knight.svg"
                                alt="Chess Logo"
                                fill
                                className="object-contain"
                            />
                        </div>
                    </div>
                    <CardTitle className="text-5xl font-bold text-indigo-700 mb-2">
                        Шахи 2
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 py-6 px-8">
                    <Button
                        className="w-full text-xl py-6 px-12"
                        variant="chess"
                        disabled
                        title="Ця функція буде доступна в майбутніх оновленнях"
                    >
                        Грати з ШІ
                    </Button>

                    <Button
                        className="w-full text-xl py-6 px-12"
                        variant="chess"
                        onClick={handleCreateOnlineGame}
                        disabled={isCreatingGame}
                    >
                        {isCreatingGame ? "Створення гри..." : "Грати онлайн"}
                    </Button>

                    <Button
                        className="w-full text-xl py-6 px-12"
                        variant="chess"
                        asChild
                    >
                        <Link href="/local">Грати на одному пристрої</Link>
                    </Button>

                    {error && (
                        <div className="text-red-500 text-center mt-4">
                            {error}
                        </div>
                    )}
                </CardContent>
            </Card>

            <footer className="mt-12 text-center text-indigo-500 text-base">
                <p>© {new Date().getFullYear()} Шахи 2 | All rights reserved</p>
                <p className="mt-2 font-medium">olalaha inc.</p>
            </footer>
        </main>
    );
}
