import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';

const Notifications: React.FC = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const socket = new WebSocket('ws://localhost:8000/ws/notifications');

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

        return () => {
            socket.close();
        };
    }, [user]);

    return null; // Componente sem UI, apenas lógica
};

export default Notifications;
