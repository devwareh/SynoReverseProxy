import React from "react";
import PropTypes from "prop-types";
import "./Header.css";

const Header = ({ title, subtitle, className = "", rightActions }) => {
  return (
    <header className={`app-header ${className}`}>
      <div className="header-content">
        <div className="header-text">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {rightActions && <div className="header-actions">{rightActions}</div>}
      </div>
    </header>
  );
};

Header.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  className: PropTypes.string,
  rightActions: PropTypes.node,
};

export default Header;

