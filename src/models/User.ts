import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  password?: string;
  name: string;
  avatar?: string;
  googleId?: string;
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
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
