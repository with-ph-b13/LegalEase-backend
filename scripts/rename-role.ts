import mongoose from "mongoose";
import User from "../src/models/User";
import { env } from "../src/config/env";

async function main() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to DB");

  const result = await User.updateMany(
    { role: "public" as any },
    { $set: { role: "user" } }
  );

  console.log(`Migrated ${result.modifiedCount} users from public to user role.`);
  process.exit(0);
}

main().catch(console.error);
