import React, { useEffect } from 'react';
import { useAuth } from '../AuthContext';

const Notifications: React.FC = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';

        // Smart URL Detection for LAN
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            if (hostname !== 'localhost' && hostname !== '127.0.0.1' && apiUrl.includes('localhost')) {
                const protocol = window.location.protocol;
                apiUrl = `${protocol}//${hostname}:8001`;
                console.log('[WS] Detected LAN access, overriding localhost WS URL');
            }
        }

        const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/notifications';
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('WebSocket Connected');
        };

        socket.onmessage = (event) => {
            if (user.role === 'admin' || user.role === 'approver') {
                // Simple alert for now, could be a toast
                alert(`Notificação: ${event.data}`);
            }
        };

        socket.onclose = () => {
            console.log('WebSocket Disconnected');
        };

        socket.onerror = (error) => {
             console.error('WebSocket Error:', error);
        };

        return () => {
            socket.close();
        };
    }, [user]);

    return null; // Componente sem UI, apenas lógica
};

export default Notifications;
