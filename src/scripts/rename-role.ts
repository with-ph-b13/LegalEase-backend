import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("No database connection");
  }

  const collection = db.collection("users");
  const result = await collection.updateMany(
    { role: "public" },
    { $set: { role: "user" } }
  );

  console.log(`Migrated ${result.modifiedCount} user(s) from "public" to "user"`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
