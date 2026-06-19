import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComment extends Document {
  userId: Types.ObjectId;
  lawyerId: Types.ObjectId;
  text: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lawyerId: { type: Schema.Types.ObjectId, ref: "Lawyer", required: true, index: true },
    text: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true }
);

export default mongoose.model<IComment>("Comment", CommentSchema);
