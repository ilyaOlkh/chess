export function decodeJwtToken<T extends object>(token: string) {
    try {
        const parts = token.split(".");

        if (parts.length !== 3) {
            throw new Error("Некорректный JWT токен: неверный формат");
        }

        const payload = parts[1];
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
            window
                .atob(base64)
                .split("")
                .map(
                    (char) =>
                        "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2)
                )
                .join("")
        );

        return JSON.parse(jsonPayload) as T;
    } catch (error) {
        throw new Error("Ошибка при декодировании JWT токена:" + error);
    }
}
