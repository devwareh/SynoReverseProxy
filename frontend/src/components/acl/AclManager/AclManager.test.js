import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AclManager from "./AclManager";

// Mock the API module
jest.mock("../../../utils/api", () => ({
  aclAPI: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock ConfirmDialog to avoid Modal portal complexity in tests
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

const { aclAPI } = require("../../../utils/api");

const SAMPLE_PROFILES = [
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

const mockOnClose = jest.fn();

function renderAclManager() {
  return render(<AclManager onClose={mockOnClose} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AclManager — loading and list states", () => {
  test("shows loading state while fetching", () => {
    aclAPI.getAll.mockReturnValue(new Promise(() => {})); // never resolves
    renderAclManager();
    expect(screen.getByText(/loading profiles/i)).toBeInTheDocument();
  });

  test("renders profile list after successful fetch", async () => {
    aclAPI.getAll.mockResolvedValue({ data: { data: { entries: SAMPLE_PROFILES } } });
    renderAclManager();
    expect(await screen.findByText("Home Network")).toBeInTheDocument();
    expect(screen.getByText("Office")).toBeInTheDocument();
  });

  test("renders empty state when no profiles exist", async () => {
    aclAPI.getAll.mockResolvedValue({ data: { data: { entries: [] } } });
    renderAclManager();
    expect(await screen.findByText(/no access control profiles/i)).toBeInTheDocument();
  });

  test("shows error banner when fetch fails", async () => {
    aclAPI.getAll.mockRejectedValue({ message: "Network error" });
    renderAclManager();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Network error");
  });
});

describe("AclManager — create flow", () => {
  beforeEach(() => {
    aclAPI.getAll.mockResolvedValue({ data: { data: { entries: SAMPLE_PROFILES } } });
  });

  test('"New Profile" button opens create form', async () => {
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /new profile/i }));
    expect(screen.getByPlaceholderText(/home network only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create profile/i })).toBeInTheDocument();
  });

  test("shows validation error when saving with empty name", async () => {
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /new profile/i }));
    await userEvent.click(screen.getByRole("button", { name: /create profile/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/profile name is required/i);
  });

  test("calls aclAPI.create with correct payload and refreshes list", async () => {
    aclAPI.create.mockResolvedValue({ data: { success: true } });
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /new profile/i }));
    await userEvent.type(screen.getByPlaceholderText(/home network only/i), "New Profile");
    await userEvent.click(screen.getByRole("button", { name: /create profile/i }));
    await waitFor(() => expect(aclAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Profile" })
    ));
    expect(aclAPI.getAll).toHaveBeenCalledTimes(2); // initial + refresh
  });

  test("cancel button returns to profile list", async () => {
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /new profile/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText("Home Network")).toBeInTheDocument();
  });
});

describe("AclManager — edit flow", () => {
  beforeEach(() => {
    aclAPI.getAll.mockResolvedValue({ data: { data: { entries: SAMPLE_PROFILES } } });
  });

  test("edit button opens form pre-filled with profile data", async () => {
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /edit home network/i }));
    expect(screen.getByDisplayValue("Home Network")).toBeInTheDocument();
  });

  test("back button shows 'All Profiles' label in edit mode", async () => {
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /edit home network/i }));
    expect(screen.getByText("All Profiles")).toBeInTheDocument();
  });

  test("calls aclAPI.update with correct uuid", async () => {
    aclAPI.update.mockResolvedValue({ data: { success: true } });
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /edit home network/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(aclAPI.update).toHaveBeenCalledWith(
      "uuid-1",
      expect.objectContaining({ name: "Home Network" })
    ));
  });
});

describe("AclManager — validation", () => {
  beforeEach(() => {
    aclAPI.getAll.mockResolvedValue({ data: { data: { entries: SAMPLE_PROFILES } } });
  });

  test("shows validation error when saving with invalid IP address", async () => {
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /new profile/i }));
    await userEvent.type(screen.getByPlaceholderText(/home network only/i), "Test Profile");
    // Type an invalid IP into the address input
    const addressInput = screen.getByPlaceholderText(/empty = catch-all/i);
    await userEvent.type(addressInput, "999.999.999.999");
    await userEvent.click(screen.getByRole("button", { name: /create profile/i }));
    const alert = screen.getAllByRole("alert");
    const errorAlert = alert.find((el) => el.textContent.includes("not a valid IP"));
    expect(errorAlert).toBeTruthy();
    expect(aclAPI.create).not.toHaveBeenCalled();
  });
});

describe("AclManager — delete flow", () => {
  beforeEach(() => {
    aclAPI.getAll.mockResolvedValue({ data: { data: { entries: SAMPLE_PROFILES } } });
  });

  test("delete button opens ConfirmDialog (not window.confirm)", async () => {
    const windowConfirmSpy = jest.spyOn(window, "confirm");
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /delete home network/i }));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(windowConfirmSpy).not.toHaveBeenCalled();
    windowConfirmSpy.mockRestore();
  });

  test("confirming delete calls aclAPI.delete and refreshes list", async () => {
    aclAPI.delete.mockResolvedValue({ data: { success: true } });
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /delete home network/i }));
    const dialog = screen.getByTestId("confirm-dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(aclAPI.delete).toHaveBeenCalledWith("uuid-1"));
    expect(aclAPI.getAll).toHaveBeenCalledTimes(2);
  });

  test("cancelling delete dialog does not call aclAPI.delete", async () => {
    renderAclManager();
    await screen.findByText("Home Network");
    await userEvent.click(screen.getByRole("button", { name: /delete home network/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(aclAPI.delete).not.toHaveBeenCalled();
  });
});
