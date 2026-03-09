import { renderHook, act } from "@testing-library/react";
import useAclManager from "./useAclManager";

describe("useAclManager", () => {
  test("initial state: modal closed, version 0", () => {
    const { result } = renderHook(() => useAclManager());
    expect(result.current.showAclManager).toBe(false);
    expect(result.current.aclVersion).toBe(0);
  });

  test("openAclManager sets showAclManager to true", () => {
    const { result } = renderHook(() => useAclManager());
    act(() => { result.current.openAclManager(); });
    expect(result.current.showAclManager).toBe(true);
  });

  test("closeAclManager sets showAclManager to false", () => {
    const { result } = renderHook(() => useAclManager());
    act(() => { result.current.openAclManager(); });
    act(() => { result.current.closeAclManager(); });
    expect(result.current.showAclManager).toBe(false);
  });

  test("closeAclManager increments aclVersion", () => {
    const { result } = renderHook(() => useAclManager());
    act(() => { result.current.closeAclManager(); });
    expect(result.current.aclVersion).toBe(1);
  });

  test("aclVersion increments on each close", () => {
    const { result } = renderHook(() => useAclManager());
    act(() => { result.current.closeAclManager(); });
    act(() => { result.current.closeAclManager(); });
    act(() => { result.current.closeAclManager(); });
    expect(result.current.aclVersion).toBe(3);
  });

  test("openAclManager does not change aclVersion", () => {
    const { result } = renderHook(() => useAclManager());
    act(() => { result.current.openAclManager(); });
    expect(result.current.aclVersion).toBe(0);
  });

  test("open → close → open cycle", () => {
    const { result } = renderHook(() => useAclManager());
    act(() => { result.current.openAclManager(); });
    expect(result.current.showAclManager).toBe(true);
    act(() => { result.current.closeAclManager(); });
    expect(result.current.showAclManager).toBe(false);
    expect(result.current.aclVersion).toBe(1);
    act(() => { result.current.openAclManager(); });
    expect(result.current.showAclManager).toBe(true);
    expect(result.current.aclVersion).toBe(1); // still 1 — open doesn't bump
  });

  test("callbacks are stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useAclManager());
    const { openAclManager, closeAclManager } = result.current;
    rerender();
    expect(result.current.openAclManager).toBe(openAclManager);
    expect(result.current.closeAclManager).toBe(closeAclManager);
  });
});
