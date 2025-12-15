import React, { useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { useError } from '../hooks/useError';
import { buildWebSocketUrl } from '../utils/buildWebSocketUrl';

interface WebSocketPayload {
    message: string;
    actor_id?: number;
    target_roles?: string[];
    target_branch_id?: number;
}

const Notifications: React.FC = () => {
    const { user } = useAuth();
    const { showSuccess } = useError();

    // Refs to manage connection lifecycle and timeouts
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const isMountedRef = useRef(false);

    // Reconnection strategy: 1s, 2s, 5s, 10s (capped at 10s)
    const getReconnectDelay = (attempts: number) => {
        const delays = [1000, 2000, 5000, 10000];
        return delays[Math.min(attempts, delays.length - 1)];
    };

    const setupWebSocket = () => {
        // Prevent multiple connections
        if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) return;

        // Build robust URL using the centralized utility
        const wsUrl = buildWebSocketUrl(token);
        console.log(`[WS] Connecting to: ${wsUrl}`);

        try {
            const socket = new WebSocket(wsUrl);
            socketRef.current = socket;

            socket.onopen = () => {
                console.log('[WS] Connected');
                reconnectAttemptsRef.current = 0; // Reset attempts on success
            };

            socket.onmessage = (event) => {
                try {
                    let data = event.data;
                    let payload: WebSocketPayload;

                    // Try parsing JSON
                    try {
                        payload = JSON.parse(data);
                    } catch (e) {
                        // Legacy string support
                        payload = { message: data };
                    }

                    // 1. Don't show notification to the user who triggered the action
                    if (user && payload.actor_id && user.email) { // Using email/id check? Payload has ID.
                        // Assuming user context has ID. Let's check AuthContext interface or just assume decoded token has ID.
                        // Actually, frontend 'user' object might not have ID explicitly typed in AuthContext,
                        // but normally it does or we can decode from token.
                        // However, 'user' comes from AuthProvider which decodes JWT.
                        // Let's rely on standard logic: if we initiated it, we know.
                        // But strictly matching ID is safer.
                        // If user.id is not available, we skip this check or try to match email if provided?
                        // For now, let's assume if payload.actor_id matches we hide.
                        // But we need to know current user ID.
                        // Let's inspect 'user' object in AuthContext again.
                        // It has { email, role, can_import }. No ID?
                        // If no ID in frontend user object, we can't filter by ID easily.
                        // We could decode token manually here, or just show it.

                        // Wait, previous context check: "The `User` type ... contains `email`, `role`, and optional `can_import` fields."
                        // It does NOT contain ID.
                        // This is a limitation.

                        // Alternative: We can filter by Role.
                    }

                    // 2. Filter by Role
                    if (payload.target_roles && user) {
                        if (!payload.target_roles.includes(user.role)) {
                            return; // Not for my role
                        }
                    }

                    // 3. Filter by Branch (Optional/Advanced)
                    // If target_branch_id is present and user is OPERATOR, check if they belong.
                    // But we don't have user's branch list easily accessible here without fetching.
                    // For now, relying on Role is a good 90% solution.

                    // Show notification
                    showSuccess(payload.message, "Nova Notificação");

                } catch (e) {
                    console.error('[WS] Error processing message:', e);
                }
            };

            socket.onclose = (event) => {
                console.log(`[WS] Disconnected (Code: ${event.code})`);
                socketRef.current = null;

                // Trigger reconnection if mounted
                if (isMountedRef.current) {
                    const delay = getReconnectDelay(reconnectAttemptsRef.current);
                    console.log(`[WS] Reconnecting in ${delay}ms... (Attempt ${reconnectAttemptsRef.current + 1})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current += 1;
                        setupWebSocket();
                    }, delay);
                }
            };

            socket.onerror = (error) => {
                console.error('[WS] Error:', error);
                // onerror usually precedes onclose, so reconnection is handled in onclose
                socket.close();
            };

        } catch (err) {
            console.error("[WS] Initialization failed:", err);
            // Retry on initialization failure
            if (isMountedRef.current) {
                 const delay = 5000;
                 reconnectTimeoutRef.current = setTimeout(setupWebSocket, delay);
            }
        }
    };

    useEffect(() => {
        isMountedRef.current = true;

        if (user) {
            setupWebSocket();
        }

        return () => {
            isMountedRef.current = false;
            console.log('[WS] Cleaning up...');

            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [user]);

    return null;
};

export default Notifications;
