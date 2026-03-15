/**
 * Tests for Issue #25: Cloning an HTTP rule must preserve HTTP protocol.
 *
 * Root cause: handleDuplicate in App.js uses `||` instead of `??` for the
 * protocol fallback, so `0 || 1` (HTTP || HTTPS default) evaluates to 1 (HTTPS).
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App";

// Variables prefixed with 'mock' may be referenced inside jest.mock factory
const mockGetRuleById = jest.fn();

jest.mock("./utils/api", () => ({
  authAPI: { firstLogin: jest.fn() },
  aclAPI: {
    getAll: () => Promise.resolve({ data: { data: { entries: [] } } }),
    create: () => Promise.resolve({ data: { success: true } }),
    update: () => Promise.resolve({ data: { success: true } }),
    delete: () => Promise.resolve({ data: { success: true } }),
  },
}));

jest.mock("./contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    loading: false,
    user: "admin",
    logout: jest.fn(),
    setupRequired: false,
    checkSetupAndAuth: jest.fn(),
  }),
}));

jest.mock("./hooks/useNotifications", () => () => ({
  notifications: [],
  showNotification: jest.fn(),
  removeNotification: jest.fn(),
}));

jest.mock("./hooks/useRules", () => () => ({
  rules: [
    {
      UUID: "http-rule",
      description: "HTTP Service",
      frontend: {
        protocol: 0,
        port: 80,
        fqdn: "http.example.com",
        https: { hsts: false },
      },
      backend: { protocol: 0, port: 8080, fqdn: "internal.local" },
      customize_headers: [],
      proxy_connect_timeout: 60,
      proxy_read_timeout: 60,
      proxy_send_timeout: 60,
    },
  ],
  loading: false,
  error: null,
  fetchRules: jest.fn(),
  createRule: jest.fn(),
  updateRule: jest.fn(),
  deleteRule: jest.fn(),
  bulkDeleteRules: jest.fn(),
  getRuleById: mockGetRuleById,
  validateRule: jest.fn().mockResolvedValue({ valid: true }),
  exportRules: jest.fn(),
  importRules: jest.fn(),
  operations: [],
  operationSummary: { queued: 0, running: 0, verifying: 0, failed: 0, succeeded: 0 },
  retryOperation: jest.fn(),
  dismissOperation: jest.fn(),
  clearCompletedOperations: jest.fn(),
  operationStateByRuleId: {},
}));

const makeRule = (frontendProtocol, backendProtocol = 0) => ({
  UUID: "test-rule",
  description: "Test Rule",
  frontend: {
    protocol: frontendProtocol,
    port: frontendProtocol === 0 ? 80 : 443,
    fqdn: "test.example.com",
    https: { hsts: false },
    acl: null,
  },
  backend: {
    protocol: backendProtocol,
    port: 8080,
    fqdn: "internal.local",
  },
  customize_headers: [],
  proxy_connect_timeout: 60,
  proxy_read_timeout: 60,
  proxy_send_timeout: 60,
  proxy_http_version: 1,
  proxy_intercept_errors: false,
  acl: null,
});

describe("Issue #25: handleDuplicate preserves frontend_protocol", () => {
  beforeEach(() => {
    mockGetRuleById.mockReset();
  });

  test("duplicating an HTTP rule (protocol=0) keeps HTTP, not HTTPS", async () => {
    mockGetRuleById.mockResolvedValue({ success: true, data: makeRule(0) });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /duplicate rule/i }));

    const protocolSelect = await screen.findByLabelText(/frontend protocol/i);
    // Before fix: `0 || 1` evaluates to 1 (HTTPS) — this assertion FAILS
    // After fix:  `0 ?? 1` evaluates to 0 (HTTP)  — this assertion PASSES
    expect(protocolSelect.value).toBe("0");
  });

  test("duplicating an HTTPS rule (protocol=1) keeps HTTPS", async () => {
    mockGetRuleById.mockResolvedValue({ success: true, data: makeRule(1) });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /duplicate rule/i }));

    const protocolSelect = await screen.findByLabelText(/frontend protocol/i);
    expect(protocolSelect.value).toBe("1");
  });
});
