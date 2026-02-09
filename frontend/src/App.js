// Refactored App.js using modern component architecture
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { FiPlus, FiX, FiSearch, FiShield, FiGlobe, FiDownload, FiUpload, FiTrash2, FiArrowUp, FiArrowDown, FiLayers, FiCheckCircle, FiLogOut, FiLock } from "react-icons/fi";
import useRules from "./hooks/useRules";
import useNotifications from "./hooks/useNotifications";
import { useAuth } from "./contexts/AuthContext";
import { authAPI } from "./utils/api";
import { DEFAULT_RULE_FIELDS } from "./utils/constants";
import { Header, Container, Toolbar, Footer } from "./components/layout";
import { Button, Input, SkipLink, Select } from "./components/common";
import { RuleGrid } from "./components/rules";
import { ToastContainer } from "./components/notifications";
import { EmptyState, LoadingState } from "./components/empty-states";
import Notification from "./components/notifications/Notification/Notification";
import Login from "./components/auth/Login/Login";
import Setup from "./components/auth/Setup/Setup";
import ChangePassword from "./components/auth/ChangePassword/ChangePassword";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import "./App.css";

// Lazy load heavy components for code splitting
const RuleForm = lazy(() => import("./components/forms/RuleForm/RuleForm"));
const Modal = lazy(() => import("./components/modals/Modal/Modal"));
const ConfirmDialog = lazy(() => import("./components/modals/ConfirmDialog/ConfirmDialog"));

