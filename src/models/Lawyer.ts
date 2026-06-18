import mongoose, { Document, Schema, Types } from "mongoose";

export const SPECIALIZATIONS = [
  "Criminal",
  "Corporate",
  "Family",
  "Tax",
  "Immigration",
  "Real Estate",
  "Intellectual Property",
  "Labor",
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];

export type LawyerStatus = "available" | "busy";

export interface ILawyer extends Document {
  userId: Types.ObjectId;
  name: string;
  email: string;
  specialization: Specialization;
  bio: string;
  fee: number;
  imageUrl?: string;
  status: LawyerStatus;
  published: boolean;
  hiredCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const lawyerSchema = new Schema<ILawyer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    specialization: {
      type: String,
      enum: SPECIALIZATIONS as unknown as string[],
      required: true,
    },
    bio: { type: String, required: true, minlength: 20, maxlength: 2000 },
    fee: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
    status: { type: String, enum: ["available", "busy"], default: "available" },
    published: { type: Boolean, default: false },
    hiredCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

lawyerSchema.index({ published: 1, specialization: 1 });
lawyerSchema.index({ published: 1, status: 1 });
lawyerSchema.index({ published: 1, fee: 1 });
lawyerSchema.index(
  { name: "text", bio: "text" },
  { weights: { name: 5, bio: 1 }, name: "LawyerTextIndex" }
);

export default mongoose.model<ILawyer>("Lawyer", lawyerSchema);
