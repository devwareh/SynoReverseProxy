import React, { useState } from "react";
import PropTypes from "prop-types";
import { FiSettings, FiGlobe, FiServer, FiClock, FiCode, FiCheck, FiX, FiTrash2 } from "react-icons/fi";
import { Input, Select, Checkbox as CheckboxComponent, Button } from "../../common";
import { PROTOCOL_OPTIONS, HTTP_VERSION_OPTIONS, HEADER_PRESETS } from "../../../utils/constants";
import "./RuleForm.css";

const RuleForm = ({
  fields,
  onChange,
  onSubmit,
  onCancel,
  editingRule = null,
  loading = false,
  error = null,
}) => {
  const [showJsonView, setShowJsonView] = useState(false);
  const [customHeadersText, setCustomHeadersText] = useState(JSON.stringify(fields.customize_headers || [], null, 2));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    onChange({
      ...fields,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value) || 0 : value,
    });
  };

  const handleHeaderChange = (index, field, value) => {
    const newHeaders = [...(fields.customize_headers || [])];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    onChange({ ...fields, customize_headers: newHeaders });
    setCustomHeadersText(JSON.stringify(newHeaders, null, 2));
  };

  const addHeader = () => {
    const newHeaders = [...(fields.customize_headers || []), { name: "", value: "" }];
    onChange({ ...fields, customize_headers: newHeaders });
    setCustomHeadersText(JSON.stringify(newHeaders, null, 2));
  };

  const removeHeader = (index) => {
    const newHeaders = (fields.customize_headers || []).filter((_, i) => i !== index);
    onChange({ ...fields, customize_headers: newHeaders });
    setCustomHeadersText(JSON.stringify(newHeaders, null, 2));
  };

  const addPresetHeader = (preset) => {
    const newHeaders = [...(fields.customize_headers || []), { ...preset }];
    onChange({ ...fields, customize_headers: newHeaders });
    setCustomHeadersText(JSON.stringify(newHeaders, null, 2));
  };

  const toggleJsonView = () => {
    if (!showJsonView) {
      setCustomHeadersText(JSON.stringify(fields.customize_headers || [], null, 2));
    } else {
      try {
        const parsed = JSON.parse(customHeadersText);
        if (Array.isArray(parsed)) {
          onChange({ ...fields, customize_headers: parsed });
        }
      } catch {
        // Invalid JSON - keep current headers
      }
    }
    setShowJsonView(!showJsonView);
  };

  const handleJsonChange = (e) => {
    setCustomHeadersText(e.target.value);
    try {
      const parsed = JSON.parse(e.target.value);
      if (Array.isArray(parsed)) {
        onChange({ ...fields, customize_headers: parsed });
      }
    } catch {
      // Invalid JSON - user is still typing
    }
  };

  const handleJsonBlur = () => {
    try {
      const parsed = JSON.parse(customHeadersText);
      if (Array.isArray(parsed)) {
        onChange({ ...fields, customize_headers: parsed });
        setCustomHeadersText(JSON.stringify(parsed, null, 2));
      }
    } catch {
      // Reset to current headers on invalid JSON
      setCustomHeadersText(JSON.stringify(fields.customize_headers || [], null, 2));
    }
  };

  return (
    <div className="form-container">
      <h2>{editingRule ? "Edit Rule" : "Create New Rule"}</h2>
      {error && (
        <div className="form-error-message" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit}>
        {/* Basic Information */}
        <div className="form-section">
          <h3>
            <FiSettings className="section-icon" aria-hidden="true" /> Basic Information
          </h3>
          <div className="form-grid">
            <Input
              label="Description"
              name="description"
              value={fields.description}
              onChange={handleChange}
              required
              placeholder="My Reverse Proxy Rule"
            />
          </div>
        </div>

        {/* Frontend Configuration */}
        <div className="form-section">
          <h3>
            <FiGlobe className="section-icon" aria-hidden="true" /> Frontend Configuration (Public-Facing)
          </h3>
          <div className="form-grid">
            <Input
              label="Frontend FQDN"
              name="frontend_fqdn"
              type="text"
              value={fields.frontend_fqdn}
              onChange={handleChange}
              required
              placeholder="example.com"
            />
            <Input
              label="Frontend Port"
              name="frontend_port"
              type="number"
              value={fields.frontend_port}
              onChange={handleChange}
              required
              min="1"
              max="65535"
            />
            <Select
              label="Frontend Protocol"
              name="frontend_protocol"
              value={fields.frontend_protocol}
              onChange={handleChange}
              options={PROTOCOL_OPTIONS}
            />
            <div className="form-group">
              <CheckboxComponent
                name="frontend_hsts"
                checked={fields.frontend_hsts}
                onChange={handleChange}
                label="Enable HSTS (HTTP Strict Transport Security)"
              />
            </div>
          </div>
        </div>

        {/* Backend Configuration */}
        <div className="form-section">
          <h3>
            <FiServer className="section-icon" aria-hidden="true" /> Backend Configuration (Internal Service)
          </h3>
          <div className="form-grid">
            <Input
              label="Backend FQDN"
              name="backend_fqdn"
              type="text"
              value={fields.backend_fqdn}
              onChange={handleChange}
              required
              placeholder="localhost"
            />
            <Input
              label="Backend Port"
              name="backend_port"
              type="number"
              value={fields.backend_port}
              onChange={handleChange}
              required
              min="1"
              max="65535"
            />
            <Select
              label="Backend Protocol"
              name="backend_protocol"
              value={fields.backend_protocol}
              onChange={handleChange}
              options={PROTOCOL_OPTIONS}
            />
          </div>
        </div>

        {/* Proxy Settings */}
        <div className="form-section">
          <h3>
            <FiClock className="section-icon" aria-hidden="true" /> Proxy Settings
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <CheckboxComponent
                name="proxy_intercept_errors"
                checked={fields.proxy_intercept_errors}
                onChange={handleChange}
                label="Intercept Errors"
              />
            </div>
            <Select
              label="HTTP Version"
              name="proxy_http_version"
              value={fields.proxy_http_version}
              onChange={handleChange}
              options={HTTP_VERSION_OPTIONS}
            />
            <Input
              label="Connect Timeout (seconds)"
              name="proxy_connect_timeout"
              type="number"
              value={fields.proxy_connect_timeout}
              onChange={handleChange}
              min="1"
              max="3600"
            />
            <Input
              label="Read Timeout (seconds)"
              name="proxy_read_timeout"
              type="number"
              value={fields.proxy_read_timeout}
              onChange={handleChange}
              min="1"
              max="3600"
            />
            <Input
              label="Send Timeout (seconds)"
              name="proxy_send_timeout"
              type="number"
              value={fields.proxy_send_timeout}
              onChange={handleChange}
              min="1"
              max="3600"
            />
          </div>
        </div>

        {/* Advanced Options */}
        <div className="form-section">
          <div className="form-section-header">
            <h3>
              <FiCode className="section-icon" aria-hidden="true" /> Advanced: Custom Headers
            </h3>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={toggleJsonView}
              ariaLabel={showJsonView ? "Switch to visual editor" : "Switch to JSON view"}
            >
              {showJsonView ? "Visual Editor" : "Advanced JSON View"}
            </Button>
          </div>

          {!showJsonView ? (
            <>
              <div className="preset-headers">
                <label className="preset-headers-label">Quick Add Common Headers:</label>
                <div className="preset-headers-buttons">
                  {HEADER_PRESETS.map((preset, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant="secondary"
                      size="small"
                      onClick={() => addPresetHeader(preset)}
                      ariaLabel={`Add ${preset.name} header`}
                    >
                      + {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="headers-list">
                {fields.customize_headers?.length === 0 ? (
                  <div className="headers-empty">
                    No custom headers added. Click "Add Header" or use preset buttons above.
                  </div>
                ) : (
                  fields.customize_headers.map((header, index) => (
                    <div key={index} className="header-row">
                      <Input
                        placeholder="Header Name (e.g., X-Forwarded-For)"
                        value={header.name || ""}
                        onChange={(e) => handleHeaderChange(index, "name", e.target.value)}
                        className="header-input"
                      />
                      <Input
                        placeholder="Header Value (e.g., $remote_addr)"
                        value={header.value || ""}
                        onChange={(e) => handleHeaderChange(index, "value", e.target.value)}
                        className="header-input"
                      />
                      <Button
                        type="button"
                        variant="icon"
                        onClick={() => removeHeader(index)}
                        ariaLabel={`Remove header ${index + 1}`}
                      >
                        <FiTrash2 />
                      </Button>
                    </div>
                  ))
                )}
                <Button type="button" variant="secondary" onClick={addHeader} style={{ width: "100%", marginTop: "10px" }}>
                  + Add Header
                </Button>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="custom-headers-json" className="form-label">
                Custom Headers (JSON array)
              </label>
              <textarea
                id="custom-headers-json"
                value={customHeadersText}
                onChange={handleJsonChange}
                onBlur={handleJsonBlur}
                placeholder='[{"name": "X-Custom-Header", "value": "custom-value"}]'
                rows="8"
                className="json-textarea"
                aria-describedby="json-help"
              />
              <small id="json-help" className="form-help">
                Enter a JSON array of header objects with "name" and "value" properties.
              </small>
            </div>
          )}
        </div>

        <div className="form-actions">
          <Button type="submit" variant="primary" loading={loading} icon={<FiCheck />}>
            {editingRule ? "Update Rule" : "Create Rule"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} icon={<FiX />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

RuleForm.propTypes = {
  fields: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  editingRule: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string,
};

export default RuleForm;

