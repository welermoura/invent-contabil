export function buildWebSocketUrl(token: string): string {
    // A) Tentar usar primeiro import.meta.env.VITE_WS_URL
    if (import.meta.env.VITE_WS_URL) {
         return `${import.meta.env.VITE_WS_URL}?token=${token}`;
    }

    // B) Se não existir, montar dinamicamente:
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const host = location.hostname;

    // Recupera a porta da URL atual
    const urlPort = location.port;

    // Lógica de Fallback de Porta:
    // 1. Usa VITE_WS_PORT se definido.
    // 2. Se não, verifica se a porta da URL é 5173 (Dev Frontend) ou vazia (80/443 Padrão).
    //    Nestes casos, assume que o Backend está na porta 8000 (Padrão do Projeto),
    //    similar à lógica de detecção de LAN no api.ts.
    // 3. Caso contrário, usa a mesma porta da URL (ex: proxy reverso na mesma porta).

    let port = import.meta.env.VITE_WS_PORT;

    if (!port) {
        if (!urlPort || urlPort === '5173') {
            port = '8000';
        } else {
            port = urlPort;
        }
    }

    // C) Validar e Montar
    // Se por algum motivo port ainda for undefined (impossível pela lógica acima, mas por segurança)
    if (!host) {
         console.error("INVALID WS CONFIG: Host missing");
    }

    return `${protocol}//${host}:${port}/ws/notifications?token=${token}`;
}
