// Integration tests: real Express app + real MongoDB (separate test database).
import "dotenv/config";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app.js";
import User from "../models/User.js";
import Todo from "../models/Todo.js";

process.env.JWT_SECRET ||= "test-secret";
const TEST_DB = process.env.MONGO_URI_TEST || "mongodb://127.0.0.1:27017/todoapp_test";

beforeAll(() => mongoose.connect(TEST_DB));
afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
beforeEach(async () => { await User.deleteMany({}); await Todo.deleteMany({}); });

async function signup(email = "a@test.com") {
  const res = await request(app).post("/api/auth/register").send({ name: "Test User", email, password: "secret123" });
  return res.body.token;
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const add = (t, body) => request(app).post("/api/todos").set(auth(t)).send(body);

describe("Auth", () => {
  test("register returns 201 + token and never exposes the password", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "Asha", email: "asha@test.com", password: "secret123" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();
  });
  test("password is stored as a bcrypt hash", async () => {
    await signup();
    const user = await User.findOne({ email: "a@test.com" });
    expect(user.password).not.toBe("secret123");
    expect(user.password.startsWith("$2")).toBe(true);
  });
  test("duplicate email -> 409, weak password -> 400, bad email -> 400", async () => {
    await signup();
    const dup = await request(app).post("/api/auth/register").send({ name: "X Y", email: "a@test.com", password: "secret123" });
    expect(dup.status).toBe(409);
    const weak = await request(app).post("/api/auth/register").send({ name: "X Y", email: "b@test.com", password: "123" });
    expect(weak.status).toBe(400);
    const bad = await request(app).post("/api/auth/register").send({ name: "X Y", email: "nope", password: "secret123" });
    expect(bad.status).toBe(400);
  });
  test("login: correct -> 200 + token, wrong password -> 401", async () => {
    await signup();
    const ok = await request(app).post("/api/auth/login").send({ email: "a@test.com", password: "secret123" });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    const bad = await request(app).post("/api/auth/login").send({ email: "a@test.com", password: "wrong" });
    expect(bad.status).toBe(401);
  });
  test("protected routes reject missing and invalid tokens", async () => {
    expect((await request(app).get("/api/todos")).status).toBe(401);
    expect((await request(app).get("/api/todos").set(auth("garbage"))).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set(auth(await signup()))).status).toBe(200);
  });
});

describe("Todo CRUD", () => {
  test("create -> list -> update -> complete -> delete", async () => {
    const t = await signup();
    const created = await add(t, { title: "  Buy milk  ", priority: "high" });
    expect(created.status).toBe(201);
    expect(created.body.data.title).toBe("Buy milk");
    const id = created.body.data._id;

    const list = await request(app).get("/api/todos").set(auth(t));
    expect(list.body.count).toBe(1);

    const upd = await request(app).patch(`/api/todos/${id}`).set(auth(t)).send({ title: "Buy oat milk" });
    expect(upd.body.data.title).toBe("Buy oat milk");

    const done = await request(app).patch(`/api/todos/${id}`).set(auth(t)).send({ completed: true });
    expect(done.body.data.completed).toBe(true);
    expect(done.body.data.completedAt).toBeTruthy();

    expect((await request(app).delete(`/api/todos/${id}`).set(auth(t))).status).toBe(200);
    expect((await request(app).delete(`/api/todos/${id}`).set(auth(t))).status).toBe(404);
  });
  test("validation: empty title, bad priority, bad date -> 400", async () => {
    const t = await signup();
    expect((await add(t, { title: "   " })).status).toBe(400);
    expect((await add(t, { title: "x", priority: "urgent" })).status).toBe(400);
    expect((await add(t, { title: "x", dueDate: "not-a-date" })).status).toBe(400);
  });
  test("bad id -> 404, malformed JSON -> 400, unknown route -> 404", async () => {
    const t = await signup();
    expect((await request(app).patch("/api/todos/123").set(auth(t)).send({ title: "x" })).status).toBe(404);
    const bad = await request(app).post("/api/todos").set(auth(t)).set("Content-Type", "application/json").send("{bad");
    expect(bad.status).toBe(400);
    expect((await request(app).get("/api/nothing")).status).toBe(404);
  });
});

describe("Data isolation", () => {
  test("a user cannot see, edit or delete another user's todos", async () => {
    const a = await signup("a@test.com");
    const b = await signup("b@test.com");
    const id = (await add(a, { title: "Private" })).body.data._id;
    expect((await request(app).get("/api/todos").set(auth(b))).body.count).toBe(0);
    expect((await request(app).patch(`/api/todos/${id}`).set(auth(b)).send({ title: "Hacked" })).status).toBe(404);
    expect((await request(app).delete(`/api/todos/${id}`).set(auth(b))).status).toBe(404);
    expect((await Todo.findById(id)).title).toBe("Private");
  });
});

describe("Filters, stats, bulk actions", () => {
  async function seed(t) {
    await add(t, { title: "Write report", priority: "low" });
    await add(t, { title: "Pay rent", priority: "high", dueDate: "2020-01-01" });
    const done = await add(t, { title: "Report bug", priority: "medium" });
    await request(app).patch(`/api/todos/${done.body.data._id}`).set(auth(t)).send({ completed: true });
  }
  test("status, priority, search and sort filters", async () => {
    const t = await signup(); await seed(t);
    const get = (qs) => request(app).get(`/api/todos?${qs}`).set(auth(t));
    expect((await get("status=active")).body.count).toBe(2);
    expect((await get("status=completed")).body.count).toBe(1);
    expect((await get("status=overdue")).body.count).toBe(1);
    expect((await get("priority=high")).body.data[0].title).toBe("Pay rent");
    expect((await get("q=report")).body.count).toBe(2);
    expect((await get("sort=priority")).body.data[0].priority).toBe("high");
  });
  test("stats and clear-completed", async () => {
    const t = await signup(); await seed(t);
    const stats = await request(app).get("/api/todos/stats").set(auth(t));
    expect(stats.body.data).toEqual({ total: 3, completed: 1, active: 2, overdue: 1 });
    const clear = await request(app).delete("/api/todos/completed").set(auth(t));
    expect(clear.body.deleted).toBe(1);
    expect((await request(app).get("/api/todos").set(auth(t))).body.count).toBe(2);
  });
});

test("full workflow: signup -> login -> add -> complete -> stats -> persisted in MongoDB", async () => {
  await signup("flow@test.com");
  const login = await request(app).post("/api/auth/login").send({ email: "flow@test.com", password: "secret123" });
  const t = login.body.token;
  const todo = (await add(t, { title: "Ship project", priority: "high" })).body.data;
  await request(app).patch(`/api/todos/${todo._id}`).set(auth(t)).send({ completed: true });
  const stats = await request(app).get("/api/todos/stats").set(auth(t));
  expect(stats.body.data.completed).toBe(1);
  const stored = await Todo.findById(todo._id); // verify the database really holds it
  expect(stored.completed).toBe(true);
  expect(stored.user.toString()).toBe(login.body.user.id);
});
