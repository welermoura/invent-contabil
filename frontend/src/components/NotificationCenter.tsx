import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useError } from '../context/ErrorContext';
import { buildWebSocketUrl } from '../utils/buildWebSocketUrl';

interface Notification {
    id: number;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
}

const NotificationCenter: React.FC = () => {
    const { user } = useAuth();
    const { showError } = useError();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // WS Refs
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchNotifications = async () => {
        try {
            const response = await api.get('/notifications/', {
                params: { limit: 20 }
            });
            setNotifications(response.data);
            setUnreadCount(response.data.filter((n: Notification) => !n.read).length);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    const markAsRead = async (id: number) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            showError("Erro ao marcar como lida");
        }
    };

    const markAllAsRead = async () => {
        try {
            setLoading(true);
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            showError("Erro ao marcar todas como lidas");
        } finally {
            setLoading(false);
        }
    };

    const setupWebSocket = () => {
        if (!user) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        const wsUrl = buildWebSocketUrl(token);

        try {
            // Close existing connection if any
            if (socketRef.current) {
                socketRef.current.close();
            }

            const socket = new WebSocket(wsUrl);
            socketRef.current = socket;

            socket.onmessage = (event) => {
                // When we receive ANY message, we refresh notifications
                // The backend broadcasts generic messages or specific formats
                // We treat it as a signal to sync.
                console.log("[NotificationCenter] WS Message received, refreshing...");
                fetchNotifications();
            };

            socket.onclose = () => {
                 // Simple reconnect logic
                 reconnectTimeoutRef.current = setTimeout(setupWebSocket, 5000);
            };

        } catch (e) {
            console.error("WS Setup failed", e);
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotifications();
            setupWebSocket();
        }
        return () => {
            if (socketRef.current) socketRef.current.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };
    }, [user]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.notification-dropdown') && !target.closest('.notification-trigger')) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    if (!user) return null;

    return (
        <div className="relative">
            <button
                className="notification-trigger relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-full border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 origin-top-right ring-1 ring-black ring-opacity-5">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <h3 className="font-semibold text-slate-700">Notificações</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                disabled={loading}
                                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                                <Check size={14} />
                                Marcar todas como lidas
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nenhuma notificação</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-50">
                                {notifications.map(notification => (
                                    <li
                                        key={notification.id}
                                        className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50' : ''}`}
                                        onClick={() => !notification.read && markAsRead(notification.id)}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${!notification.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                                            <div className="flex-1 space-y-1">
                                                <p className={`text-sm ${!notification.read ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {new Date(notification.created_at).toLocaleString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