function App() {
  // Authentication
  const { isAuthenticated, loading: authLoading, user, logout, setupRequired, checkSetupAndAuth } = useAuth();
  // Use custom hooks
  const {
    rules,
    loading,
    error: rulesError,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    bulkDeleteRules,
    getRuleById,
    validateRule,
    exportRules,
    importRules,
  } = useRules();

  const { notifications, showNotification, removeNotification } = useNotifications();

  // Local state
  const [editingRule, setEditingRule] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("description"); // Options: "description", "frontend", "backend"
  const [sortOrder, setSortOrder] = useState("asc"); // Options: "asc", "desc"
  const [showForm, setShowForm] = useState(false);
  const [fields, setFields] = useState(DEFAULT_RULE_FIELDS);
  const [selectedRules, setSelectedRules] = useState(new Set());
  const [showFirstLogin, setShowFirstLogin] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [firstLoginLoading, setFirstLoginLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Check for auth errors
  useEffect(() => {
    if ((rulesError && rulesError.includes("authentication")) || rulesError?.includes("401")) {
      setShowFirstLogin(true);
    }
  }, [rulesError]);

  // Filter and sort rules based on search and sort settings
  const filteredRules = useMemo(() => {
    // Filter first
    let filtered = rules;
    if (searchTerm && searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase().trim();
      filtered = rules.filter(
        (rule) => {
          const matchesDescription = rule.description && rule.description.toLowerCase().includes(term);
          const matchesFrontend = rule.frontend?.fqdn && rule.frontend.fqdn.toLowerCase().includes(term);
          const matchesBackend = rule.backend?.fqdn && rule.backend.fqdn.toLowerCase().includes(term);
          const matchesFrontendPort = rule.frontend?.port && rule.frontend.port.toString().includes(term);
          const matchesBackendPort = rule.backend?.port && rule.backend.port.toString().includes(term);
          return matchesDescription || matchesFrontend || matchesBackend || matchesFrontendPort || matchesBackendPort;
        }
      );
    }

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue = "";
      let bValue = "";

      switch (sortBy) {
        case "description":
          aValue = (a.description || "").toLowerCase();
          bValue = (b.description || "").toLowerCase();
          break;
        case "frontend":
          aValue = (a.frontend?.fqdn || "").toLowerCase();
          bValue = (b.frontend?.fqdn || "").toLowerCase();
          break;
        case "backend":
          aValue = (a.backend?.fqdn || "").toLowerCase();
          bValue = (b.backend?.fqdn || "").toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [rules, searchTerm, sortBy, sortOrder]);

  // Handlers
  const handleFirstLogin = async () => {
    setFirstLoginLoading(true);
    try {
      const payload = otpCode.trim() ? { otp_code: otpCode.trim() } : {};
      const res = await authAPI.firstLogin(payload.otp_code);
      if (res.data.success) {
        showNotification(res.data.message || "First login successful!", "success");
        setShowFirstLogin(false);
        setOtpCode("");
        await fetchRules();
      }
    } catch (err) {
      showNotification(err.response?.data?.detail || "First login failed", "error");
    } finally {
      setFirstLoginLoading(false);
    }
  };

  const resetForm = useCallback(() => {
    setFields(DEFAULT_RULE_FIELDS);
    setEditingRule(null);
    setShowForm(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = await validateRule(fields, editingRule?.id);
    if (!validation.valid) {
      const errorMessages = [
        ...(validation.errors || []),
        ...(validation.conflicts || []).map((c) => `Conflict: ${c.frontend} already used by "${c.description}"`),
      ];
      showNotification(`Validation failed: ${errorMessages.join("; ")}`, "error");
      return;
    }

    if (editingRule) {
      const result = await updateRule(editingRule.id, fields);
      if (result.success) {
        showNotification("Rule updated successfully!", "success");
        resetForm();
      }
    } else {
      const result = await createRule(fields);
      if (result.success) {
        showNotification("Rule created successfully!", "success");
        resetForm();
      }
    }
  };

  const handleEdit = useCallback(async (ruleId) => {
    const result = await getRuleById(ruleId);
    if (result.success && result.data) {
      const rule = result.data;
      setFields({
        description: rule.description || "",
        backend_fqdn: rule.backend?.fqdn || "",
        backend_port: rule.backend?.port || 5000,
        frontend_fqdn: rule.frontend?.fqdn || "",
        frontend_port: rule.frontend?.port || 443,
        backend_protocol: rule.backend?.protocol ?? 0,
        frontend_protocol: rule.frontend?.protocol ?? 1,
        frontend_hsts: rule.frontend?.https?.hsts || false,
        customize_headers: rule.customize_headers || [],
        proxy_connect_timeout: rule.proxy_connect_timeout || 60,
        proxy_read_timeout: rule.proxy_read_timeout || 60,
        proxy_send_timeout: rule.proxy_send_timeout || 60,
        proxy_http_version: rule.proxy_http_version || 1,
        proxy_intercept_errors: rule.proxy_intercept_errors || false,
        acl: rule.frontend?.acl || null,
      });
      setEditingRule({ id: ruleId });
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [getRuleById]);

  const handleDelete = useCallback((ruleId, description) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Rule",
      message: `Are you sure you want to delete "${description}"?`,
      onConfirm: async () => {
        const result = await deleteRule(ruleId);
        if (result.success) {
          showNotification("Rule deleted successfully!", "success");
          setSelectedRules((prev) => {
            const newSet = new Set(prev);
            newSet.delete(ruleId);
            return newSet;
          });
        }
        setConfirmDialog(null);
      },
    });
  }, [deleteRule, showNotification]);

  const handleBulkDelete = () => {
    const selectedArray = Array.from(selectedRules);
    if (selectedArray.length === 0) return;

    const selectedRuleDescriptions = rules
      .filter((rule) => {
        const ruleId = rule.UUID || rule.uuid || rule.id;
        return selectedRules.has(ruleId);
      })
      .map((rule) => rule.description || "Unnamed Rule");

    setConfirmDialog({
      isOpen: true,
      title: "Delete Multiple Rules",
      message: `Are you sure you want to delete ${selectedArray.length} rule(s)?\n\n${selectedRuleDescriptions.slice(0, 5).join("\n")}${selectedRuleDescriptions.length > 5 ? `\n...and ${selectedRuleDescriptions.length - 5} more` : ""}\n\nThis cannot be undone.`,
      onConfirm: async () => {
        const result = await bulkDeleteRules(selectedArray);
        if (result.success) {
          showNotification(`${selectedArray.length} rule(s) deleted successfully!`, "success");
          setSelectedRules(new Set());
        }
        setConfirmDialog(null);
      },
    });
  };

  const handleDuplicate = useCallback(async (ruleId) => {
    const result = await getRuleById(ruleId);
    if (result.success && result.data) {
      const rule = result.data;
      setFields({
        ...DEFAULT_RULE_FIELDS,
        description: `${rule.description || "Unnamed Rule"} (Copy)`,
        backend_fqdn: rule.backend?.fqdn || "",
        backend_port: rule.backend?.port || 5000,
        frontend_fqdn: rule.frontend?.fqdn || "",
        frontend_port: rule.frontend?.port || 443,
        backend_protocol: rule.backend?.protocol || 0,
        frontend_protocol: rule.frontend?.protocol || 1,
        frontend_hsts: rule.frontend?.https?.hsts || false,
        customize_headers: rule.customize_headers || [],
        proxy_connect_timeout: rule.proxy_connect_timeout || 60,
        proxy_read_timeout: rule.proxy_read_timeout || 60,
        proxy_send_timeout: rule.proxy_send_timeout || 60,
        proxy_http_version: rule.proxy_http_version || 1,
        proxy_intercept_errors: rule.proxy_intercept_errors || false,
        acl: rule.frontend?.acl || null,
      });
      setEditingRule(null);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      showNotification("Rule duplicated! Please review and save.", "success");
    }
  }, [getRuleById, showNotification]);

  const handleExport = async () => {
    const result = await exportRules();
    if (result.success) {
      const dataStr = JSON.stringify(result.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reverse-proxy-rules-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification(`Exported ${result.data.count} rules successfully!`, "success");
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const fileText = await file.text();
      const importData = JSON.parse(fileText);
      if (!importData.rules || !Array.isArray(importData.rules)) {
        throw new Error("Invalid import file format. Expected {rules: [...]}");
      }
      const result = await importRules(importData.rules);
      if (result.success) {
        const { created, failed, skipped, total } = result.data;
        let messageParts = [];
        if (created > 0) messageParts.push(`${created} created`);
        if (skipped > 0) messageParts.push(`${skipped} skipped`);
        if (failed > 0) messageParts.push(`${failed} failed`);
        const message = `Import completed: ${messageParts.join(", ")} out of ${total} rules.`;
        showNotification(message, failed > 0 ? "error" : "success");
        if (result.data.skipped_rules) {
          console.log("Skipped rules:", result.data.skipped_rules);
        }
      }
    } catch (err) {
      showNotification(`Failed to import rules: ${err.message}`, "error");
    } finally {
      event.target.value = "";
    }
  };

  const toggleRuleSelection = useCallback((ruleId) => {
    setSelectedRules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = () => {
    if (selectedRules.size === filteredRules.length) {
      setSelectedRules(new Set());
    } else {
      const allIds = filteredRules.map((rule) => rule.UUID || rule.uuid || rule.id).filter(Boolean);
      setSelectedRules(new Set(allIds));
    }
  };

  const clearSelection = () => {
    setSelectedRules(new Set());
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+k': (e) => {
      e.preventDefault();
      // Focus search input
      const searchInput = document.querySelector('.search-input');
      if (searchInput) searchInput.focus();
    },
    'ctrl+n': (e) => {
      e.preventDefault();
      if (!showForm) {
        resetForm();
        setShowForm(true);
      }
    },
    'Escape': (e) => {
      if (showForm) {
        resetForm();
      }
      if (confirmDialog) {
        setConfirmDialog(null);
      }
      if (showFirstLogin) {
        setShowFirstLogin(false);
      }
    },
  }, [showForm, confirmDialog, showFirstLogin]);


  // Handle logout event from API interceptor
  useEffect(() => {
    const handleLogout = () => {
      logout();
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [logout]);

  // Show login if not authenticated
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <LoadingState message="Checking authentication..." />
      </div>
    );
  }

  // Show setup page if required
  if (setupRequired) {
    return (
      <>
        <SkipLink />
        <Setup onComplete={() => checkSetupAndAuth()} />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <SkipLink />
        <Login />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <SkipLink targetId="main-content" />
      <Container>
        <Header
          title="Synology Reverse Proxy Manager"
          subtitle={`Manage your reverse proxy rules${user ? ` • Logged in as ${user}` : ''}`}
          rightActions={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setShowChangePassword(true)}
                ariaLabel="Change password"
                title="Change password"
              >
                <FiLock /> Change Password
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={logout}
                ariaLabel="Logout"
                title="Logout"
              >
                <FiLogOut /> Logout
              </Button>
            </div>
          }
        />

        <main id="main-content" className="app-content" role="main" aria-live="polite" aria-atomic="false">
          <ToastContainer notifications={notifications} onClose={removeNotification} />

          {rulesError && !rulesError.includes("authentication") && (
            <Notification message={rulesError} type="error" />
          )}

          {/* First Login Modal */}
          {showFirstLogin && (
            <Suspense fallback={<LoadingState message="Loading..." />}>
              <Modal
                isOpen={showFirstLogin}
                onClose={() => setShowFirstLogin(false)}
                title={
                  <>
                    <FiShield /> First-Time Setup Required
                  </>
                }
                footer={
                  <>
                    <Button variant="secondary" onClick={() => setShowFirstLogin(false)} disabled={firstLoginLoading}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleFirstLogin} loading={firstLoginLoading}>
                      Authenticate
                    </Button>
                  </>
                }
              >
                <p>This is your first time using the application. You need to perform an initial authentication to establish a device token.</p>
                <p className="modal-note-text">
                  <strong>Note:</strong> If your Synology account has 2FA enabled, you'll need to provide an OTP code. Otherwise, you can leave it empty.
                </p>
                <Input
                  label="OTP Code (Optional - only if 2FA is enabled)"
                  id="otp-code"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit OTP code (or leave empty if no 2FA)"
                  maxLength={6}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !firstLoginLoading) {
                      handleFirstLogin();
                    }
                  }}
                />
              </Modal>
            </Suspense>
          )}

          {/* Confirm Dialog */}
          {confirmDialog && (
            <Suspense fallback={null}>
              <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(null)}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant="danger"
              />
            </Suspense>
          )}

          {/* Change Password Modal */}
          <Suspense fallback={null}>
            <ChangePassword
              isOpen={showChangePassword}
              onClose={() => setShowChangePassword(false)}
            />
          </Suspense>

          <Toolbar
            left={
              <>
                {selectedRules.size > 0 ? (
                  <>
                    <Button variant="secondary" onClick={clearSelection} ariaLabel="Clear selection">
                      <FiX /> Clear Selection
                    </Button>
                    <span className="selection-count">{selectedRules.size} selected</span>
                    <Button variant="danger" onClick={handleBulkDelete} disabled={loading} ariaLabel={`Delete ${selectedRules.size} selected rule(s)`}>
                      <FiTrash2 /> Delete Selected ({selectedRules.size})
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
                      {showForm ? <><FiX /> Cancel</> : <><FiPlus /> Create New Rule</>}
                    </Button>
                    <Button variant="secondary" onClick={handleExport} disabled={loading || rules.length === 0} ariaLabel="Export all rules to JSON">
                      <FiDownload /> Export
                    </Button>
                    <label className="btn btn-secondary file-input-wrapper">
                      <FiUpload /> Import
                      <input type="file" accept=".json" onChange={handleImport} disabled={loading} />
                    </label>
                  </>
                )}
              </>
            }
            right={
              <div className="search-box">
                <FiSearch className="search-icon" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search rules..."
                  value={searchTerm || ""}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                  aria-label="Search rules"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                />
              </div>
            }
          />

          {/* Rule Form */}
          {showForm && (
            <Suspense fallback={<LoadingState message="Loading form..." />}>
              <RuleForm
                fields={fields}
                onChange={setFields}
                onSubmit={handleSubmit}
                onCancel={resetForm}
                editingRule={editingRule}
                loading={loading}
                error={rulesError}
              />
            </Suspense>
          )}

          <div className="rules-section">
            <div className="rules-section-header">
              <h2>
                <FiGlobe className="section-icon" /> Reverse Proxy Rules ({filteredRules.length})
              </h2>
              {filteredRules.length > 0 && (
                <div className="rules-header-controls">
                  <div className="sort-controls-group">
                    <span className="sort-label">Sort by:</span>
                    <Select
                      id="sort-by"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      options={[
                        { value: "description", label: "Name" },
                        { value: "frontend", label: "Frontend Domain" },
                        { value: "backend", label: "Backend Domain" },
                      ]}
                      className="sort-select-inline"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      ariaLabel={`Sort ${sortOrder === "asc" ? "descending" : "ascending"}`}
                      className="sort-order-btn"
                    >
                      {sortOrder === "asc" ? <FiArrowUp /> : <FiArrowDown />}
                    </Button>
                  </div>
                  <Button
                    variant={selectedRules.size === filteredRules.length && filteredRules.length > 0 ? "primary" : "secondary"}
                    onClick={toggleSelectAll}
                    disabled={loading}
                    ariaLabel={selectedRules.size === filteredRules.length ? "Deselect all rules" : "Select all rules"}
                    title={selectedRules.size === filteredRules.length ? "Deselect all" : "Select all"}
                    className="select-all-btn"
                  >
                    {selectedRules.size === filteredRules.length && filteredRules.length > 0 ? (
                      <FiCheckCircle />
                    ) : (
                      <FiLayers />
                    )}
                  </Button>
                </div>
              )}
            </div>
            {loading && !showForm ? (
              <LoadingState message="Loading rules..." />
            ) : filteredRules.length === 0 ? (
              <EmptyState
                icon={<FiGlobe />}
                title={searchTerm ? "No rules match your search" : "No rules configured yet"}
                message={searchTerm ? "Try adjusting your search terms" : "Create your first reverse proxy rule to get started"}
                action={
                  !searchTerm && (
                    <Button variant="primary" onClick={() => { resetForm(); setShowForm(true); }}>
                      <FiPlus /> Create New Rule
                    </Button>
                  )
                }
              />
            ) : (
              <RuleGrid
                rules={filteredRules}
                selectedRules={selectedRules}
                onSelectRule={toggleRuleSelection}
                onEditRule={handleEdit}
                onDeleteRule={handleDelete}
                onDuplicateRule={handleDuplicate}
                loading={loading}
                skeletonCount={6}
              />
            )}
          </div>
        </main>
        <Footer />
      </Container>
    </div>
  );
}

export default App;

