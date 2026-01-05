import React, { createContext, useContext, useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  // Initialize Socket and Fetch Initial Notifications
  useEffect(() => {
    if (!user) return;

    // Fetch initial state
    fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(data => {
        if (Array.isArray(data)) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.isRead).length);
        }
    })
    .catch(err => console.error("Failed to fetch notifications", err));

    // Connect Socket
    // Use the backend URL or current origin if proxied
    // Since Vite proxies /api to backend, we likely need to connect to window.location.origin
    // BUT socket.io defaults to window.location.host, which is frontend port.
    // We need to verify if Vite proxies socket connections or if we need specific port.
    // If backend is on 3000 and frontend on 3429.
    // Vite proxy config usually handles HTTP. WS might need config or direct URL.
    // Given the environment, let's try connecting to the same host/port if proxied,
    // or fallback to hardcoded if needed. But usually, in dev, we might need specific URL.
    // Let's assume the proxy setup in Vite handles it, OR we connect to backend URL directly if known.
    // If we are in dev, backend is localhost:3000. Frontend is localhost:3429.
    // If we use relative path, it goes to 3429.
    // Let's try connecting with no URL (defaults to window.location) and rely on proxy?
    // Vite proxy needs `ws: true` for that.
    // Safest bet for this environment (if no Vite config info):
    // Use explicit URL if in dev mode, or relative.
    // Actually, let's assume standard Vite proxy setup or standard separate ports.
    // If separate ports, we need the backend URL.
    // Since I don't see Vite config, I'll try to deduce.
    // Memory says "The frontend development server (Vite) proxies all requests starting with /api to the backend at http://127.0.0.1:3000".
    // It doesn't explicitly say it proxies websockets.
    // Let's try to connect to backend port directly if in dev, but for production it's usually relative.
    // Actually, let's try to pass the token in query params as designed in backend.

    // For local dev in this sandbox, we might need to hit the backend port directly?
    // Backend is 3000. Frontend is 3429.
    // Let's use `transports: ['websocket']` and path if needed.
    // If we can't assume proxy, we should use window.location.hostname + ':3000'.

    const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `http://${window.location.hostname}:3000`
        : window.location.origin;

    const newSocket = io(socketUrl, {
      query: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
    });

    newSocket.on('notification', (newNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const markAsRead = async (id) => {
    try {
        await fetch(`/api/notifications/${id}/read`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) { console.error(err); }
  };

  const markAllAsRead = async () => {
      try {
          await fetch(`/api/notifications/read-all`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
          setUnreadCount(0);
      } catch (err) { console.error(err); }
  };

  const deleteNotification = async (id) => {
      try {
          await fetch(`/api/notifications/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          const notif = notifications.find(n => n.id === id);
          if (notif && !notif.isRead) {
              setUnreadCount(prev => Math.max(0, prev - 1));
          }
          setNotifications(prev => prev.filter(n => n.id !== id));
      } catch (err) { console.error(err); }
  };

  const deleteAll = async () => {
      try {
          await fetch(`/api/notifications`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setNotifications([]);
          setUnreadCount(0);
      } catch (err) { console.error(err); }
  };

  return (
    <NotificationContext.Provider value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAll
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
