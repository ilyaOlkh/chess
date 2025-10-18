import { verifyPlayerToken } from "@/lib/auth/player-auth";
import { createError } from "@server/response/error";
import { NextRequest } from "next/server";

export function isAuthTokenProvided(request: NextRequest) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw createError("Unauthorized: No valid token provided", 401);
    }

    return authHeader;
}

export function isGameIdValid(request: NextRequest, gameId: string) {
    const authHeader = isAuthTokenProvided(request);

    const token = authHeader.split(" ")[1];
    const tokenData = verifyPlayerToken(token);

    if (!tokenData) {
        throw createError("Unauthorized: Invalid token", 401);
    }

    if (tokenData.gameId !== gameId) {
        throw createError("Unauthorized: Token does not match game ID", 401);
    }

    return tokenData;
}

export function getToken(request: NextRequest) {
    const authHeader = isAuthTokenProvided(request);

    const token = authHeader.split(" ")[1];

    return token;
}
