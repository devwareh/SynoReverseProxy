import { toErrorString } from "./errors";

describe("toErrorString", () => {
  test("returns string detail from response", () => {
    const err = { response: { data: { detail: "Not found" } } };
    expect(toErrorString(err)).toBe("Not found");
  });

  test("joins array detail messages", () => {
    const err = {
      response: {
        data: {
          detail: [
            { msg: "field required", loc: ["body", "name"] },
            { msg: "invalid address", loc: ["body", "address"] },
          ],
        },
      },
    };
    expect(toErrorString(err)).toBe("field required; invalid address");
  });

  test("stringifies object detail", () => {
    const err = { response: { data: { detail: { error: "unknown" } } } };
    expect(toErrorString(err)).toBe('{"error":"unknown"}');
  });

  test("falls back to err.message", () => {
    const err = { message: "Network Error" };
    expect(toErrorString(err)).toBe("Network Error");
  });

  test("uses custom fallback when no detail or message", () => {
    const err = {};
    expect(toErrorString(err, "Custom fallback")).toBe("Custom fallback");
  });

  test("uses default fallback when nothing available", () => {
    expect(toErrorString({})).toBe("An error occurred");
  });

  test("handles array detail with missing msg", () => {
    const err = {
      response: {
        data: {
          detail: [{ loc: ["body"], type: "missing" }],
        },
      },
    };
    expect(toErrorString(err)).toBe('{"loc":["body"],"type":"missing"}');
  });
});
