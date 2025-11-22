import React from "react";
import PropTypes from "prop-types";
import Spinner from "../../common/Spinner/Spinner";
import "./LoadingState.css";

const LoadingState = ({ message = "Loading...", className = "" }) => {
  return (
    <div className={`loading-state ${className}`}>
      <Spinner size="large" />
      <p className="loading-message">{message}</p>
    </div>
  );
};

LoadingState.propTypes = {
  message: PropTypes.string,
  className: PropTypes.string,
};

export default LoadingState;

