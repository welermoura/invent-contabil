export function buildWebSocketUrl(token: string): string {
    // A) Tentar usar primeiro import.meta.env.VITE_WS_URL
    if (import.meta.env.VITE_WS_URL) {
         return `${import.meta.env.VITE_WS_URL}?token=${token}`;
    }

    // B) Se não existir, montar dinamicamente:
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const host = location.hostname;
    const port = location.port || import.meta.env.VITE_WS_PORT;

    // C) Validar
    if (!host || port === undefined) {
         console.error("INVALID WS CONFIG", { host, port });
    }

    // Return format
    return `${protocol}//${host}:${port}/ws/notifications?token=${token}`;
}
