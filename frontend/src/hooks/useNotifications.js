import { useState, useCallback } from 'react';

function normalizeNotificationMessage(message) {
  if (typeof message === 'string') return message;
  if (message == null) return '';
  if (typeof message === 'object') {
    return String(message.message || message.error || JSON.stringify(message));
  }
  return String(message);
}

/**
 * Custom hook to manage notifications/toasts
 */
function useNotifications() {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback((message, type = 'success', duration = 5000) => {
    const id = Date.now() + Math.random();
    const notification = {
      id,
      message: normalizeNotificationMessage(message),
      type,
      duration,
    };

    setNotifications((prev) => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }, [removeNotification]);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    showNotification,
    removeNotification,
    clearAll,
  };
}

export default useNotifications;
