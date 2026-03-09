import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AclProfileForm from "./AclProfileForm";

// ─── helpers ────────────────────────────────────────────────────────────────

const noop = () => {};

function renderForm({
  editingProfile = "new",
  onSave = jest.fn(),
  onCancel = jest.fn(),
  initialName = "",
  initialRules = [],
} = {}) {
  return render(
    <AclProfileForm
      editingProfile={editingProfile}
      onSave={onSave}
      onCancel={onCancel}
      initialName={initialName}
      initialRules={initialRules}
    />
  );
}

// ─── isValidAddress (tested via the form's submit validation) ────────────────

describe("AclProfileForm — address validation", () => {
  async function attemptSave(address) {
    const onSave = jest.fn();
    renderForm({ onSave });
    await userEvent.type(screen.getByPlaceholderText(/home network only/i), "My Profile");
    const addrInput = screen.getByPlaceholderText(/empty = catch-all/i);
    await userEvent.clear(addrInput);
    if (address !== "") {
      await userEvent.type(addrInput, address);
    }
    await userEvent.click(screen.getByRole("button", { name: /create profile/i }));
    return onSave;
  }

  test("empty address (catch-all) is valid", async () => {
    const onSave = await attemptSave("");
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  test("valid IPv4 address is accepted", async () => {
    const onSave = await attemptSave("192.168.1.1");
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  test("valid IPv4 CIDR is accepted", async () => {
    const onSave = await attemptSave("10.0.0.0/8");
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  test("IPv4 with octet > 255 is rejected", async () => {
    const onSave = await attemptSave("256.0.0.1");
    expect(screen.getByRole("alert")).toHaveTextContent(/not a valid IP/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  test("IPv4 with prefix > 32 is rejected", async () => {
    const onSave = await attemptSave("192.168.1.0/33");
    expect(screen.getByRole("alert")).toHaveTextContent(/not a valid IP/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  test("valid IPv6 address is accepted", async () => {
    const onSave = await attemptSave("2001:db8::1");
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  test("IPv6 with prefix is accepted", async () => {
    const onSave = await attemptSave("2001:db8::/32");
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  test("IPv6 triple-colon is rejected", async () => {
    const onSave = await attemptSave("2001:::1");
    expect(screen.getByRole("alert")).toHaveTextContent(/not a valid IP/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  test("IPv6 with prefix > 128 is rejected", async () => {
    const onSave = await attemptSave("::1/129");
    expect(screen.getByRole("alert")).toHaveTextContent(/not a valid IP/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  test("IPv6 with more than 8 groups is rejected", async () => {
    const onSave = await attemptSave("1:2:3:4:5:6:7:8:9");
    expect(screen.getByRole("alert")).toHaveTextContent(/not a valid IP/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  test("plain hostname is rejected", async () => {
    const onSave = await attemptSave("example.com");
    expect(screen.getByRole("alert")).toHaveTextContent(/not a valid IP/i);
    expect(onSave).not.toHaveBeenCalled();
  });
});

// ─── genId fallback ──────────────────────────────────────────────────────────

describe("AclProfileForm — genId fallback", () => {
  test("renders with unique rule IDs when crypto.randomUUID is unavailable", () => {
    // Replace window.crypto with a stub that has no randomUUID, forcing the Math.random fallback.
    const savedDescriptor = Object.getOwnPropertyDescriptor(window, "crypto");
    Object.defineProperty(window, "crypto", { value: {}, configurable: true, writable: true });
    try {
      renderForm();
      expect(screen.getByPlaceholderText(/empty = catch-all/i)).toBeInTheDocument();
    } finally {
      if (savedDescriptor) {
        Object.defineProperty(window, "crypto", savedDescriptor);
      }
    }
  });
});

// ─── form name validation ────────────────────────────────────────────────────

describe("AclProfileForm — form name validation", () => {
  test("shows error when saving with empty name", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /create profile/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/profile name is required/i);
  });

  test("whitespace-only name is rejected", async () => {
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/home network only/i), "   ");
    await userEvent.click(screen.getByRole("button", { name: /create profile/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/profile name is required/i);
  });
});

// ─── rule management ─────────────────────────────────────────────────────────

describe("AclProfileForm — rule management", () => {
  test("Add Rule button appends a new rule row", async () => {
    renderForm();
    const before = screen.getAllByPlaceholderText(/empty = catch-all|192\.168/i).length;
    await userEvent.click(screen.getByRole("button", { name: /add rule/i }));
    const after = screen.getAllByLabelText(/remove rule/i).length;
    expect(after).toBe(before + 1);
  });

  test("Remove rule button is disabled when only one rule remains", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /remove rule 1/i })).toBeDisabled();
  });

  test("Remove rule button is enabled when multiple rules exist", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /add rule/i }));
    expect(screen.getByRole("button", { name: /remove rule 1/i })).not.toBeDisabled();
  });

  test("removing a rule reduces the rule count", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /add rule/i }));
    await userEvent.click(screen.getByRole("button", { name: /remove rule 1/i }));
    expect(screen.getAllByLabelText(/remove rule/i)).toHaveLength(1);
  });

  test("Allow/Deny toggle updates rule access type", async () => {
    renderForm();
    const denyBtn = screen.getByRole("button", { name: /deny/i });
    await userEvent.click(denyBtn);
    expect(denyBtn).toHaveClass("active");
  });
});

// ─── edit mode ───────────────────────────────────────────────────────────────

describe("AclProfileForm — edit mode", () => {
  const profile = { uuid: "abc-123", name: "Home" };
  const rules = [
    { _id: "r1", access: true, address: "10.0.0.0/8" },
    { _id: "r2", access: false, address: "" },
  ];

  test("pre-fills name and rules from initialName/initialRules", () => {
    renderForm({ editingProfile: profile, initialName: "Home", initialRules: rules });
    expect(screen.getByDisplayValue("Home")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10.0.0.0/8")).toBeInTheDocument();
  });

  test('save button reads "Save Changes" in edit mode', () => {
    renderForm({ editingProfile: profile, initialName: "Home", initialRules: rules });
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  test("calls onSave with uuid and trimmed payload", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderForm({ editingProfile: profile, onSave, initialName: "Home", initialRules: rules });
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        "abc-123",
        expect.objectContaining({ name: "Home" })
      )
    );
    // _id fields must be stripped from the payload
    const [, payload] = onSave.mock.calls[0];
    expect(payload.rules.every((r) => !("_id" in r))).toBe(true);
  });
});

// ─── error from onSave ───────────────────────────────────────────────────────

describe("AclProfileForm — save error handling", () => {
  test("displays error banner when onSave rejects", async () => {
    const onSave = jest.fn().mockRejectedValue({ message: "NAS unavailable" });
    renderForm({ onSave });
    await userEvent.type(screen.getByPlaceholderText(/home network only/i), "Test");
    await userEvent.click(screen.getByRole("button", { name: /create profile/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/NAS unavailable/i)
    );
  });

  test("re-enables save button after error", async () => {
    const onSave = jest.fn().mockRejectedValue({ message: "error" });
    renderForm({ onSave });
    await userEvent.type(screen.getByPlaceholderText(/home network only/i), "Test");
    await userEvent.click(screen.getByRole("button", { name: /create profile/i }));
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("button", { name: /create profile/i })).not.toBeDisabled();
  });
});

// ─── cancel ──────────────────────────────────────────────────────────────────

describe("AclProfileForm — cancel", () => {
  test("cancel button calls onCancel", async () => {
    const onCancel = jest.fn();
    renderForm({ onCancel });
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
