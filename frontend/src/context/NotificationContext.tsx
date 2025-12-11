import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';

interface Notification {
  id: number;
  title: string;
  body: string;
  item_id?: number;
  type: string;
  click_action?: string;
  read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  requestPermission: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  permission: NotificationPermission;
  disableNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Safe initialization of permission state
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get<Notification[]>('/notifications/');
      setNotifications(response.data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('token')) {
        fetchNotifications();
    }

    // Listen for messages from SW
    const handleSWMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
            fetchNotifications();
        }
    };

    // Safe access to serviceWorker
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
        if ('serviceWorker' in navigator && navigator.serviceWorker) {
            navigator.serviceWorker.removeEventListener('message', handleSWMessage);
        }
    };
  }, [fetchNotifications]);

  const requestPermission = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported in this browser/environment');
      return;
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult === 'granted') {
        const registration = await navigator.serviceWorker.ready;

        // Get VAPID key from backend
        const keyResponse = await api.get('/notifications/vapid-public-key');
        const applicationServerKey = urlBase64ToUint8Array(keyResponse.data.publicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });

        // Send subscription to backend
        await api.post('/notifications/subscribe', subscription.toJSON());
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const disableNotifications = async () => {
      try {
          if ('serviceWorker' in navigator && navigator.serviceWorker) {
              const registration = await navigator.serviceWorker.ready;
              const subscription = await registration.pushManager.getSubscription();
              if (subscription) {
                  // Unsubscribe from backend
                  await api.post('/notifications/unsubscribe', { endpoint: subscription.endpoint });
                  // Unsubscribe from browser
                  await subscription.unsubscribe();
                  setPermission('default');
              }
          }
      } catch (error) {
          console.error("Error disabling notifications", error);
      }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Error marking as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      requestPermission,
      markAsRead,
      markAllAsRead,
      permission,
      disableNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
