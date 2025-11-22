import React from "react";
import PropTypes from "prop-types";
import "./Header.css";

const Header = ({ title, subtitle, className = "" }) => {
  return (
    <header className={`app-header ${className}`}>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
};

Header.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  className: PropTypes.string,
};

export default Header;

