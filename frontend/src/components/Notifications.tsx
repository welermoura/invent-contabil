import React, { useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useError } from '../hooks/useError';
import api from '../api';

const Notifications: React.FC = () => {
    const { user } = useAuth();
    const { showSuccess } = useError();

    useEffect(() => {
        if (!user) return;

        // Use the centralized base URL from api.ts which handles LAN/Localhost detection
        const baseURL = api.defaults.baseURL || 'http://localhost:8001';

        // Convert HTTP to WS
        const wsProtocol = baseURL.startsWith('https') ? 'wss' : 'ws';
        // Strip protocol to get clean host/path
        const cleanUrl = baseURL.replace(/^https?:\/\//, '');

        // Retrieve token for authentication
        const token = localStorage.getItem('token');

        const wsUrl = `${wsProtocol}://${cleanUrl}/ws/notifications?token=${token}`;

        console.log(`[WS] Connecting to: ${wsUrl}`);

        let socket: WebSocket | null = null;

        try {
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log('WebSocket Connected');
            };

            socket.onmessage = (event) => {
                // Check permissions (Admin/Approver only)
                if (user.role === 'ADMIN' || user.role === 'APPROVER') {
                    showSuccess(event.data, "Nova Notificação");
                }
            };

            socket.onclose = () => {
                console.log('WebSocket Disconnected');
            };

            socket.onerror = (error) => {
                 console.error('WebSocket Error:', error);
            };

        } catch (err) {
            console.error("Failed to initialize WebSocket:", err);
        }

        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [user, showSuccess]);

    return null;
};

export default Notifications;
