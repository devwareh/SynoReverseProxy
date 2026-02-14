import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const mockRetryOperation = jest.fn();
const mockClearCompletedOperations = jest.fn();

jest.mock("./utils/api", () => ({
  authAPI: {
    firstLogin: jest.fn(),
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

jest.mock("./hooks/useRules", () => () => ({
  rules: [
    {
      UUID: "rule-1",
      description: "Plex",
      frontend: { protocol: 1, port: 443, fqdn: "plex.example.com", https: { hsts: false } },
      backend: { protocol: 0, port: 32400, fqdn: "localhost" },
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
  getRuleById: jest.fn(),
  validateRule: jest.fn().mockResolvedValue({ valid: true }),
  exportRules: jest.fn(),
  importRules: jest.fn(),
  operations: [
    {
      id: "op-failed",
      kind: "update",
      targetRuleId: "rule-1",
      targetLabel: "Plex",
      status: "failed",
      attempts: 1,
      startedAt: Date.now() - 2000,
      finishedAt: Date.now() - 1000,
      recoverable: true,
      errorMessage: "Timeout",
    },
  ],
  operationSummary: { queued: 0, running: 0, verifying: 0, failed: 1, succeeded: 0 },
  retryOperation: mockRetryOperation,
  dismissOperation: jest.fn(),
  clearCompletedOperations: mockClearCompletedOperations,
  operationStateByRuleId: {
    "rule-1": { status: "failed", operationId: "op-failed", recoverable: true, message: "Timeout" },
  },
}));

jest.mock("./hooks/useNotifications", () => () => ({
  notifications: [],
  showNotification: jest.fn(),
  removeNotification: jest.fn(),
}));

import App from "./App";

describe("App async operation integration", () => {
  beforeEach(() => {
    mockRetryOperation.mockClear();
    mockClearCompletedOperations.mockClear();
  });

  test("renders operations panel and wires retry action", () => {
    render(<App />);

    expect(screen.getByText("Operations")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry operation op-failed/i }));
    expect(mockRetryOperation).toHaveBeenCalledWith("op-failed");
  });
});
