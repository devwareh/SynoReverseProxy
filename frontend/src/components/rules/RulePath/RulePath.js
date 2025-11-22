import React from "react";
import PropTypes from "prop-types";
import { FiGlobe, FiServer, FiArrowRight } from "react-icons/fi";
import "./RulePath.css";

const RulePath = ({ frontend, backend }) => {
  return (
    <div className="rule-path-container">
      <div className="rule-path frontend-path">
        <div className="path-header">
          <FiGlobe className="path-icon" aria-hidden="true" />
          <span className="label">Frontend</span>
        </div>
        <div className="path-value">
          <span className="protocol-indicator">{frontend.protocol}</span>
          <span className="url">
            {frontend.fqdn || "N/A"}
            {frontend.port && <span className="port">:{frontend.port}</span>}
          </span>
        </div>
      </div>
      <div className="rule-arrow" aria-hidden="true">
        <FiArrowRight />
      </div>
      <div className="rule-path backend-path">
        <div className="path-header">
          <FiServer className="path-icon" aria-hidden="true" />
          <span className="label">Backend</span>
        </div>
        <div className="path-value">
          <span className="protocol-indicator">{backend.protocol}</span>
          <span className="url">
            {backend.fqdn || "N/A"}
            {backend.port && <span className="port">:{backend.port}</span>}
          </span>
        </div>
      </div>
    </div>
  );
};

RulePath.propTypes = {
  frontend: PropTypes.shape({
    protocol: PropTypes.string.isRequired,
    fqdn: PropTypes.string,
    port: PropTypes.number,
  }).isRequired,
  backend: PropTypes.shape({
    protocol: PropTypes.string.isRequired,
    fqdn: PropTypes.string,
    port: PropTypes.number,
  }).isRequired,
};

export default RulePath;

