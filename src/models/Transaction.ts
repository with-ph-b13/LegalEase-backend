import mongoose, { Schema, Document, Types } from "mongoose";

export type TransactionType = "publish_fee" | "hire_fee";
export type TransactionStatus = "pending" | "succeeded" | "failed";

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  lawyerId?: Types.ObjectId;
  hiringId?: Types.ObjectId;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lawyerId: { type: Schema.Types.ObjectId, ref: "Lawyer", index: true },
    hiringId: { type: Schema.Types.ObjectId, ref: "Hiring", index: true },
    stripeSessionId: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String },
    type: { type: String, enum: ["publish_fee", "hire_fee"], required: true },
    amount: { type: Number, required: true },
    status: { 
      type: String, 
      enum: ["pending", "succeeded", "failed"], 
      default: "pending",
      required: true 
    },
  },
  { timestamps: true }
);

export default mongoose.model<ITransaction>("Transaction", TransactionSchema);
