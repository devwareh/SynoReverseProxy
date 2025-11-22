import React from "react";
import PropTypes from "prop-types";
import "./Container.css";

const Container = ({ children, className = "", maxWidth = "85vw" }) => {
  return (
    <div className={`app-container ${className}`} style={{ maxWidth }}>
      {children}
    </div>
  );
};

Container.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  maxWidth: PropTypes.string,
};

export default Container;

