import React from "react";
import PropTypes from "prop-types";
import "./Input.css";

const Input = ({
  label,
  id,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  helpText,
  icon,
  className = "",
  ...props
}) => {
  const inputId = id || name;
  const errorId = error ? `${inputId}-error` : undefined;
  const helpId = helpText ? `${inputId}-help` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="required-indicator" aria-label="required">*</span>}
        </label>
      )}
      <div className="input-wrapper">
        {icon && <span className="input-icon" aria-hidden="true">{icon}</span>}
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`form-input ${error ? "form-input-error" : ""} ${icon ? "form-input-with-icon" : ""}`}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={describedBy}
          aria-required={required}
          {...props}
        />
      </div>
      {error && (
        <div id={errorId} className="form-error" role="alert">
          {error}
        </div>
      )}
      {helpText && !error && (
        <small id={helpId} className="form-help">
          {helpText}
        </small>
      )}
    </div>
  );
};

Input.propTypes = {
  label: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  helpText: PropTypes.string,
  icon: PropTypes.node,
  className: PropTypes.string,
};

export default Input;

