export function decodeJwtToken<T extends object>(token: string) {
    try {
        const parts = token.split(".");

        if (parts.length !== 3) {
            throw new Error("Некорректный JWT токен: неверный формат");
        }

        const payload = parts[1];
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = Buffer.from(base64, "base64").toString("utf-8");

        return JSON.parse(jsonPayload) as T;
    } catch (error) {
        throw new Error("Ошибка при декодировании JWT токена:" + error);
    }
}
