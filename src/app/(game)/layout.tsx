import React, { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/shadcn/Button";
import { ChessProvider } from "@/context/ChessContext";

interface GameLayoutProps {
    title: string;
    children: ReactNode;
}

const GameLayout: React.FC<GameLayoutProps> = ({ title, children }) => {
    return (
        <ChessProvider>
            <main className="flex min-h-screen flex-col">
                <div className="w-full h-full">
                    <div className="flex justify-between items-center p-4">
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
                            {title}
                        </h1>

                        <div className="w-[100px]"></div>
                    </div>

                    <div className="h-[calc(100vh-80px)]">{children}</div>
                </div>
            </main>
        </ChessProvider>
    );
};

export default GameLayout;
