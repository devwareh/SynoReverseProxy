import React from "react";
import PropTypes from "prop-types";
import "./Button.css";

const Button = ({
  children,
  variant = "primary",
  size = "medium",
  icon,
  iconPosition = "left",
  disabled = false,
  loading = false,
  type = "button",
  onClick,
  className = "",
  ariaLabel,
  ...props
}) => {
  const baseClass = "btn";
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;
  const iconOnlyClass = icon && !children ? "btn-icon-only" : "";
  const classes = `${baseClass} ${variantClass} ${sizeClass} ${iconOnlyClass} ${className}`.trim();

  const renderIcon = () => {
    if (!icon) return null;
    return <span className={`btn-icon-wrapper btn-icon-${iconPosition}`}>{icon}</span>;
  };

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel || (icon && !children ? "Button" : undefined)}
      aria-busy={loading}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true"></span>}
      {iconPosition === "left" && renderIcon()}
      {children && <span className="btn-text">{children}</span>}
      {iconPosition === "right" && renderIcon()}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(["primary", "secondary", "danger", "icon"]),
  size: PropTypes.oneOf(["small", "medium", "large"]),
  icon: PropTypes.node,
  iconPosition: PropTypes.oneOf(["left", "right"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  onClick: PropTypes.func,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};

export default Button;

