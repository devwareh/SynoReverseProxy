import React from "react";
import PropTypes from "prop-types";
import Toast from "../Toast/Toast";
import "./ToastContainer.css";

const ToastContainer = ({ notifications, onClose, position = "top-right" }) => {
  if (notifications.length === 0) return null;

  return (
    <div
      className={`toast-container toast-container-${position}`}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          onClose={onClose}
        />
      ))}
    </div>
  );
};

ToastContainer.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      message: PropTypes.string.isRequired,
      type: PropTypes.oneOf(["success", "error", "info", "warning"]),
      duration: PropTypes.number,
    })
  ).isRequired,
  onClose: PropTypes.func.isRequired,
  position: PropTypes.oneOf(["top-right", "top-left", "bottom-right", "bottom-left"]),
};

export default ToastContainer;

