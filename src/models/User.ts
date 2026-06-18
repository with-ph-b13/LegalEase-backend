import mongoose, { Document, Schema } from "mongoose";

export type Role = "admin" | "public" | "lawyer";

export interface IUser extends Document {
  email: string;
  password?: string;
  name: string;
  avatar?: string;
  googleId?: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    name: { type: String, required: true },
    avatar: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["admin", "public", "lawyer"], default: "public" },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
