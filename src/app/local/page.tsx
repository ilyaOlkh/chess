"use client";

import ChessBoard from "@/components/chess/ChessBoard";
import { Button } from "@/components/shadcn/Button";
import Link from "next/link";

export default function LocalGame() {
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
                        Гра на одному пристрої
                    </h1>

                    <div className="w-[100px]">
                        {/* Пустой div для выравнивания */}
                    </div>
                </div>

                <ChessBoard
                    showControls={true}
                    showCapturedPieces={true}
                    showStatusBar={true}
                />
            </div>
        </main>
    );
}
