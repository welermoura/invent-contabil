export function getWebSocketUrl(token: string | null): string {
    // A) Usar primeiro VITE_WS_URL (se existir)
    if (import.meta.env.VITE_WS_URL) {
        const baseUrl = import.meta.env.VITE_WS_URL.replace(/\/$/, '');
        return `${baseUrl}/ws/notifications?token=${token}`;
    }

    // B) Se não existir, montar baseado exclusivamente em window.location
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const host = window.location.hostname;

        // Priority: Window Port OR VITE_WS_PORT.
        // User requested: "window.location.port || import.meta.env.VITE_WS_PORT"
        // Note: window.location.port is '' for standard ports (80/443).
        const port = window.location.port || import.meta.env.VITE_WS_PORT;

        // D) Verificação final
        if (!host) {
           console.error("WS Error: host missing", { host });
           throw new Error("WS Error: host missing");
        }

        // Construct URL
        // If port is present, add it. If not, don't.
        // But if port is missing, user said "host or port missing".
        // If port is '', it implies 80/443. This is valid.
        // BUT if backend requires 8001, '' will fail.
        // The user must provide VITE_WS_PORT if they are on port 80 but backend is 8001?
        // Or VITE_WS_URL.

        const portPart = port ? `:${port}` : '';
        return `${protocol}://${host}${portPart}/ws/notifications?token=${token}`;
    }

    throw new Error("WS Error: window is undefined and VITE_WS_URL is not set");
}
