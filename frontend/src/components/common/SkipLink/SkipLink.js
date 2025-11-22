import React from "react";
import "./SkipLink.css";

const SkipLink = ({ targetId = "main-content", label = "Skip to main content" }) => {
  return (
    <a href={`#${targetId}`} className="skip-link">
      {label}
    </a>
  );
};

export default SkipLink;

