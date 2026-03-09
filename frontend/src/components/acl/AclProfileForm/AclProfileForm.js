import React, { useState } from "react";
import PropTypes from "prop-types";
import { FiPlus, FiCheck, FiX, FiInfo } from "react-icons/fi";
import { Button, Input } from "../../common";
import { toErrorString } from "../../../utils/errors";
import AclRuleRow from "./AclRuleRow";

const genId = () => {
  try { return window.crypto.randomUUID(); } catch { /* jsdom / old browser fallback */ }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const makeRule = () => ({ _id: genId(), access: true, address: "" });

/**
 * Quick client-side plausibility check for an IP/CIDR address.
 * The server (Python ipaddress.ip_network) performs authoritative validation;
 * this function only catches obviously wrong input to improve UX.
 */
const isValidAddress = (addr) => {
  if (addr === "") return true; // catch-all
  // IPv4: each octet 0-255, optional prefix 0-32
  if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(addr)) {
    const [ip, prefix] = addr.split("/");
    const octets = ip.split(".");
    if (octets.some((o) => parseInt(o, 10) > 255)) return false;
    if (prefix !== undefined && parseInt(prefix, 10) > 32) return false;
    return true;
  }
  // IPv6: defer detailed validation to the server.
  // Only reject strings with characters illegal in IPv6 notation.
  if (addr.includes(":") && /^[0-9a-fA-F:]+(?:\/\d{1,3})?$/.test(addr)) {
    if (addr.includes(":::")) return false;
    if (addr.includes("/")) {
      const prefix = parseInt(addr.split("/")[1], 10);
      if (prefix > 128) return false;
    }
    // Reject obviously malformed addresses: more than 8 groups
    const ipPart = addr.split("/")[0];
    const groups = ipPart.split(":");
    if (groups.length > 8) return false;
    return true;
  }
  return false;
};

function AclProfileForm({ editingProfile, onSave, onCancel, initialName, initialRules }) {
  const [formName, setFormName] = useState(initialName);
  const [formRules, setFormRules] = useState(
    () => initialRules.length ? initialRules.map((r) => ({ ...r, _id: r._id || genId() })) : [makeRule()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isNew = editingProfile === "new";

  const addRule = () => setFormRules((prev) => [...prev, makeRule()]);

  const removeRule = (idx) =>
    setFormRules((prev) => prev.filter((_, i) => i !== idx));

  const updateRule = (idx, field, value) =>
    setFormRules((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const handleToggleAccess = (idx, allow) => {
    updateRule(idx, "access", allow);
  };

  const handleAddressChange = (idx, value) => {
    updateRule(idx, "address", value);
  };

  const handleSave = async () => {
    if (!formName.trim()) { setError("Profile name is required."); return; }
    const badRule = formRules.find((r) => !isValidAddress(r.address));
    if (badRule) {
      const idx = formRules.indexOf(badRule) + 1;
      setError(`Rule ${idx}: "${badRule.address}" is not a valid IP address or CIDR range.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: formName.trim(), rules: formRules.map(({ _id, ...rest }) => rest) };
      const uuid = isNew ? null : editingProfile.uuid;
      await onSave(uuid, payload);
    } catch (err) {
      setError(toErrorString(err, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acl-form">
      {error && (
        <div className="acl-error" role="alert">
          <FiX className="acl-error-icon" /> {error}
        </div>
      )}
      <Input
        label="Profile Name"
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        placeholder="e.g. Home Network Only"
        required
      />

      <div className="acl-rules-section">
        <div className="acl-rules-header">
          <span className="acl-rules-label">
            IP Rules
            <span className="acl-rules-hint"> — evaluated top to bottom, first match wins</span>
          </span>
          <Button type="button" variant="secondary" size="small" onClick={addRule} icon={<FiPlus />}>
            Add Rule
          </Button>
        </div>

        {formRules.length === 0 ? (
          <div className="acl-rules-empty">No rules yet — all traffic will be allowed.</div>
        ) : (
          <div className="acl-rules-list">
            {formRules.map((rule, idx) => (
              <AclRuleRow
                key={rule._id}
                index={idx}
                rule={rule}
                totalRules={formRules.length}
                onToggleAccess={handleToggleAccess}
                onAddressChange={handleAddressChange}
                onRemove={removeRule}
              />
            ))}
          </div>
        )}

        <p className="acl-tip">
          <FiInfo className="acl-tip-icon" />
          End with a <strong>Deny</strong> + empty address to block all unmatched traffic.
        </p>
      </div>

      <div className="acl-form-actions">
        <Button variant="primary" onClick={handleSave} loading={saving} icon={<FiCheck />}>
          {isNew ? "Create Profile" : "Save Changes"}
        </Button>
        <Button variant="secondary" onClick={onCancel} icon={<FiX />}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

AclProfileForm.propTypes = {
  editingProfile: PropTypes.oneOfType([
    PropTypes.oneOf(["new"]),
    PropTypes.shape({ uuid: PropTypes.string.isRequired, name: PropTypes.string }),
  ]).isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  initialName: PropTypes.string.isRequired,
  initialRules: PropTypes.array.isRequired,
};

export default AclProfileForm;
