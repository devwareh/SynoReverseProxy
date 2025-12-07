import React from "react";
import PropTypes from "prop-types";
import "./Header.css";

const Header = ({ title, subtitle, className = "", rightActions }) => {
  // Parse subtitle to extract user info if present
  const renderSubtitle = () => {
    if (!subtitle) return null;
    
    // Check if subtitle contains user info (format: "text • Logged in as user")
    const userMatch = subtitle.match(/^(.*?)\s*•\s*Logged in as\s+(.+)$/);
    
    if (userMatch) {
      const [, mainText, username] = userMatch;
      return (
        <div className="header-subtitle">
          {mainText && <span>{mainText.trim()}</span>}
          {mainText && username && (
            <span className="header-subtitle-separator" aria-hidden="true">•</span>
          )}
          {username && (
            <span className="header-user-badge">
              <span aria-label="Logged in as">👤</span>
              {username.trim()}
            </span>
          )}
        </div>
      );
    }
    
    // Regular subtitle without user info
    return <div className="header-subtitle">{subtitle}</div>;
  };

  return (
    <header className={`app-header ${className}`}>
      <div className="header-content">
        <div className="header-text">
          <h1 className="header-title">{title}</h1>
          {renderSubtitle()}
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

