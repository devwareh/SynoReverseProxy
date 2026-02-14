import { act, renderHook, waitFor } from "@testing-library/react";
import useRules from "./useRules";
import { rulesAPI } from "../utils/api";

jest.mock("../utils/api", () => ({
  rulesAPI: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    bulkDelete: jest.fn(),
    export: jest.fn(),
    import: jest.fn(),
    validate: jest.fn(),
  },
}));

const timeoutError = () => {
  const err = new Error("timeout of 20000ms exceeded");
  err.code = "ECONNABORTED";
  return err;
};

const apiError = (status, detail) => {
  const err = new Error("request failed");
  err.response = { status, data: { detail } };
  return err;
};

describe("useRules async mutation operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rulesAPI.getAll.mockResolvedValue({ data: { data: { entries: [] } } });
    rulesAPI.getById.mockResolvedValue({ data: { data: { entry: null } } });
  });

  test("create success transitions to succeeded and updates summary", async () => {
    rulesAPI.create.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    let opResult;
    await act(async () => {
      opResult = await result.current.createRule({
        description: "Rule A",
        frontend_fqdn: "a.example.com",
      });
    });

    expect(opResult.success).toBe(true);
    await waitFor(() => expect(result.current.operations).toHaveLength(1));
    expect(result.current.operations[0].status).toBe("succeeded");
    expect(result.current.operationSummary.succeeded).toBe(1);
  });

  test("timeout then verify-found resolves create as success", async () => {
    rulesAPI.create.mockRejectedValue(timeoutError());
    rulesAPI.getAll
      .mockResolvedValueOnce({ data: { data: { entries: [] } } }) // initial fetch on mount
      .mockResolvedValueOnce({ data: { data: { entries: [] } } }) // pre-create existence check
      .mockResolvedValueOnce({
        data: {
          data: {
            entries: [{ UUID: "r1", frontend: { fqdn: "verify.example.com" }, description: "Rule verify" }],
          },
        },
      }) // verification check
      .mockResolvedValueOnce({
        data: {
          data: {
            entries: [{ UUID: "r1", frontend: { fqdn: "verify.example.com" }, description: "Rule verify" }],
          },
        },
      }); // silent fetch after success

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    let opResult;
    await act(async () => {
      opResult = await result.current.createRule({
        description: "Rule verify",
        frontend_fqdn: "verify.example.com",
      });
    });

    expect(opResult.success).toBe(true);
    expect(result.current.operations[0].status).toBe("succeeded");
    expect(result.current.operations[0].targetRuleId).toBe("r1");
  });

  test("timeout then verify-not-found resolves create as failed", async () => {
    rulesAPI.create.mockRejectedValue(timeoutError());
    rulesAPI.getAll.mockResolvedValue({ data: { data: { entries: [] } } });

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    let opResult;
    await act(async () => {
      opResult = await result.current.createRule({
        description: "Rule missing",
        frontend_fqdn: "missing.example.com",
      });
    });

    expect(opResult.success).toBe(false);
    expect(result.current.operations[0].status).toBe("failed");
    expect(result.current.operations[0].recoverable).toBe(true);
  });

  test("preflight lookup failure resolves create as failed without throwing", async () => {
    rulesAPI.getAll
      .mockResolvedValueOnce({ data: { data: { entries: [] } } }) // mount
      .mockRejectedValueOnce(timeoutError()); // preflight existence check

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    let opResult;
    await act(async () => {
      opResult = await result.current.createRule({
        description: "Rule preflight fail",
        frontend_fqdn: "preflight-fail.example.com",
      });
    });

    expect(opResult.success).toBe(false);
    expect(result.current.operations[0].status).toBe("failed");
    expect(result.current.operations[0].errorMessage).toMatch(/timeout/i);
  });

  test("conflict error does not resolve as success when same rule already existed", async () => {
    rulesAPI.create.mockRejectedValue(apiError(400, { error: { code: 4154 } }));
    rulesAPI.getAll
      .mockResolvedValueOnce({ data: { data: { entries: [] } } }) // initial
      .mockResolvedValueOnce({
        data: {
          data: {
            entries: [{ UUID: "r2", frontend: { fqdn: "dup.example.com" }, description: "Rule dup" }],
          },
        },
      }) // pre-create existence check
      .mockResolvedValueOnce({
        data: {
          data: {
            entries: [{ UUID: "r2", frontend: { fqdn: "dup.example.com" }, description: "Rule dup" }],
          },
        },
      }); // verification check

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    let opResult;
    await act(async () => {
      opResult = await result.current.createRule({
        description: "Rule dup",
        frontend_fqdn: "dup.example.com",
      });
    });

    expect(opResult.success).toBe(false);
    expect(result.current.operations[0].status).toBe("failed");
  });

  test("update verify succeeds when ACL is applied under frontend", async () => {
    rulesAPI.update.mockRejectedValue(timeoutError());
    rulesAPI.getAll
      .mockResolvedValueOnce({ data: { data: { entries: [] } } }) // mount
      .mockResolvedValueOnce({
        data: {
          data: {
            entries: [
              {
                UUID: "u-acl",
                frontend: {
                  acl: {
                    enable: true,
                    ip: [{ address: "192.168.1.1", prefix: 32 }],
                  },
                },
              },
            ],
          },
        },
      }) // verify
      .mockResolvedValueOnce({
        data: {
          data: {
            entries: [
              {
                UUID: "u-acl",
                frontend: {
                  acl: {
                    enable: true,
                    ip: [{ address: "192.168.1.1", prefix: 32 }],
                  },
                },
              },
            ],
          },
        },
      }); // silent fetch after success

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.updateRule("u-acl", {
        acl: {
          enable: true,
          ip: [{ address: "192.168.1.1", prefix: 32 }],
        },
      });
    });

    expect(result.current.operations[0].status).toBe("succeeded");
  });

  test("retry failed operation increments attempts and can succeed", async () => {
    rulesAPI.update
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce({ data: { success: true } });
    rulesAPI.getAll
      .mockResolvedValueOnce({ data: { data: { entries: [] } } }) // mount
      .mockResolvedValueOnce({ data: { data: { entries: [{ UUID: "u1", description: "Old title" }] } } }) // verify fail on first update
      .mockResolvedValueOnce({ data: { data: { entries: [{ UUID: "u1", description: "Updated title" }] } } }); // silent fetch after retry success

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.updateRule("u1", { description: "Updated title" });
    });
    expect(result.current.operations[0].status).toBe("failed");

    await act(async () => {
      await result.current.retryOperation(result.current.operations[0].id);
    });

    expect(result.current.operations[0].status).toBe("succeeded");
    expect(result.current.operations[0].attempts).toBeGreaterThan(1);
  });

  test("update verify fails when non-description fields did not apply", async () => {
    rulesAPI.update.mockRejectedValue(timeoutError());
    rulesAPI.getAll
      .mockResolvedValueOnce({ data: { data: { entries: [] } } }) // mount
      .mockResolvedValueOnce({
        data: {
          data: {
            entries: [
              {
                UUID: "u2",
                description: "Media",
                backend: { port: 5000 },
              },
            ],
          },
        },
      });

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.updateRule("u2", {
        description: "Media",
        backend_port: 6000,
      });
    });

    expect(result.current.operations[0].status).toBe("failed");
  });

  test("global loading is not toggled by in-flight write operation", async () => {
    let resolver;
    const pending = new Promise((resolve) => {
      resolver = resolve;
    });
    rulesAPI.create.mockImplementation(() => pending);

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.createRule({
        description: "Rule slow",
        frontend_fqdn: "slow.example.com",
      });
    });

    expect(result.current.loading).toBe(false);
    expect(["queued", "running"]).toContain(result.current.operations[0].status);

    await act(async () => {
      resolver({ data: { success: true } });
      await pending;
    });
  });

  test("completed operations are auto-cleared after delay", async () => {
    jest.useFakeTimers();
    rulesAPI.create.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.createRule({
        description: "Auto clear",
        frontend_fqdn: "autoclear.example.com",
      });
    });

    expect(result.current.operations).toHaveLength(1);
    expect(result.current.operations[0].status).toBe("succeeded");

    act(() => {
      jest.advanceTimersByTime(12050);
    });

    await waitFor(() => expect(result.current.operations).toHaveLength(0));
    jest.useRealTimers();
  });

  test("paused auto-clear keeps completed operations visible", async () => {
    jest.useFakeTimers();
    rulesAPI.create.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useRules());
    await waitFor(() => expect(rulesAPI.getAll).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.createRule({
        description: "Pause clear",
        frontend_fqdn: "pause-clear.example.com",
      });
    });

    expect(result.current.operations[0].status).toBe("succeeded");

    act(() => {
      result.current.setAutoClearPaused(true);
      jest.advanceTimersByTime(13000);
    });

    expect(result.current.operations).toHaveLength(1);
    expect(result.current.operations[0].status).toBe("succeeded");
    jest.useRealTimers();
  });
});
