import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import passport from "passport";
import bcrypt from "bcryptjs";
import authRoutes from "./routes/auth";
import User from "./models/User";

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/legalease";

app.use(cors());
app.use(express.json());
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      const existing = await User.findOne({ email: adminEmail });
      if (!existing) {
        const hashed = await bcrypt.hash(adminPassword, 12);
        await User.create({ email: adminEmail, password: hashed, name: "Admin" });
        console.log("Admin user seeded");
      }
    }
  } catch {
    console.warn("MongoDB not available, starting without it");
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
