import React from "react";
import PropTypes from "prop-types";
import "./SkeletonLoader.css";

const SkeletonLoader = ({ count = 1, className = "" }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`skeleton-loader ${className}`}>
          <div className="skeleton-header">
            <div className="skeleton-checkbox"></div>
            <div className="skeleton-title"></div>
            <div className="skeleton-badges">
              <div className="skeleton-badge"></div>
              <div className="skeleton-badge"></div>
            </div>
          </div>
          <div className="skeleton-body">
            <div className="skeleton-path">
              <div className="skeleton-path-header"></div>
              <div className="skeleton-path-value"></div>
            </div>
            <div className="skeleton-arrow"></div>
            <div className="skeleton-path">
              <div className="skeleton-path-header"></div>
              <div className="skeleton-path-value"></div>
            </div>
          </div>
          <div className="skeleton-meta">
            <div className="skeleton-meta-item"></div>
            <div className="skeleton-meta-item"></div>
          </div>
        </div>
      ))}
    </>
  );
};

SkeletonLoader.propTypes = {
  count: PropTypes.number,
  className: PropTypes.string,
};

export default SkeletonLoader;

