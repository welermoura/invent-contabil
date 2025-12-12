import React, { useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { useError } from '../hooks/useError';
import { buildWebSocketUrl } from '../utils/buildWebSocketUrl';

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
                    // Only show notifications for specific roles
                    if (user?.role === 'ADMIN' || user?.role === 'APPROVER') {
                        showSuccess(event.data, "Nova Notificação");
                    }
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
