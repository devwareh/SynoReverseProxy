import React from "react";
import PropTypes from "prop-types";
import "./Badge.css";

const Badge = ({
  children,
  variant = "default",
  size = "medium",
  icon,
  className = "",
  ...props
}) => {
  const baseClass = "badge";
  const variantClass = `badge-${variant}`;
  const sizeClass = `badge-${size}`;
  const classes = `${baseClass} ${variantClass} ${sizeClass} ${className}`.trim();

  return (
    <span className={classes} {...props}>
      {icon && <span className="badge-icon" aria-hidden="true">{icon}</span>}
      <span className="badge-text">{children}</span>
    </span>
  );
};

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(["default", "http", "https", "hsts", "success", "error", "warning"]),
  size: PropTypes.oneOf(["small", "medium", "large"]),
  icon: PropTypes.node,
  className: PropTypes.string,
};

export default Badge;

