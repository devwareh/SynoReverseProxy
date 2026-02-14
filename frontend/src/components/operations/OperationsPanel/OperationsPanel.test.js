import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import OperationsPanel from "./OperationsPanel";

const baseOperations = [
  {
    id: "op-running",
    kind: "update",
    targetLabel: "Plex",
    status: "running",
    attempts: 1,
    startedAt: Date.now() - 1500,
    finishedAt: null,
  },
  {
    id: "op-verifying",
    kind: "delete",
    targetLabel: "Old Rule",
    status: "verifying",
    attempts: 1,
    startedAt: Date.now() - 3000,
    finishedAt: null,
  },
  {
    id: "op-failed",
    kind: "create",
    targetLabel: "New Rule",
    status: "failed",
    recoverable: true,
    attempts: 1,
    startedAt: Date.now() - 5000,
    finishedAt: Date.now() - 2000,
    errorMessage: "Timeout",
  },
  {
    id: "op-done",
    kind: "create",
    targetLabel: "Done Rule",
    status: "succeeded",
    attempts: 1,
    startedAt: Date.now() - 7000,
    finishedAt: Date.now() - 1000,
  },
];

describe("OperationsPanel", () => {
  test("renders operation groups and summary", () => {
    render(
      <OperationsPanel
        operations={baseOperations}
        operationSummary={{ queued: 0, running: 1, verifying: 1, failed: 1, succeeded: 1 }}
        onRetryOperation={jest.fn()}
        onDismissOperation={jest.fn()}
        onClearCompletedOperations={jest.fn()}
      />
    );

    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText(/running: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/verifying: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/failed: 1/i)).toBeInTheDocument();
  });

  test("failed operation retry triggers callback", () => {
    const onRetry = jest.fn();
    render(
      <OperationsPanel
        operations={baseOperations}
        operationSummary={{ queued: 0, running: 1, verifying: 1, failed: 1, succeeded: 1 }}
        onRetryOperation={onRetry}
        onDismissOperation={jest.fn()}
        onClearCompletedOperations={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /retry operation op-failed/i }));
    expect(onRetry).toHaveBeenCalledWith("op-failed");
  });

  test("clear completed invokes callback", () => {
    const onClearCompleted = jest.fn();
    render(
      <OperationsPanel
        operations={baseOperations}
        operationSummary={{ queued: 0, running: 1, verifying: 1, failed: 1, succeeded: 1 }}
        onRetryOperation={jest.fn()}
        onDismissOperation={jest.fn()}
        onClearCompletedOperations={onClearCompleted}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /clear completed operations/i }));
    expect(onClearCompleted).toHaveBeenCalled();
  });
});
