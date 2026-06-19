import mongoose, { Types } from "mongoose";
import Comment, { IComment } from "../models/Comment";
import Hiring from "../models/Hiring";
import { HttpError } from "../middleware/error-handler";

function toDto(doc: any) {
  return {
    id: String(doc._id),
    _id: String(doc._id),
    userId: String(doc.userId._id || doc.userId),
    lawyerId: String(doc.lawyerId._id || doc.lawyerId),
    text: doc.text,
    rating: doc.rating,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    user: doc.userId.name ? {
      id: String(doc.userId._id),
      _id: String(doc.userId._id),
      name: doc.userId.name,
      avatar: doc.userId.avatar
    } : undefined,
    lawyer: doc.lawyerId.name ? {
      id: String(doc.lawyerId._id),
      _id: String(doc.lawyerId._id),
      name: doc.lawyerId.name,
      specialization: doc.lawyerId.specialization
    } : undefined
  };
}

export async function assertHasHired(userId: string, lawyerId: string) {
  if (!mongoose.isValidObjectId(lawyerId)) {
    throw new HttpError(400, "Invalid lawyer id");
  }

  const existing = await Hiring.findOne({
    userId: new Types.ObjectId(userId),
    lawyerId: new Types.ObjectId(lawyerId),
    status: { $in: ["accepted", "paid", "completed"] }
  }).exec();

  if (!existing) {
    throw new HttpError(403, "You must have an accepted or paid hiring request with this lawyer to leave a review");
  }
}

export async function createComment(userId: string, lawyerId: string, text: string, rating: number) {
  await assertHasHired(userId, lawyerId);

  const doc = await Comment.create({
    userId: new Types.ObjectId(userId),
    lawyerId: new Types.ObjectId(lawyerId),
    text,
    rating
  });

  return toDto(doc);
}

export async function listForLawyer(lawyerId: string, page = 1, limit = 10) {
  if (!mongoose.isValidObjectId(lawyerId)) {
    throw new HttpError(400, "Invalid lawyer id");
  }

  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    Comment.find({ lawyerId: new Types.ObjectId(lawyerId) })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
    Comment.countDocuments({ lawyerId: new Types.ObjectId(lawyerId) }).exec(),
  ]);

  return {
    data: docs.map(toDto),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function listForUser(userId: string) {
  const docs = await Comment.find({ userId: new Types.ObjectId(userId) })
    .populate("lawyerId", "name specialization")
    .sort({ createdAt: -1 })
    .exec();
  return docs.map(toDto);
}

export async function updateComment(id: string, userId: string, role: string, text?: string, rating?: number) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, "Invalid comment id");
  }

  const comment = await Comment.findById(id).exec();
  if (!comment) {
    throw new HttpError(404, "Comment not found");
  }

  if (String(comment.userId) !== userId && role !== "admin") {
    throw new HttpError(403, "Unauthorized to modify this comment");
  }

  if (text !== undefined) comment.text = text;
  if (rating !== undefined) comment.rating = rating;
  await comment.save();

  return toDto(comment);
}

export async function deleteComment(id: string, userId: string, role: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, "Invalid comment id");
  }

  const comment = await Comment.findById(id).exec();
  if (!comment) {
    throw new HttpError(404, "Comment not found");
  }

  if (String(comment.userId) !== userId && role !== "admin") {
    throw new HttpError(403, "Unauthorized to delete this comment");
  }

  await Comment.findByIdAndDelete(id).exec();
  return { id };
}
