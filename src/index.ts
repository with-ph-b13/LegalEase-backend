import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "./config/env";
import { HttpError } from "./middleware/error-handler";
import User from "./models/User";
import app from "./app";

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
