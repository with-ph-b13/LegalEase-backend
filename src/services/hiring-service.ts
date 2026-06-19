import mongoose, { Types } from "mongoose";
import Hiring, { IHiring, HiringStatus } from "../models/Hiring";
import Lawyer from "../models/Lawyer";
import { HttpError } from "../middleware/error-handler";

function toDto(doc: any) {
  return {
    id: String(doc._id),
    _id: String(doc._id),
    userId: String(doc.userId._id || doc.userId),
    lawyerId: String(doc.lawyerId._id || doc.lawyerId),
    status: doc.status,
    fee: doc.fee,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lawyer: doc.lawyerId.name ? {
      id: String(doc.lawyerId._id),
      _id: String(doc.lawyerId._id),
      name: doc.lawyerId.name,
      specialization: doc.lawyerId.specialization,
      imageUrl: doc.lawyerId.imageUrl,
    } : undefined,
    user: doc.userId.name ? {
      id: String(doc.userId._id),
      _id: String(doc.userId._id),
      name: doc.userId.name,
      email: doc.userId.email,
    } : undefined
  };
}

export async function createHire(userId: string, lawyerId: string) {
  if (!mongoose.isValidObjectId(lawyerId)) {
    throw new HttpError(400, "Invalid lawyer id");
  }

  const lawyer = await Lawyer.findById(lawyerId).exec();
  if (!lawyer) {
    throw new HttpError(404, "Lawyer not found");
  }
  
  if (String(lawyer.userId) === userId) {
    throw new HttpError(403, "You cannot hire yourself");
  }

  // Check for active hires
  const existing = await Hiring.findOne({
    userId: new Types.ObjectId(userId),
    lawyerId: new Types.ObjectId(lawyerId),
    status: { $in: ["pending", "accepted"] }
  }).exec();

  if (existing) {
    throw new HttpError(409, "You already have an active hiring request with this lawyer");
  }

  const hire = await Hiring.create({
    userId: new Types.ObjectId(userId),
    lawyerId: new Types.ObjectId(lawyerId),
    status: "pending",
    fee: lawyer.fee
  });

  return toDto(hire);
}

export async function listForUser(userId: string) {
  const docs = await Hiring.find({ userId: new Types.ObjectId(userId) })
    .populate("lawyerId", "name specialization imageUrl")
    .sort({ createdAt: -1 })
    .exec();
  return docs.map(toDto);
}

export async function listForLawyer(lawyerUserId: string) {
  const lawyer = await Lawyer.findOne({ userId: new Types.ObjectId(lawyerUserId) }).exec();
  if (!lawyer) {
    return [];
  }
  const docs = await Hiring.find({ lawyerId: lawyer._id })
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .exec();
  return docs.map(toDto);
}

export async function getHireById(id: string, userId: string, role: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, "Invalid hiring id");
  }
  const doc = await Hiring.findById(id)
    .populate("lawyerId", "userId name specialization imageUrl")
    .populate("userId", "name email")
    .exec();
    
  if (!doc) {
    throw new HttpError(404, "Hiring request not found");
  }

  const isUser = String(doc.userId._id || doc.userId) === userId;
  const isLawyer = String((doc.lawyerId as any).userId) === userId;

  if (!isUser && !isLawyer && role !== "admin") {
    throw new HttpError(403, "Unauthorized access to this hiring request");
  }

  return toDto(doc);
}

export async function respondToHire(id: string, lawyerUserId: string, status: "accepted" | "rejected") {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, "Invalid hiring id");
  }

  const lawyer = await Lawyer.findOne({ userId: new Types.ObjectId(lawyerUserId) }).exec();
  if (!lawyer) {
    throw new HttpError(404, "Lawyer profile not found");
  }

  const hire = await Hiring.findOneAndUpdate(
    { _id: new Types.ObjectId(id), lawyerId: lawyer._id, status: "pending" },
    { $set: { status } },
    { new: true }
  ).populate("userId", "name email").exec();

  if (!hire) {
    throw new HttpError(404, "Pending hiring request not found or unauthorized");
  }

  return toDto(hire);
}
