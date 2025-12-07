// Common header presets
export const HEADER_PRESETS = [
  { name: "X-Forwarded-For", value: "$remote_addr" },
  { name: "X-Real-IP", value: "$remote_addr" },
  { name: "X-Forwarded-Proto", value: "$scheme" },
  { name: "Upgrade", value: "$http_upgrade" },
  { name: "Connection", value: "$connection_upgrade" },
];

// Protocol options
export const PROTOCOL_OPTIONS = [
  { value: 0, label: "HTTP" },
  { value: 1, label: "HTTPS" },
];

// HTTP Version options
export const HTTP_VERSION_OPTIONS = [
  { value: 0, label: "HTTP 1.0" },
  { value: 1, label: "HTTP 1.1" },
];

// Default form values
export const DEFAULT_RULE_FIELDS = {
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
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  NEW_RULE: { key: 'n', ctrl: true, label: 'Create new rule' },
  SEARCH: { key: 'f', ctrl: true, label: 'Focus search' },
  EXPORT: { key: 'e', ctrl: true, shift: true, label: 'Export rules' },
  IMPORT: { key: 'i', ctrl: true, shift: true, label: 'Import rules' },
  COMMAND_PALETTE: { key: 'k', ctrl: true, label: 'Open command palette' },
  ESCAPE: { key: 'Escape', label: 'Close modal/dialog' },
};

// Re-export version info
export { APP_VERSION, VERSION_INFO } from './version';

