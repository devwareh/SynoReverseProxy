import React from "react";
import PropTypes from "prop-types";
import "./Spinner.css";

const Spinner = ({ size = "medium", className = "", ...props }) => {
  const sizeClass = `spinner-${size}`;
  const classes = `spinner ${sizeClass} ${className}`.trim();

  return (
    <div className={classes} role="status" aria-label="Loading" {...props}>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

Spinner.propTypes = {
  size: PropTypes.oneOf(["small", "medium", "large"]),
  className: PropTypes.string,
};

export default Spinner;

