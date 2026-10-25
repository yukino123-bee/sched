// Thin wrapper around fetch. All times in the API are 24h "HH:MM".
const BASE = "/api";

// Turn FastAPI error bodies (string or validation-error list) into one readable message.
function errorMessage(body, status) {
  const d = body && body.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((e) => `${String(e.loc[e.loc.length - 1]).replace(/_/g, " ")}: ${e.msg.replace(/^Value error, /, "")}`)
      .join("; ");
  }
  return `Request failed (${status})`;
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(BASE + path, options);
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 8000?");
  }
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return body;
}

// Build "?a=1&b=2", skipping empty values
function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const api = {
  classes: (params = {}) => request(`/classes${qs(params)}`),
  rooms: () => request("/rooms"),
  freeRooms: (day, time) => request(`/rooms/free${qs({ day, time })}`),
  roomSchedule: (room) => request(`/rooms/${encodeURIComponent(room)}/schedule`),
  addClass: (body) =>
    request("/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteClass: (id) => request(`/classes/${id}`, { method: "DELETE" }),
};
