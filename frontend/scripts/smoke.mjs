// Frontend -> API integration check. Run while BOTH servers are running:  npm run smoke
// It calls the API through the Vite dev server (port 5173), exactly like the browser does.
const BASE = process.env.BASE || "http://localhost:5173/api";
let pass = 0, failed = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); ok ? pass++ : failed++; };
const call = async (path, method = "GET", body, token) => {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
};

const email = `smoke${Date.now()}@test.com`;
check("health via proxy", (await call("/health")).status === 200);
const reg = await call("/auth/register", "POST", { name: "Smoke Test", email, password: "secret123" });
check("register -> 201", reg.status === 201);
const token = reg.data.token;
check("no token -> 401", (await call("/todos")).status === 401);
const todo = await call("/todos", "POST", { title: "Smoke task", priority: "high" }, token);
check("create todo -> 201", todo.status === 201);
const id = todo.data.data?._id;
check("toggle complete -> 200", (await call(`/todos/${id}`, "PATCH", { completed: true }, token)).data.data?.completed === true);
check("stats count -> 1 done", (await call("/todos/stats", "GET", null, token)).data.data?.completed === 1);
check("delete -> 200", (await call(`/todos/${id}`, "DELETE", null, token)).status === 200);
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
