import React from "react";
import PropTypes from "prop-types";
import "./Toolbar.css";

const Toolbar = ({ left, right, className = "" }) => {
  return (
    <div className={`toolbar ${className}`}>
      <div className="toolbar-left">{left}</div>
      {right && <div className="toolbar-right">{right}</div>}
    </div>
  );
};

Toolbar.propTypes = {
  left: PropTypes.node,
  right: PropTypes.node,
  className: PropTypes.string,
};

export default Toolbar;

