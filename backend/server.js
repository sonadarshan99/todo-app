import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

const PORT = process.env.PORT || 5000;
try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected");
  app.listen(PORT, () => console.log(`Server started at http://localhost:${PORT}`));
} catch (err) {
  console.error("MongoDB connection failed:", err.message);
  process.exit(1);
}
