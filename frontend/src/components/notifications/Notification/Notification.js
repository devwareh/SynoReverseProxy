import React from "react";
import PropTypes from "prop-types";
import { FiCheck, FiAlertCircle } from "react-icons/fi";
import "./Notification.css";

const Notification = ({ message, type = "success", className = "" }) => {
  if (!message) return null;

  const icon = type === "success" ? <FiCheck /> : <FiAlertCircle />;
  const classes = `notification notification-${type} ${className}`.trim();

  return (
    <div className={classes} role="alert" aria-live="polite">
      <span className="notification-icon" aria-hidden="true">{icon}</span>
      <span className="notification-message">{message}</span>
    </div>
  );
};

Notification.propTypes = {
  message: PropTypes.string,
  type: PropTypes.oneOf(["success", "error"]),
  className: PropTypes.string,
};

export default Notification;

