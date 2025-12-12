/**
 * Utility to build robust WebSocket URLs based on current environment and location.
 */
export function buildWebSocketUrl(path: string, token: string | null): string {
    // 1. Determine Base URL from Environment Variables
    let wsBaseUrl = import.meta.env.VITE_WS_URL || import.meta.env.WS_BASE_URL;

    // Fallback: VITE_API_URL (convert http/https to ws/wss)
    if (!wsBaseUrl && import.meta.env.VITE_API_URL) {
        const apiUrl = import.meta.env.VITE_API_URL;
        wsBaseUrl = apiUrl.replace(/^http/, 'ws');
    }

    // 2. If still not set, derive from window.location (Priority 2)
    if (!wsBaseUrl) {
        if (typeof window !== 'undefined') {
            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const hostname = window.location.hostname;

            // "se existir window.location.port, usar"
            // "senão usar porta padrão definida via env"
            let port = window.location.port;
            if (!port) {
                port = import.meta.env.VITE_BACKEND_PORT || '8001';
            }

            wsBaseUrl = `${protocol}://${hostname}:${port}`;
        } else {
             // Fallback for SSR or non-browser environments
             wsBaseUrl = 'ws://localhost:8001';
        }
    }

    // Ensure no trailing slash
    wsBaseUrl = wsBaseUrl.replace(/\/$/, '');

    // Ensure clean path
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Build final URL
    const url = `${wsBaseUrl}${cleanPath}`;

    // Append token if provided
    if (token) {
        return `${url}?token=${token}`;
    }

    return url;
}
