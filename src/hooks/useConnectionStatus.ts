import { useState, useEffect } from "react";

export type ConnectionStatus = "online" | "reconnecting" | "offline";

export function useConnectionStatus(): {
    status: ConnectionStatus;
    lastOnline: Date | null;
} {
    const [status, setStatus] = useState<ConnectionStatus>("online");
    const [lastOnline, setLastOnline] = useState<Date | null>(new Date());

    useEffect(() => {
        function handleOnline() {
            setStatus("online");
            setLastOnline(new Date());
        }

        function handleOffline() {
            setStatus("offline");
        }

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    return { status, lastOnline };
}
