import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email });
const sign = (u) => jwt.sign({ id: u._id.toString(), name: u.name }, process.env.JWT_SECRET, { expiresIn: "2h" });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) return fail(res, 400, "Name, email and password are required");
  if (!emailRegex.test(email)) return fail(res, 400, "Enter a valid email");
  if (password.length < 6) return fail(res, 400, "Password must contain at least 6 characters");
  if (await User.findOne({ email: email.toLowerCase() })) return fail(res, 409, "Email is already registered");

  const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ success: true, message: "Account created", token: sign(user), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 400, "Email and password are required");
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.password))) return fail(res, 401, "Invalid email or password");
  res.json({ success: true, message: "Login successful", token: sign(user), user: publicUser(user) });
});

router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return fail(res, 401, "User no longer exists");
  res.json({ success: true, user: publicUser(user) });
});

export default router;
