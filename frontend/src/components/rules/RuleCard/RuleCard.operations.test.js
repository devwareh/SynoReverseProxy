import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RuleCard from "./RuleCard";

const rule = {
  UUID: "rule-1",
  description: "Plex",
  frontend: {
    protocol: 1,
    port: 443,
    fqdn: "plex.example.com",
    https: { hsts: false },
  },
  backend: {
    protocol: 0,
    port: 32400,
    fqdn: "localhost",
  },
  customize_headers: [],
};

describe("RuleCard operation state", () => {
  test("shows failed badge and retry action", () => {
    const onRetryRuleOperation = jest.fn();
    render(
      <RuleCard
        rule={rule}
        isSelected={false}
        onSelect={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onDuplicate={jest.fn()}
        loading={false}
        operationState={{ status: "failed", operationId: "op-1", message: "Timed out", recoverable: true }}
        onRetryRuleOperation={onRetryRuleOperation}
      />
    );

    expect(screen.getByText("FAILED")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry operation for plex/i }));
    expect(onRetryRuleOperation).toHaveBeenCalledWith("op-1");
  });

  test("only affected row actions are disabled while running", () => {
    render(
      <RuleCard
        rule={rule}
        isSelected={false}
        onSelect={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onDuplicate={jest.fn()}
        loading={false}
        operationState={{ status: "running", operationId: "op-2", message: "" }}
        onRetryRuleOperation={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /edit rule/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /delete rule/i })).toBeDisabled();
  });
});
