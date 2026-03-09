import React from "react";
import PropTypes from "prop-types";
import { FiTrash2 } from "react-icons/fi";

function AclRuleRow({ index, rule, totalRules, onToggleAccess, onAddressChange, onRemove }) {
  const placeholder =
    index === totalRules - 1 && rule.address === ""
      ? "empty = catch-all"
      : "192.168.1.0/24 or 10.0.0.1";

  return (
    <div className="acl-rule-row">
      <span className="acl-rule-num">{index + 1}</span>
      <div className="acl-seg" role="group" aria-label="Access type">
        <button
          type="button"
          className={`acl-seg-btn acl-seg-allow${rule.access ? " active" : ""}`}
          onClick={() => onToggleAccess(index, true)}
        >
          Allow
        </button>
        <button
          type="button"
          className={`acl-seg-btn acl-seg-deny${!rule.access ? " active" : ""}`}
          onClick={() => onToggleAccess(index, false)}
        >
          Deny
        </button>
      </div>
      <input
        type="text"
        className="form-input acl-address-input"
        value={rule.address}
        onChange={(e) => onAddressChange(index, e.target.value)}
        placeholder={placeholder}
        aria-label={`Rule ${index + 1} address`}
      />
      <button
        type="button"
        className="acl-remove-btn"
        onClick={() => onRemove(index)}
        disabled={totalRules === 1}
        aria-label={`Remove rule ${index + 1}`}
        title="Remove rule"
      >
        <FiTrash2 />
      </button>
    </div>
  );
}

AclRuleRow.propTypes = {
  index: PropTypes.number.isRequired,
  rule: PropTypes.shape({
    access: PropTypes.bool.isRequired,
    address: PropTypes.string.isRequired,
  }).isRequired,
  totalRules: PropTypes.number.isRequired,
  onToggleAccess: PropTypes.func.isRequired,
  onAddressChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default AclRuleRow;

