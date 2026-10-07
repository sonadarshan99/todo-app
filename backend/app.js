import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import todoRoutes from "./routes/todos.js";
import { logger, notFound, errorHandler } from "./middleware/common.js";

const app = express();
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== "test") app.use(logger);

app.get("/api/health", (req, res) => res.json({ success: true, status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/todos", todoRoutes);

app.use(notFound);
app.use(errorHandler);
export default app;
