import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User";
import Lawyer from "../models/Lawyer";
import Hiring from "../models/Hiring";
import Comment from "../models/Comment";
import Transaction from "../models/Transaction";
import { env } from "../config/env";

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(env.MONGO_URI);
    console.log("Connected successfully. Cleaning database...");

    await Promise.all([
      User.deleteMany({}),
      Lawyer.deleteMany({}),
      Hiring.deleteMany({}),
      Comment.deleteMany({}),
      Transaction.deleteMany({})
    ]);

    console.log("Database cleared. Seeding initial data...");

    const passwordHash = await bcrypt.hash("password123", 12);

    // 1. Create Admin
    const adminUser = await User.create({
      name: "System Admin",
      email: env.ADMIN_EMAIL || "admin@legalease.com",
      password: await bcrypt.hash(env.ADMIN_PASSWORD || "admin123", 12),
      role: "admin"
    });
    console.log(`Admin created: ${adminUser.email}`);

    // 2. Create client/user
    const testUser = await User.create({
      name: "John Doe",
      email: "john@doe.com",
      password: passwordHash,
      role: "user"
    });
    console.log(`Client user created: ${testUser.email}`);

    // 3. Create lawyer user and profile
    const lawyerUser = await User.create({
      name: "Jane Smith",
      email: "jane@smith.com",
      password: passwordHash,
      role: "lawyer"
    });

    const lawyerProfile = await Lawyer.create({
      userId: lawyerUser._id,
      name: "Jane Smith",
      email: "jane@smith.com",
      specialization: "Criminal",
      bio: "Experienced criminal defense lawyer with over 10 years of courtroom success. Committed to fighting for your rights.",
      fee: 150,
      imageUrl: "/male-placeholder.svg",
      status: "available",
      published: true,
      hiredCount: 2
    });
    console.log(`Lawyer user and profile created: ${lawyerUser.email}`);

    // 4. Create 2 hirings
    const hiring1 = await Hiring.create({
      userId: testUser._id,
      lawyerId: lawyerProfile._id,
      status: "paid",
      fee: 150
    });

    const hiring2 = await Hiring.create({
      userId: testUser._id,
      lawyerId: lawyerProfile._id,
      status: "accepted",
      fee: 150
    });
    console.log("2 Hirings seeded successfully.");

    // 5. Create 2 comments/reviews
    await Comment.create({
      userId: testUser._id,
      lawyerId: lawyerProfile._id,
      text: "Excellent representation. Highly recommended!",
      rating: 5
    });

    await Comment.create({
      userId: testUser._id,
      lawyerId: lawyerProfile._id,
      text: "Very professional and knowledgeable in criminal defense.",
      rating: 4
    });
    console.log("2 Comments/reviews seeded successfully.");

    // 6. Create 1 Transaction
    await Transaction.create({
      userId: testUser._id,
      lawyerId: lawyerProfile._id,
      hiringId: hiring1._id,
      stripeSessionId: "cs_test_seeding_123",
      stripePaymentIntentId: "pi_test_seeding_123",
      type: "hire_fee",
      amount: 15000,
      status: "succeeded"
    });
    console.log("Transactions seeded successfully.");

    console.log("🌱 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

seed();
