import React from "react";
import PropTypes from "prop-types";
import "./Select.css";

const Select = ({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  required = false,
  disabled = false,
  error,
  helpText,
  className = "",
  ...props
}) => {
  const selectId = id || name;
  const errorId = error ? `${selectId}-error` : undefined;
  const helpId = helpText ? `${selectId}-help` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
          {required && <span className="required-indicator" aria-label="required">*</span>}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`form-select ${error ? "form-select-error" : ""}`}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={describedBy}
        aria-required={required}
        {...props}
      >
        {options.map((option) => {
          if (typeof option === "object") {
            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          }
          return (
            <option key={option} value={option}>
              {option}
            </option>
          );
        })}
      </select>
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

Select.propTypes = {
  label: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        label: PropTypes.string,
      }),
    ])
  ),
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  helpText: PropTypes.string,
  className: PropTypes.string,
};

export default Select;

