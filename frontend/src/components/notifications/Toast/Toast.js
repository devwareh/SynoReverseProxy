import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { FiX, FiCheck, FiAlertCircle } from "react-icons/fi";
import "./Toast.css";

const Toast = ({ notification, onClose }) => {
  const { id, message, type } = notification;

  useEffect(() => {
    if (notification.duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [id, notification.duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <FiCheck className="toast-icon" aria-hidden="true" />;
      case "error":
        return <FiAlertCircle className="toast-icon" aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`toast toast-${type}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      {getIcon()}
      <span className="toast-message">{message}</span>
      <button
        className="toast-close"
        onClick={() => onClose(id)}
        aria-label="Close notification"
      >
        <FiX aria-hidden="true" />
      </button>
    </div>
  );
};

Toast.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    message: PropTypes.string.isRequired,
    type: PropTypes.oneOf(["success", "error", "info", "warning"]),
    duration: PropTypes.number,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default Toast;

