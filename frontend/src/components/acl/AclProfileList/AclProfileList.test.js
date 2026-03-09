import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AclProfileList from "./AclProfileList";

// Mock ConfirmDialog to avoid portal complexity
jest.mock("../../modals/ConfirmDialog/ConfirmDialog", () => {
  return function MockConfirmDialog({ isOpen, onConfirm, onClose, title, message, confirmText }) {
    if (!isOpen) return null;
    return (
      <div data-testid="confirm-dialog">
        <span data-testid="confirm-title">{title}</span>
        <span data-testid="confirm-message">{message}</span>
        <button onClick={onConfirm}>{confirmText || "Confirm"}</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  };
});

// ─── fixtures ────────────────────────────────────────────────────────────────

const PROFILES = [
  {
    UUID: "uuid-1",
    name: "Home Network",
    rules: [
      { access: true, address: "192.168.1.0/24" },
      { access: false, address: "" },
    ],
  },
  {
    UUID: "uuid-2",
    name: "Office",
    rules: [],
  },
];

function renderList({
  profiles = PROFILES,
  loading = false,
  onEdit = jest.fn(),
  onDelete = jest.fn(),
  onNew = jest.fn(),
} = {}) {
  return render(
    <AclProfileList
      profiles={profiles}
      loading={loading}
      onEdit={onEdit}
      onDelete={onDelete}
      onNew={onNew}
    />
  );
}

// ─── loading state ───────────────────────────────────────────────────────────

describe("AclProfileList — loading state", () => {
  test("shows loading message while fetching", () => {
    renderList({ loading: true, profiles: [] });
    expect(screen.getByText(/loading profiles/i)).toBeInTheDocument();
  });

  test("does not render profile items while loading", () => {
    renderList({ loading: true });
    expect(screen.queryByText("Home Network")).not.toBeInTheDocument();
  });
});

// ─── empty state ─────────────────────────────────────────────────────────────

describe("AclProfileList — empty state", () => {
  test("shows empty state when profiles array is empty", () => {
    renderList({ profiles: [] });
    expect(screen.getByText(/no access control profiles/i)).toBeInTheDocument();
  });

  test("empty state includes 'Create your first profile' button", () => {
    const onNew = jest.fn();
    renderList({ profiles: [], onNew });
    userEvent.click(screen.getByRole("button", { name: /create your first profile/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

// ─── profile list rendering ──────────────────────────────────────────────────

describe("AclProfileList — profile list", () => {
  test("renders all profiles by name", () => {
    renderList();
    expect(screen.getByText("Home Network")).toBeInTheDocument();
    expect(screen.getByText("Office")).toBeInTheDocument();
  });

  test("renders rule pills for profiles that have rules", () => {
    renderList();
    expect(screen.getByText("192.168.1.0/24")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument(); // empty address pill
  });

  test("shows 'No rules' message for profiles without rules", () => {
    renderList();
    expect(screen.getByText(/no rules/i)).toBeInTheDocument();
  });

  test("New Profile button calls onNew", async () => {
    const onNew = jest.fn();
    renderList({ onNew });
    await userEvent.click(screen.getByRole("button", { name: /new profile/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

// ─── edit action ─────────────────────────────────────────────────────────────

describe("AclProfileList — edit action", () => {
  test("edit button calls onEdit with the correct profile", async () => {
    const onEdit = jest.fn();
    renderList({ onEdit });
    await userEvent.click(screen.getByRole("button", { name: /edit home network/i }));
    expect(onEdit).toHaveBeenCalledWith(PROFILES[0]);
  });
});

// ─── delete action ───────────────────────────────────────────────────────────

describe("AclProfileList — delete action", () => {
  test("delete button opens ConfirmDialog instead of window.confirm", async () => {
    const windowConfirmSpy = jest.spyOn(window, "confirm");
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /delete home network/i }));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(windowConfirmSpy).not.toHaveBeenCalled();
    windowConfirmSpy.mockRestore();
  });

  test("confirm dialog shows the correct profile name", async () => {
    renderList();
    await userEvent.click(screen.getByRole("button", { name: /delete home network/i }));
    const dialog = screen.getByTestId("confirm-dialog");
    expect(within(dialog).getByTestId("confirm-message")).toHaveTextContent("Home Network");
  });

  test("confirming delete calls onDelete with the correct uuid", async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    renderList({ onDelete });
    await userEvent.click(screen.getByRole("button", { name: /delete home network/i }));
    const dialog = screen.getByTestId("confirm-dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("uuid-1");
  });

  test("cancelling dialog does not call onDelete", async () => {
    const onDelete = jest.fn();
    renderList({ onDelete });
    await userEvent.click(screen.getByRole("button", { name: /delete home network/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  test("delete button is disabled while delete is in progress", async () => {
    // onDelete that never resolves simulates in-progress
    const onDelete = jest.fn(() => new Promise(() => {}));
    renderList({ onDelete });
    await userEvent.click(screen.getByRole("button", { name: /delete home network/i }));
    const dialog = screen.getByTestId("confirm-dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /delete/i }));
    expect(screen.getByRole("button", { name: /delete home network/i })).toBeDisabled();
  });

  test("delete button is re-enabled after delete completes", async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    renderList({ onDelete });
    await userEvent.click(screen.getByRole("button", { name: /delete home network/i }));
    const dialog = screen.getByTestId("confirm-dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /delete/i }));
    // Wait for the async delete to settle
    await screen.findByRole("button", { name: /delete home network/i });
    expect(screen.getByRole("button", { name: /delete home network/i })).not.toBeDisabled();
  });
});
