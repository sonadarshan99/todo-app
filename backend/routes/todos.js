import express from "express";
import mongoose from "mongoose";
import Todo, { PRIORITIES } from "../models/Todo.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

const RANK = { high: 0, medium: 1, low: 2 };
const startOfToday = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const notFoundTodo = (res) => res.status(404).json({ success: false, message: "Todo not found" });

// Validate and whitelist fields. `partial` = PATCH (title optional).
function clean(body = {}, partial = false) {
  const out = {}, errors = [];
  if (!partial || body.title !== undefined) {
    const t = String(body.title ?? "").trim();
    if (!t || t.length > 120) errors.push("Title is required (max 120 characters)");
    else out.title = t;
  }
  if (body.notes !== undefined) out.notes = String(body.notes).slice(0, 500);
  if (body.priority !== undefined) {
    if (PRIORITIES.includes(body.priority)) out.priority = body.priority;
    else errors.push("Priority must be low, medium or high");
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === "") out.dueDate = null;
    else {
      const d = new Date(body.dueDate);
      if (isNaN(d)) errors.push("Invalid due date"); else out.dueDate = d;
    }
  }
  if (body.completed !== undefined) {
    out.completed = Boolean(body.completed);
    out.completedAt = out.completed ? new Date() : null;
  }
  return { out, errors };
}

// List with filters: ?status=active|completed|overdue &priority= &q= &sort=newest|oldest|due|priority
router.get("/", async (req, res) => {
  const { status, priority, q, sort } = req.query;
  const filter = { user: req.user.id };
  if (status === "active") filter.completed = false;
  if (status === "completed") filter.completed = true;
  if (status === "overdue") { filter.completed = false; filter.dueDate = { $lt: startOfToday() }; }
  if (PRIORITIES.includes(priority)) filter.priority = priority;
  if (q) filter.title = { $regex: escapeRegex(String(q)), $options: "i" };

  const todos = await Todo.find(filter).sort(sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 });
  if (sort === "due") todos.sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));
  if (sort === "priority") todos.sort((a, b) => RANK[a.priority] - RANK[b.priority]);
  res.json({ success: true, count: todos.length, data: todos });
});

router.get("/stats", async (req, res) => {
  const mine = { user: new mongoose.Types.ObjectId(req.user.id) };
  const [total, completed, overdue] = await Promise.all([
    Todo.countDocuments(mine),
    Todo.countDocuments({ ...mine, completed: true }),
    Todo.countDocuments({ ...mine, completed: false, dueDate: { $lt: startOfToday() } })
  ]);
  res.json({ success: true, data: { total, completed, active: total - completed, overdue } });
});

router.post("/", async (req, res) => {
  const { out, errors } = clean(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0], errors });
  const todo = await Todo.create({ ...out, user: req.user.id });
  res.status(201).json({ success: true, data: todo });
});

// Must be declared before "/:id"
router.delete("/completed", async (req, res) => {
  const r = await Todo.deleteMany({ user: req.user.id, completed: true });
  res.json({ success: true, deleted: r.deletedCount });
});

router.patch("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFoundTodo(res);
  const { out, errors } = clean(req.body, true);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0], errors });
  const todo = await Todo.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, out, { new: true });
  if (!todo) return notFoundTodo(res);
  res.json({ success: true, data: todo });
});

router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFoundTodo(res);
  const todo = await Todo.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!todo) return notFoundTodo(res);
  res.json({ success: true, message: "Todo deleted" });
});

export default router;
