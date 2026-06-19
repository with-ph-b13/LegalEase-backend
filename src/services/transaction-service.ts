import { Types } from "mongoose";
import Transaction from "../models/Transaction";
import { HttpError } from "../middleware/error-handler";

function toDto(doc: any) {
  return {
    id: String(doc._id),
    _id: String(doc._id),
    type: doc.type,
    amount: doc.amount,
    status: doc.status,
    createdAt: doc.createdAt,
    user: doc.userId ? {
      id: String(doc.userId._id || doc.userId),
      name: doc.userId.name,
      email: doc.userId.email
    } : undefined,
    lawyer: doc.lawyerId ? {
      id: String(doc.lawyerId._id || doc.lawyerId),
      name: doc.lawyerId.name,
      email: doc.lawyerId.email
    } : undefined,
    hiringId: doc.hiringId ? String(doc.hiringId._id || doc.hiringId) : undefined
  };
}

export async function listForUser(userId: string) {
  const docs = await Transaction.find({ userId: new Types.ObjectId(userId) })
    .populate("lawyerId", "name email")
    .sort({ createdAt: -1 })
    .exec();
  return docs.map(toDto);
}

export async function listForLawyer(lawyerUserId: string) {
  const Lawyer = (await import("../models/Lawyer")).default;
  const lawyer = await Lawyer.findOne({ userId: new Types.ObjectId(lawyerUserId) }).exec();
  if (!lawyer) throw new HttpError(404, "Lawyer profile not found");

  const docs = await Transaction.find({ lawyerId: lawyer._id })
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .exec();
  return docs.map(toDto);
}

export async function listAll(page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    Transaction.find()
      .populate("userId", "name email")
      .populate("lawyerId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
    Transaction.countDocuments().exec()
  ]);

  return {
    data: docs.map(toDto),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}
