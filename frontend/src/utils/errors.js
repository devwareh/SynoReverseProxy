/**
 * Coerce an axios error into a render-safe string.
 * FastAPI 422 detail is an array of {loc, msg, type} objects; other errors
 * may be plain strings. Either way we return something safe to drop into JSX.
 */
export const toErrorString = (err, fallback = "An error occurred") => {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return err.message || fallback;
};
