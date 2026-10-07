import { useCallback, useEffect, useState } from "react";
import { api, session } from "./api";

const TABS = [["all", "All"], ["active", "To do"], ["completed", "Done"], ["overdue", "Overdue"]];
const today = () => new Date().toISOString().slice(0, 10);
const dueText = (t) => (t.dueDate ? t.dueDate.slice(0, 10) : "");
const isOverdue = (t) => !t.completed && t.dueDate && dueText(t) < today();

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const d = await api(`/auth/${mode}`, { method: "POST", body: form });
      session.set(d.token);
      onAuth(d.user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <main className="auth">
      <h1 className="brand">Tasklane</h1>
      <p className="lede">Your tasks, saved to your account.</p>
      <form onSubmit={submit}>
        {mode === "register" && (
          <label>Name<input value={form.name} onChange={set("name")} required minLength={2} autoComplete="name" /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></label>
        <label>Password<input type="password" value={form.password} onChange={set("password")} required minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
      </form>
      <button className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
        {mode === "login" ? "New here? Create an account" : "Have an account? Log in"}
      </button>
    </main>
  );
}

function Todos({ user, onLogout }) {
  const [todos, setTodos] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, overdue: 0 });
  const [filter, setFilter] = useState({ status: "all", priority: "", q: "", sort: "newest" });
  const [draft, setDraft] = useState({ title: "", priority: "medium", dueDate: "" });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      Object.entries(filter).forEach(([k, v]) => { if (v && !(k === "status" && v === "all")) qs.set(k, v); });
      const [list, st] = await Promise.all([api(`/todos?${qs}`), api("/todos/stats")]);
      setTodos(list.data); setStats(st.data); setError("");
    } catch (err) {
      if (err.status === 401) onLogout(); else setError(err.message);
    } finally { setLoading(false); }
  }, [filter, onLogout]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const run = async (fn) => { try { await fn(); await load(); } catch (err) { setError(err.message); } };
  const add = (e) => {
    e.preventDefault();
    run(async () => {
      await api("/todos", { method: "POST", body: { ...draft, dueDate: draft.dueDate || null } });
      setDraft({ ...draft, title: "", dueDate: "" });
    });
  };
  const patch = (id, body) => api(`/todos/${id}`, { method: "PATCH", body });

  return (
    <main className="app">
      <header>
        <h1 className="brand">Tasklane</h1>
        <span>{user.name} <button className="link" onClick={onLogout}>Log out</button></span>
      </header>

      <form className="adder" onSubmit={add}>
        <input className="big" placeholder="What needs doing?" value={draft.title} maxLength={120}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="New task" />
        <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} aria-label="Priority">
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
        <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} aria-label="Due date" />
        <button className="primary" disabled={!draft.title.trim()}>Add task</button>
      </form>

      <p className="stats">
        {stats.active} to do · {stats.completed} done{stats.overdue > 0 && <b className="late"> · {stats.overdue} overdue</b>}
      </p>

      <div className="bar">
        <div className="tabs" role="tablist">
          {TABS.map(([v, label]) => (
            <button key={v} role="tab" aria-selected={filter.status === v} className={filter.status === v ? "on" : ""}
              onClick={() => setFilter({ ...filter, status: v })}>{label}</button>
          ))}
        </div>
        <input type="search" placeholder="Search tasks" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} aria-label="Search" />
        <select value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })} aria-label="Filter by priority">
          <option value="">Any priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <select value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value })} aria-label="Sort">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
          <option value="due">Due date</option><option value="priority">Priority</option>
        </select>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p className="empty">Loading tasks…</p> : todos.length === 0 ? (
        <p className="empty">{stats.total === 0 ? "No tasks yet. Add your first one above." : "No tasks match these filters."}</p>
      ) : (
        <ul className="list">
          {todos.map((t) => (
            <li key={t._id} className={`${t.completed ? "done" : ""} p-${t.priority}`}>
              <input type="checkbox" checked={t.completed} aria-label={`Mark "${t.title}" ${t.completed ? "not done" : "done"}`}
                onChange={() => run(() => patch(t._id, { completed: !t.completed }))} />
              {editing?.id === t._id ? (
                <form className="edit" onSubmit={(e) => { e.preventDefault(); run(async () => { await patch(t._id, { title: editing.title }); setEditing(null); }); }}>
                  <input autoFocus value={editing.title} maxLength={120} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    onKeyDown={(e) => e.key === "Escape" && setEditing(null)} aria-label="Edit task title" />
                  <button className="link">Save</button>
                </form>
              ) : (
                <div className="body">
                  <span className="title">{t.title}</span>
                  <small>
                    {t.priority} priority{t.dueDate && <> · <span className={isOverdue(t) ? "late" : ""}>due {dueText(t)}</span></>}
                  </small>
                </div>
              )}
              <div className="actions">
                {!t.completed && editing?.id !== t._id && <button className="link" onClick={() => setEditing({ id: t._id, title: t.title })}>Edit</button>}
                <button className="link danger" onClick={() => run(() => api(`/todos/${t._id}`, { method: "DELETE" }))}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {stats.completed > 0 && (
        <button className="link danger clear" onClick={() => run(() => api("/todos/completed", { method: "DELETE" }))}>
          Clear {stats.completed} completed
        </button>
      )}
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const logout = useCallback(() => { session.clear(); setUser(null); }, []);

  useEffect(() => {
    if (!session.get()) { setReady(true); return; }
    api("/auth/me").then((d) => setUser(d.user)).catch(() => session.clear()).finally(() => setReady(true));
  }, []);

  if (!ready) return <p className="empty">Loading…</p>;
  return user ? <Todos user={user} onLogout={logout} /> : <Auth onAuth={setUser} />;
}
