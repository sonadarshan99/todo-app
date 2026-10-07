const KEY = "tasklane_token";

export const session = {
  get: () => localStorage.getItem(KEY),
  set: (t) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY)
};

// Every call goes to /api/... ; the saved JWT is attached automatically.
export async function api(path, { method = "GET", body } = {}) {
  const token = session.get();
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Something went wrong. Try again.");
    err.status = res.status;
    throw err;
  }
  return data;
}
