import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import passport from "passport";
import bcrypt from "bcryptjs";
import { env } from "./config/env";
import { errorHandler, notFoundHandler, HttpError } from "./middleware/error-handler";
import authRoutes from "./routes/auth";
import lawyerRoutes from "./routes/lawyers";
import hiringRoutes from "./routes/hirings";
import commentRoutes from "./routes/comments";
import User from "./models/User";

const app = express();

app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

import paymentRoutes from "./routes/payments";

// Webhook needs raw body to verify signature
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV });
});

app.use("/api/auth", authRoutes);
app.use("/api/lawyers", lawyerRoutes);
app.use("/api/hirings", hiringRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/payments", paymentRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log("Connected to MongoDB");

    if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
      const existing = await User.findOne({ email: env.ADMIN_EMAIL });
      if (!existing) {
        const hashed = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
        await User.create({
          email: env.ADMIN_EMAIL,
          password: hashed,
          name: "Admin",
          role: "admin",
        });
        console.log("Admin user seeded");
      } else if (existing.role !== "admin") {
        existing.role = "admin";
        await existing.save();
        console.log("Admin role assigned");
      }
    }
  } catch (err) {
    console.warn("MongoDB not available, starting without it:", (err as Error).message);
    if (env.NODE_ENV === "production") {
      throw new HttpError(500, "Database connection failed");
    }
  }

  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
}

start();
