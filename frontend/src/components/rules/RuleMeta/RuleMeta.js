import React from "react";
import PropTypes from "prop-types";
import { FiClock, FiCode } from "react-icons/fi";
import "./RuleMeta.css";

const RuleMeta = ({ connectTimeout, readTimeout, sendTimeout, customHeadersCount }) => {
  return (
    <div className="rule-meta">
      <span className="meta-item">
        <FiClock aria-hidden="true" />
        Timeouts: {connectTimeout}s / {readTimeout}s / {sendTimeout}s
      </span>
      <span className="meta-item">
        <FiCode aria-hidden="true" />
        {customHeadersCount} Custom Header{customHeadersCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
};

RuleMeta.propTypes = {
  connectTimeout: PropTypes.number.isRequired,
  readTimeout: PropTypes.number.isRequired,
  sendTimeout: PropTypes.number.isRequired,
  customHeadersCount: PropTypes.number.isRequired,
};

export default RuleMeta;

