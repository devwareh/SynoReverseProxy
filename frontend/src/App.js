import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  FiEdit2, 
  FiTrash2, 
  FiPlus, 
  FiSearch, 
  FiX, 
  FiCheck, 
  FiAlertCircle,
  FiGlobe,
  FiServer,
  FiArrowRight,
  FiShield,
  FiSettings,
  FiClock,
  FiCode,
  FiCopy,
  FiDownload,
  FiUpload
} from "react-icons/fi";
import "./App.css";

// Auto-detect API base URL
// In development, use current hostname (works for localhost and network access)
// In production build, this will be relative or use REACT_APP_API_URL env var
const getApiBase = () => {
  // Check for environment variable first (for production builds)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Detect if accessing via domain (not localhost or IP address)
  // Domain names contain dots and are not localhost or IP pattern
  const isDomainAccess = hostname.includes('.') && 
                         hostname !== 'localhost' && 
                         !/^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  
  if (isDomainAccess) {
    // When accessed via domain, use relative /api path
    // Frontend nginx will proxy these requests to the backend
    return `${protocol}//${hostname}/api`;
  }
  
  // For IP/localhost access: use IP:port (direct access)
  const port = process.env.REACT_APP_API_PORT || (hostname === 'localhost' ? '8000' : '18888');
  return `${protocol}//${hostname === 'localhost' ? 'localhost' : hostname}:${port}`;
};

const API_BASE = getApiBase();

