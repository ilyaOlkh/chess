export interface Error {
    error: string;
    status: number;
}

export interface ErrorResponse {
    error: string;
}

export type ResponseBody = object | string | number | boolean;

export function createError(message: string, status: number = 500): Error {
    return {
        error: message,
        status,
    };
}

export function isErrorResponse(error: unknown): error is Error {
    return (
        typeof error === "object" &&
        error !== null &&
        "error" in error &&
        "status" in error
    );
}
