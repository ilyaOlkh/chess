import {
    ErrorResponse,
    isErrorResponse,
    ResponseBody,
} from "@server/response/error";
import { NextRequest, NextResponse } from "next/server";

export type RouteParams = { params: Promise<{ [key: string]: string }> };

type HandlerRequest<T> = (
    request: NextRequest,
    params: RouteParams
) => Promise<NextResponse<T>>;

export function createResponse<T extends ResponseBody>(
    data: T,
    status: number = 200
): NextResponse<T> {
    return NextResponse.json(data, { status });
}

export function handleRequest<T extends ResponseBody>(
    handler: HandlerRequest<T | ErrorResponse>
): HandlerRequest<T | ErrorResponse> {
    return async (request, params) => {
        try {
            const result = await handler(request, params);

            return result;
        } catch (error) {
            if (isErrorResponse(error)) {
                return NextResponse.json(
                    { error: error.error },
                    { status: error.status }
                );
            }

            console.error("API Error:", error);

            let errorMessage = "Произошла внутренняя ошибка сервера";
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === "string") {
                errorMessage = error;
            }

            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
    };
}
