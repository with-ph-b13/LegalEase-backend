import mongoose, { Schema, Document, Types } from "mongoose";

export type HiringStatus = "pending" | "accepted" | "rejected" | "paid" | "completed";

export interface IHiring extends Document {
  userId: Types.ObjectId;
  lawyerId: Types.ObjectId;
  status: HiringStatus;
  fee: number;
  stripeSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HiringSchema = new Schema<IHiring>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lawyerId: { type: Schema.Types.ObjectId, ref: "Lawyer", required: true, index: true },
    status: { 
      type: String, 
      enum: ["pending", "accepted", "rejected", "paid", "completed"], 
      default: "pending",
      required: true 
    },
    fee: { type: Number, required: true },
    stripeSessionId: { type: String },
  },
  { timestamps: true }
);

// Compound index to quickly find user's active requests for a specific lawyer
HiringSchema.index({ userId: 1, lawyerId: 1, status: 1 });

export default mongoose.model<IHiring>("Hiring", HiringSchema);
