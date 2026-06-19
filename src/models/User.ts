import mongoose, { Document, Schema } from "mongoose";

export type Role = "admin" | "user" | "lawyer";

export interface IUser extends Document {
  email: string;
  password?: string;
  name: string;
  avatar?: string;
  googleId?: string;
  role: Role;
  shortlist?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    name: { type: String, required: true, trim: true },
    avatar: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["admin", "user", "lawyer"], default: "user" },
    shortlist: [{ type: Schema.Types.ObjectId, ref: "Lawyer" }],
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