function App() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [fields, setFields] = useState({
    description: "",
    backend_fqdn: "",
    backend_port: 5000,
    frontend_fqdn: "",
    frontend_port: 443,
    backend_protocol: 0,
    frontend_protocol: 1,
    frontend_hsts: false,
    customize_headers: [],
    proxy_connect_timeout: 60,
    proxy_read_timeout: 60,
    proxy_send_timeout: 60,
    proxy_http_version: 1,
    proxy_intercept_errors: false,
    acl: null,
  });
  const [customHeadersText, setCustomHeadersText] = useState("[]");
  const [showJsonView, setShowJsonView] = useState(false);
  const [selectedRules, setSelectedRules] = useState(new Set());
  const [showFirstLogin, setShowFirstLogin] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [firstLoginLoading, setFirstLoginLoading] = useState(false);
  
  // Common header presets
  const headerPresets = [
    { name: "X-Forwarded-For", value: "$remote_addr" },
    { name: "X-Real-IP", value: "$remote_addr" },
    { name: "X-Forwarded-Proto", value: "$scheme" },
    { name: "Upgrade", value: "$http_upgrade" },
    { name: "Connection", value: "$connection_upgrade" },
  ];

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/rules`);
      const entries = res.data.data?.entries || [];
      setRules(entries);
      setShowFirstLogin(false); // Hide first-login if rules load successfully
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      
      // Properly extract error message from object or string
      let errorMsg;
      if (typeof errorDetail === 'object' && errorDetail !== null) {
        // Prefer message field, then error field, then stringify the whole object
        errorMsg = errorDetail.message || errorDetail.error || JSON.stringify(errorDetail);
      } else if (errorDetail) {
        errorMsg = String(errorDetail);
      } else {
        errorMsg = err.message || String(err);
      }
      
      // Only show error message if it's not an auth error (we'll show modal instead)
      const isAuthError = 
        // Check status code
        err.response?.status === 401 ||
        // Check error detail object
        (typeof errorDetail === 'object' && errorDetail !== null && (
          errorDetail.requires_first_login === true ||
          errorDetail.error === 'authentication_required'
        )) ||
        // Check error message strings
        (typeof errorMsg === 'string' && (
          errorMsg.includes("No valid session") || 
          errorMsg.includes("device token") || 
          errorMsg.includes("first-login") ||
          errorMsg.includes("authentication_required")
        ));
      
      if (isAuthError) {
        // For auth errors, show a user-friendly message and the modal
        setError("Authentication required. Please complete first-time setup.");
        setShowFirstLogin(true);
      } else {
        // For other errors, show the actual error message
        setError(`Failed to load rules: ${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFirstLogin = async () => {
    setFirstLoginLoading(true);
    setError(null);
    try {
      const payload = otpCode.trim() ? { otp_code: otpCode.trim() } : {};
      const res = await axios.post(`${API_BASE}/auth/first-login`, payload);
      
      if (res.data.success) {
        showNotification(
          res.data.message || "First login successful! Device token saved.",
          "success"
        );
        setShowFirstLogin(false);
        setOtpCode("");
        // Refresh rules after successful login
        await fetchRules();
      } else {
        setError(res.data.message || "First login failed");
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      if (errorDetail && typeof errorDetail === 'object') {
        setError(errorDetail.message || errorDetail.error || "First login failed");
      } else {
        setError(errorDetail || err.message || "First login failed");
      }
    } finally {
      setFirstLoginLoading(false);
    }
  };

  const showNotification = (message, type = "success") => {
    if (type === "success") {
      setSuccess(message);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const resetForm = () => {
    setFields({
      description: "",
      backend_fqdn: "",
      backend_port: 5000,
      frontend_fqdn: "",
      frontend_port: 443,
      backend_protocol: 0,
      frontend_protocol: 1,
      frontend_hsts: false,
      customize_headers: [],
      proxy_connect_timeout: 60,
      proxy_read_timeout: 60,
      proxy_send_timeout: 60,
      proxy_http_version: 1,
      proxy_intercept_errors: false,
      acl: null,
    });
    setCustomHeadersText("[]");
    setShowJsonView(false);
    setEditingRule(null);
    setShowForm(false);
  };
  
  const addHeader = () => {
    setFields({
      ...fields,
      customize_headers: [...fields.customize_headers, { name: "", value: "" }],
    });
  };
  
  const removeHeader = (index) => {
    const newHeaders = fields.customize_headers.filter((_, i) => i !== index);
    setFields({ ...fields, customize_headers: newHeaders });
    setCustomHeadersText(JSON.stringify(newHeaders, null, 2));
  };
  
  const updateHeader = (index, field, value) => {
    const newHeaders = [...fields.customize_headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    setFields({ ...fields, customize_headers: newHeaders });
    setCustomHeadersText(JSON.stringify(newHeaders, null, 2));
  };
  
  const addPresetHeader = (preset) => {
    const newHeaders = [...fields.customize_headers, { ...preset }];
    setFields({ ...fields, customize_headers: newHeaders });
    setCustomHeadersText(JSON.stringify(newHeaders, null, 2));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFields({
      ...fields,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value) || 0 : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Validate rule before submitting
    const validation = await validateRule();
    if (!validation.valid) {
      setLoading(false);
      const errorMessages = [
        ...(validation.errors || []),
        ...(validation.conflicts || []).map(c => `Conflict: ${c.frontend} already used by "${c.description}"`)
      ];
      showNotification(`Validation failed: ${errorMessages.join("; ")}`, "error");
      return;
    }
    
    try {
      if (editingRule) {
        await axios.put(`${API_BASE}/rules/${editingRule.id}`, fields);
        showNotification("Rule updated successfully!");
      } else {
        await axios.post(`${API_BASE}/rules`, fields);
        showNotification("Rule created successfully!");
      }
      resetForm();
      fetchRules();
    } catch (err) {
      showNotification(
        `Failed to ${editingRule ? "update" : "create"} rule: ${err.response?.data?.detail || err.message}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (ruleId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/rules/${ruleId}`);
      const rule = res.data.data?.entry;
      if (rule) {
        const headers = rule.customize_headers || [];
        setFields({
          description: rule.description || "",
          backend_fqdn: rule.backend?.fqdn || "",
          backend_port: rule.backend?.port || 5000,
          frontend_fqdn: rule.frontend?.fqdn || "",
          frontend_port: rule.frontend?.port || 443,
          backend_protocol: rule.backend?.protocol ?? 0,
          frontend_protocol: rule.frontend?.protocol ?? 1,
          frontend_hsts: rule.frontend?.https?.hsts || false,
          customize_headers: headers,
          proxy_connect_timeout: rule.proxy_connect_timeout || 60,
          proxy_read_timeout: rule.proxy_read_timeout || 60,
          proxy_send_timeout: rule.proxy_send_timeout || 60,
          proxy_http_version: rule.proxy_http_version || 1,
          proxy_intercept_errors: rule.proxy_intercept_errors || false,
          acl: rule.frontend?.acl || null,
        });
        setCustomHeadersText(JSON.stringify(headers, null, 2));
        setShowJsonView(false);
        setEditingRule({ id: ruleId });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      showNotification(`Failed to load rule: ${err.response?.data?.detail || err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ruleId, description) => {
    if (!window.confirm(`Are you sure you want to delete "${description}"?`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API_BASE}/rules/${ruleId}`);
      showNotification("Rule deleted successfully!");
      // Remove from selection if it was selected
      setSelectedRules(prev => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
      fetchRules();
    } catch (err) {
      showNotification(`Failed to delete rule: ${err.response?.data?.detail || err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const selectedArray = Array.from(selectedRules);
    if (selectedArray.length === 0) return;

    // Get rule descriptions for confirmation
    const selectedRuleDescriptions = rules
      .filter(rule => {
        const ruleId = rule.UUID || rule.uuid || rule.id;
        return selectedRules.has(ruleId);
      })
      .map(rule => rule.description || "Unnamed Rule");

    const confirmMessage = `Are you sure you want to delete ${selectedArray.length} rule(s)?\n\n${selectedRuleDescriptions.slice(0, 5).join("\n")}${selectedRuleDescriptions.length > 5 ? `\n...and ${selectedRuleDescriptions.length - 5} more` : ""}\n\nThis cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/rules/bulk-delete`, selectedArray);
      showNotification(`${selectedArray.length} rule(s) deleted successfully!`);
      setSelectedRules(new Set());
      fetchRules();
    } catch (err) {
      showNotification(`Failed to delete rules: ${err.response?.data?.detail || err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleRuleSelection = (ruleId) => {
    setSelectedRules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRules.size === filteredRules.length) {
      // Deselect all
      setSelectedRules(new Set());
    } else {
      // Select all filtered rules
      const allIds = filteredRules.map(rule => rule.UUID || rule.uuid || rule.id).filter(Boolean);
      setSelectedRules(new Set(allIds));
    }
  };

  const clearSelection = () => {
    setSelectedRules(new Set());
  };

  const handleDuplicate = async (ruleId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/rules/${ruleId}`);
      const rule = res.data.data?.entry;
      if (rule) {
        const headers = rule.customize_headers || [];
        setFields({
          description: `${rule.description || "Unnamed Rule"} (Copy)`,
          backend_fqdn: rule.backend?.fqdn || "",
          backend_port: rule.backend?.port || 5000,
          frontend_fqdn: rule.frontend?.fqdn || "",
          frontend_port: rule.frontend?.port || 443,
          backend_protocol: rule.backend?.protocol || 0,
          frontend_protocol: rule.frontend?.protocol || 1,
          frontend_hsts: rule.frontend?.https?.hsts || false,
          customize_headers: headers,
          proxy_connect_timeout: rule.proxy_connect_timeout || 60,
          proxy_read_timeout: rule.proxy_read_timeout || 60,
          proxy_send_timeout: rule.proxy_send_timeout || 60,
          proxy_http_version: rule.proxy_http_version || 1,
          proxy_intercept_errors: rule.proxy_intercept_errors || false,
          acl: rule.frontend?.acl || null,
        });
        setCustomHeadersText(JSON.stringify(headers, null, 2));
        setShowJsonView(false);
        setEditingRule(null);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        showNotification("Rule duplicated! Please review and save.");
      }
    } catch (err) {
      showNotification(`Failed to duplicate rule: ${err.response?.data?.detail || err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/rules/export`);
      const dataStr = JSON.stringify(res.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reverse-proxy-rules-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification(`Exported ${res.data.count} rules successfully!`);
    } catch (err) {
      showNotification(`Failed to export rules: ${err.response?.data?.detail || err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const fileText = await file.text();
      const importData = JSON.parse(fileText);
      
      if (!importData.rules || !Array.isArray(importData.rules)) {
        throw new Error("Invalid import file format. Expected {rules: [...]}");
      }

      const res = await axios.post(`${API_BASE}/rules/import`, { rules: importData.rules });
      
      if (res.data.success) {
        const { created, failed, skipped, total, skipped_rules } = res.data;
        
        // Build notification message with all counts
        let messageParts = [];
        if (created > 0) {
          messageParts.push(`${created} created`);
        }
        if (skipped > 0) {
          messageParts.push(`${skipped} skipped`);
        }
        if (failed > 0) {
          messageParts.push(`${failed} failed`);
        }
        
        const message = `Import completed: ${messageParts.join(", ")} out of ${total} rules.`;
        
        if (failed > 0) {
          showNotification(message, "error");
          console.error("Import errors:", res.data.errors);
          if (skipped > 0) {
            console.log("Skipped rules:", res.data.skipped_rules);
          }
        } else if (skipped > 0) {
          showNotification(message);
          console.log("Skipped rules:", res.data.skipped_rules);
        } else {
          showNotification(message);
        }
        
        fetchRules();
      }
    } catch (err) {
      showNotification(`Failed to import rules: ${err.response?.data?.detail || err.message}`, "error");
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const validateRule = async () => {
    try {
      const excludeId = editingRule?.id || null;
      const res = await axios.post(
        `${API_BASE}/rules/validate${excludeId ? `?exclude_rule_id=${excludeId}` : ""}`,
        fields
      );
      return res.data;
    } catch (err) {
      return {
        valid: false,
        errors: [err.response?.data?.detail || err.message || "Validation failed"]
      };
    }
  };

  const filteredRules = rules.filter((rule) =>
    rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.frontend?.fqdn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.backend?.fqdn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Synology Reverse Proxy Manager</h1>
        <p>Manage your reverse proxy rules</p>
      </header>

      <div className="app-content">
        {success && (
          <div className="notification success">
            <FiCheck className="notification-icon" /> {success}
          </div>
        )}
        {error && (
          <div className="notification error">
            <FiAlertCircle className="notification-icon" /> {error}
          </div>
        )}

        {/* First Login Modal */}
        {showFirstLogin && (
          <div className="modal-overlay" onClick={() => setShowFirstLogin(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  <FiShield /> First-Time Setup Required
                </h2>
                <button
                  className="modal-close"
                  onClick={() => setShowFirstLogin(false)}
                  title="Close"
                >
                  <FiX />
                </button>
              </div>
              <div className="modal-body">
                <p>
                  This is your first time using the application. You need to perform an initial authentication to establish a device token.
                </p>
                <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#666" }}>
                  <strong>Note:</strong> If your Synology account has 2FA enabled, you'll need to provide an OTP code. Otherwise, you can leave it empty.
                </p>
                <div style={{ marginTop: "1.5rem" }}>
                  <label htmlFor="otp-code" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    OTP Code (Optional - only if 2FA is enabled):
                  </label>
                  <input
                    id="otp-code"
                    type="text"
                    placeholder="Enter 6-digit OTP code (or leave empty if no 2FA)"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      fontSize: "1rem",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      boxSizing: "border-box"
                    }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !firstLoginLoading) {
                        handleFirstLogin();
                      }
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowFirstLogin(false)}
                  disabled={firstLoginLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleFirstLogin}
                  disabled={firstLoginLoading}
                >
                  {firstLoginLoading ? "Authenticating..." : "Authenticate"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="toolbar">
          <div className="toolbar-left">
            {selectedRules.size > 0 ? (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={clearSelection}
                  title="Clear selection"
                >
                  <FiX /> Clear Selection
                </button>
                <span className="selection-count">
                  {selectedRules.size} selected
                </span>
                <button
                  className="btn btn-danger"
                  onClick={handleBulkDelete}
                  disabled={loading}
                  title={`Delete ${selectedRules.size} selected rule(s)`}
                >
                  <FiTrash2 /> Delete Selected ({selectedRules.size})
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    resetForm();
                    setShowForm(!showForm);
                  }}
                >
                  {showForm ? (
                    <>
                      <FiX /> Cancel
                    </>
                  ) : editingRule ? (
                    <>
                      <FiX /> Cancel Edit
                    </>
                  ) : (
                    <>
                      <FiPlus /> Create New Rule
                    </>
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleExport}
                  disabled={loading || rules.length === 0}
                  title="Export all rules to JSON"
                >
                  <FiDownload /> Export
                </button>
                <label className="btn btn-secondary" style={{ margin: 0, cursor: "pointer" }}>
                  <FiUpload /> Import
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    style={{ display: "none" }}
                    disabled={loading}
                  />
                </label>
              </>
            )}
          </div>
          <div className="search-box">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {showForm && (
          <div className="form-container">
            <h2>{editingRule ? "Edit Rule" : "Create New Rule"}</h2>
            <form onSubmit={handleSubmit}>
              {/* Basic Information */}
              <div className="form-section">
                <h3>
                  <FiSettings className="section-icon" /> Basic Information
                </h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Description *</label>
                    <input
                      type="text"
                      name="description"
                      value={fields.description}
                      onChange={handleChange}
                      required
                      placeholder="My Reverse Proxy Rule"
                    />
                  </div>
                </div>
              </div>

              {/* Frontend Configuration */}
              <div className="form-section">
                <h3>
                  <FiGlobe className="section-icon" /> Frontend Configuration (Public-Facing)
                </h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Frontend FQDN *</label>
                    <input
                      type="text"
                      name="frontend_fqdn"
                      value={fields.frontend_fqdn}
                      onChange={handleChange}
                      required
                      placeholder="example.com"
                    />
                  </div>

                  <div className="form-group">
                    <label>Frontend Port *</label>
                    <input
                      type="number"
                      name="frontend_port"
                      value={fields.frontend_port}
                      onChange={handleChange}
                      required
                      min="1"
                      max="65535"
                    />
                  </div>

                  <div className="form-group">
                    <label>Frontend Protocol</label>
                    <select name="frontend_protocol" value={fields.frontend_protocol} onChange={handleChange}>
                      <option value={0}>HTTP</option>
                      <option value={1}>HTTPS</option>
                    </select>
                  </div>

                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="frontend_hsts"
                        checked={fields.frontend_hsts}
                        onChange={handleChange}
                      />
                      Enable HSTS (HTTP Strict Transport Security)
                    </label>
                  </div>
                </div>
              </div>

              {/* Backend Configuration */}
              <div className="form-section">
                <h3>
                  <FiServer className="section-icon" /> Backend Configuration (Internal Service)
                </h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Backend FQDN *</label>
                    <input
                      type="text"
                      name="backend_fqdn"
                      value={fields.backend_fqdn}
                      onChange={handleChange}
                      required
                      placeholder="localhost"
                    />
                  </div>

                  <div className="form-group">
                    <label>Backend Port *</label>
                    <input
                      type="number"
                      name="backend_port"
                      value={fields.backend_port}
                      onChange={handleChange}
                      required
                      min="1"
                      max="65535"
                    />
                  </div>

                  <div className="form-group">
                    <label>Backend Protocol</label>
                    <select name="backend_protocol" value={fields.backend_protocol} onChange={handleChange}>
                      <option value={0}>HTTP</option>
                      <option value={1}>HTTPS</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Proxy Settings */}
              <div className="form-section">
                <h3>
                  <FiClock className="section-icon" /> Proxy Settings
                </h3>
                <div className="form-grid">
                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="proxy_intercept_errors"
                        checked={fields.proxy_intercept_errors}
                        onChange={handleChange}
                      />
                      Intercept Errors
                    </label>
                  </div>

                  <div className="form-group">
                    <label>HTTP Version</label>
                    <select name="proxy_http_version" value={fields.proxy_http_version} onChange={handleChange}>
                      <option value={0}>HTTP 1.0</option>
                      <option value={1}>HTTP 1.1</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Connect Timeout (seconds)</label>
                    <input
                      type="number"
                      name="proxy_connect_timeout"
                      value={fields.proxy_connect_timeout}
                      onChange={handleChange}
                      min="1"
                      max="3600"
                    />
                  </div>

                  <div className="form-group">
                    <label>Read Timeout (seconds)</label>
                    <input
                      type="number"
                      name="proxy_read_timeout"
                      value={fields.proxy_read_timeout}
                      onChange={handleChange}
                      min="1"
                      max="3600"
                    />
                  </div>

                  <div className="form-group">
                    <label>Send Timeout (seconds)</label>
                    <input
                      type="number"
                      name="proxy_send_timeout"
                      value={fields.proxy_send_timeout}
                      onChange={handleChange}
                      min="1"
                      max="3600"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="form-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <h3 style={{ margin: 0 }}>
                    <FiCode className="section-icon" /> Advanced: Custom Headers
                  </h3>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowJsonView(!showJsonView);
                      if (!showJsonView) {
                        // Switching to JSON view - update text from current headers
                        setCustomHeadersText(JSON.stringify(fields.customize_headers, null, 2));
                      } else {
                        // Switching to visual view - update headers from JSON
                        try {
                          const parsed = JSON.parse(customHeadersText);
                          if (Array.isArray(parsed)) {
                            setFields({ ...fields, customize_headers: parsed });
                          }
                        } catch {
                          setError("Invalid JSON in advanced view");
                        }
                      }
                    }}
                    style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                  >
                    {showJsonView ? "Visual Editor" : "Advanced JSON View"}
                  </button>
                </div>

                {!showJsonView ? (
                  <>
                    <div className="preset-headers">
                      <label style={{ marginBottom: "8px", display: "block", fontSize: "0.9rem", color: "#555" }}>
                        Quick Add Common Headers:
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "15px" }}>
                        {headerPresets.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => addPresetHeader(preset)}
                            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                          >
                            + {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="headers-list">
                      {fields.customize_headers.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#999", border: "2px dashed #e0e0e0", borderRadius: "6px" }}>
                          No custom headers added. Click "Add Header" or use preset buttons above.
                        </div>
                      ) : (
                        fields.customize_headers.map((header, index) => (
                          <div key={index} className="header-row" style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
                            <input
                              type="text"
                              placeholder="Header Name (e.g., X-Forwarded-For)"
                              value={header.name || ""}
                              onChange={(e) => updateHeader(index, "name", e.target.value)}
                              style={{ flex: 1, padding: "8px", border: "2px solid #e0e0e0", borderRadius: "6px" }}
                            />
                            <input
                              type="text"
                              placeholder="Header Value (e.g., $remote_addr)"
                              value={header.value || ""}
                              onChange={(e) => updateHeader(index, "value", e.target.value)}
                              style={{ flex: 1, padding: "8px", border: "2px solid #e0e0e0", borderRadius: "6px" }}
                            />
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => removeHeader(index)}
                              title="Remove header"
                              style={{ padding: "8px 12px" }}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        ))
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={addHeader}
                        style={{ width: "100%", marginTop: "10px" }}
                      >
                        + Add Header
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label>Custom Headers (JSON array)</label>
                    <textarea
                      value={customHeadersText}
                      onChange={(e) => {
                        setCustomHeadersText(e.target.value);
                        try {
                          const parsed = JSON.parse(e.target.value);
                          if (Array.isArray(parsed)) {
                            setFields({ ...fields, customize_headers: parsed });
                            setError(null);
                          }
                        } catch {
                          // Invalid JSON - user is still typing
                        }
                      }}
                      onBlur={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          if (Array.isArray(parsed)) {
                            setFields({ ...fields, customize_headers: parsed });
                            setCustomHeadersText(JSON.stringify(parsed, null, 2));
                            setError(null);
                          } else {
                            setError("Custom headers must be a JSON array");
                            setCustomHeadersText(JSON.stringify(fields.customize_headers, null, 2));
                          }
                        } catch (err) {
                          setError("Invalid JSON format for custom headers");
                          setCustomHeadersText(JSON.stringify(fields.customize_headers, null, 2));
                        }
                      }}
                      placeholder='[{"name": "X-Custom-Header", "value": "custom-value"}]'
                      rows="8"
                      style={{ fontFamily: "monospace", fontSize: "0.9rem" }}
                    />
                    <small style={{ color: "#666", fontSize: "0.85rem" }}>
                      Enter a JSON array of header objects with "name" and "value" properties.
                    </small>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner"></span> Processing...
                    </>
                  ) : editingRule ? (
                    <>
                      <FiCheck /> Update Rule
                    </>
                  ) : (
                    <>
                      <FiPlus /> Create Rule
                    </>
                  )}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  <FiX /> Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rules-section">
          <div className="rules-section-header">
            <h2>
              <FiGlobe className="section-icon" /> Reverse Proxy Rules ({filteredRules.length})
            </h2>
            {filteredRules.length > 0 && (
              <label className="select-all-checkbox">
                <input
                  type="checkbox"
                  checked={selectedRules.size === filteredRules.length && filteredRules.length > 0}
                  onChange={toggleSelectAll}
                  disabled={loading}
                />
                <span>Select All</span>
              </label>
            )}
          </div>
          {loading && !showForm ? (
            <div className="loading">
              <span className="spinner"></span> Loading rules...
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="empty-state">
              <FiGlobe className="empty-icon" />
              <p>{searchTerm ? "No rules match your search." : "No rules configured yet."}</p>
            </div>
          ) : (
            <div className="rules-grid">
              {filteredRules.map((rule, i) => {
                // Synology API uses 'UUID' (uppercase) field
                const ruleId = rule.UUID || rule.uuid || rule.id;
                const frontendProtocol = rule.frontend?.protocol === 1 ? "HTTPS" : "HTTP";
                const backendProtocol = rule.backend?.protocol === 1 ? "HTTPS" : "HTTP";
                const frontendPort = rule.frontend?.port || 443;
                const backendPort = rule.backend?.port || 5000;
                const frontendScheme = frontendProtocol.toLowerCase();
                const frontendFqdn = rule.frontend?.fqdn;
                const hasFrontendFqdn = Boolean(frontendFqdn);
                const frontendHref = hasFrontendFqdn ? `${frontendScheme}://${frontendFqdn}` : null;
                
                const isSelected = selectedRules.has(ruleId);
                
                return (
                <div key={ruleId || i} className={`rule-card ${isSelected ? "selected" : ""}`}>
                  <div className="rule-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRuleSelection(ruleId)}
                      disabled={loading}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="rule-header">
                    <div className="rule-title-section">
                      <h3>{rule.description || "Unnamed Rule"}</h3>
                      <div className="rule-badges">
                        <span className={`protocol-badge ${frontendProtocol.toLowerCase()}`}>
                          {frontendProtocol}
                        </span>
                        {rule.frontend?.https?.hsts && (
                          <span className="hsts-badge">
                            <FiShield /> HSTS
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rule-actions">
                      <button
                        className="btn-icon btn-duplicate"
                        onClick={() => handleDuplicate(ruleId)}
                        title="Duplicate"
                        disabled={loading}
                      >
                        <FiCopy />
                      </button>
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => handleEdit(ruleId)}
                        title="Edit"
                        disabled={loading}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(ruleId, rule.description)}
                        title="Delete"
                        disabled={loading}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                  <div className="rule-body">
                    <div className="rule-path-container">
                      <div className="rule-path frontend-path">
                        <div className="path-header">
                          <FiGlobe className="path-icon" />
                          <span className="label">Frontend</span>
                        </div>
                        <div className="path-value">
                          <span className="protocol-indicator">{frontendProtocol}</span>
                          <span className="url">
                            {frontendFqdn || "N/A"}
                            {frontendPort && <span className="port">:{frontendPort}</span>}
                          </span>
                        </div>
                      </div>
                      <div className="rule-arrow">
                        <FiArrowRight />
                      </div>
                      <div className="rule-path backend-path">
                        <div className="path-header">
                          <FiServer className="path-icon" />
                          <span className="label">Backend</span>
                        </div>
                        <div className="path-value">
                          <span className="protocol-indicator">{backendProtocol}</span>
                          <span className="url">
                            {rule.backend?.fqdn || "N/A"}
                            {backendPort && <span className="port">:{backendPort}</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rule-meta">
                      <span className="meta-item">
                        <FiClock /> Timeouts: {rule.proxy_connect_timeout || 60}s / {rule.proxy_read_timeout || 60}s / {rule.proxy_send_timeout || 60}s
                      </span>
                      <span className="meta-item">
                        <FiCode /> {rule.customize_headers?.length || 0} Custom Header{(rule.customize_headers?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {frontendHref && (
                      <div className="rule-footer">
                        <a
                          href={frontendHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="domain-pill"
                          title={`Open ${frontendScheme}://${frontendFqdn} in a new tab`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {frontendFqdn}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
