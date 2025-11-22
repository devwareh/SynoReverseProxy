import React from "react";
import PropTypes from "prop-types";
import "./EmptyState.css";

const EmptyState = ({
  icon,
  title,
  message,
  action,
  className = "",
}) => {
  return (
    <div className={`empty-state ${className}`}>
      {icon && <div className="empty-icon" aria-hidden="true">{icon}</div>}
      {title && <h3 className="empty-title">{title}</h3>}
      {message && <p className="empty-message">{message}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
};

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string,
  message: PropTypes.string,
  action: PropTypes.node,
  className: PropTypes.string,
};

export default EmptyState;

