import { createError } from "@server/response/error";
import { NextRequest } from "next/server";

export function isAuthTokenProvided(request: NextRequest) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw createError("Unauthorized: No valid token provided", 401);
    }

    return authHeader;
}
