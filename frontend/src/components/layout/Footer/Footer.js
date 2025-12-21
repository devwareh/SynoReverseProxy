import React from "react";
import PropTypes from "prop-types";
import { APP_VERSION } from "../../../utils/version";
import "./Footer.css";

const Footer = ({ className = "" }) => {
  return (
    <footer className={`app-footer ${className}`}>
      <div className="footer-content">
        <div className="footer-left">
          <span className="footer-text">
            Synology Reverse Proxy Manager
          </span>
        </div>
        <div className="footer-right">
          <span className="footer-version">
            Version {APP_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
};

Footer.propTypes = {
  className: PropTypes.string,
};

export default Footer;






