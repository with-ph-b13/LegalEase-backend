import mongoose, { Types } from "mongoose";
import Lawyer, { ILawyer, LawyerStatus } from "../models/Lawyer";
import { HttpError } from "../middleware/error-handler";
import type { LawyerListQuery } from "../validators/lawyer";

const BUSY_THRESHOLD = Number(process.env.BUSY_THRESHOLD ?? 3);

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function toDto(doc: ILawyer | (ILawyer & { _id: Types.ObjectId | string })) {
  const d = doc as unknown as ILawyer & { _id: Types.ObjectId | string };
  return {
    _id: String(d._id),
    id: String(d._id),
    userId: String(d.userId),
    name: d.name,
    email: d.email,
    specialization: d.specialization,
    bio: d.bio,
    fee: d.fee,
    imageUrl: d.imageUrl,
    status: d.status,
    published: d.published,
    hiredCount: d.hiredCount,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function listLawyers(query: LawyerListQuery): Promise<PaginatedResult<ReturnType<typeof toDto>>> {
  const filter: Record<string, unknown> = { published: true };

  if (query.specialization) filter.specialization = query.specialization;
  if (query.available) filter.status = "available";
  if (query.minFee !== undefined || query.maxFee !== undefined) {
    const feeFilter: Record<string, number> = {};
    if (query.minFee !== undefined) feeFilter.$gte = query.minFee;
    if (query.maxFee !== undefined) feeFilter.$lte = query.maxFee;
    filter.fee = feeFilter;
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    hired: { hiredCount: -1, createdAt: -1 },
    fee_asc: { fee: 1, createdAt: -1 },
    fee_desc: { fee: -1, createdAt: -1 },
  };

  const skip = (query.page - 1) * query.limit;
  const filterWithText = query.q ? { ...filter, $text: { $search: query.q } } : filter;

  const [docs, total] = await Promise.all([
    Lawyer.find(filterWithText)
      .sort(sortMap[query.sort] ?? sortMap.newest)
      .skip(skip)
      .limit(query.limit)
      .exec(),
    Lawyer.countDocuments(filterWithText).exec(),
  ]);

  return {
    data: docs.map(toDto),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getFeaturedLawyers() {
  const docs = await Lawyer.find({ published: true })
    .sort({ createdAt: -1 })
    .limit(6)
    .exec();
  return docs.map(toDto);
}

export async function getTopLawyers(limit = 3) {
  const docs = await Lawyer.find({ published: true })
    .sort({ hiredCount: -1, createdAt: -1 })
    .limit(limit)
    .exec();
  return docs.map(toDto);
}

export async function getLawyerById(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, "Invalid lawyer id");
  }
  const doc = await Lawyer.findById(id).exec();
  if (!doc) {
    throw new HttpError(404, "Lawyer not found");
  }
  return toDto(doc);
}

export async function getLawyerByUserId(userId: string) {
  const doc = await Lawyer.findOne({ userId: new Types.ObjectId(userId) }).exec();
  if (!doc) return null;
  return toDto(doc);
}

interface UpsertPayload {
  name: string;
  email: string;
  specialization: ILawyer["specialization"];
  bio: string;
  fee: number;
  imageUrl?: string;
}

export async function upsertOwnProfile(userId: string, payload: UpsertPayload) {
  const doc = await Lawyer.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $set: {
        name: payload.name,
        email: payload.email,
        specialization: payload.specialization,
        bio: payload.bio,
        fee: payload.fee,
        imageUrl: payload.imageUrl,
      },
      $setOnInsert: { userId: new Types.ObjectId(userId), status: "available", published: false, hiredCount: 0 },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).exec();
  return toDto(doc as ILawyer);
}

export async function updateOwnProfile(userId: string, payload: Partial<UpsertPayload & { status: LawyerStatus }>) {
  const doc = await Lawyer.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { $set: payload },
    { new: true, runValidators: true }
  ).exec();
  if (!doc) {
    throw new HttpError(404, "Lawyer profile not found");
  }
  return toDto(doc);
}

export async function setPublished(lawyerId: string, published: boolean) {
  const doc = await Lawyer.findByIdAndUpdate(
    lawyerId,
    { $set: { published } },
    { new: true }
  ).exec();
  if (!doc) {
    throw new HttpError(404, "Lawyer not found");
  }
  return toDto(doc);
}

export async function setStatus(lawyerId: string, status: LawyerStatus) {
  const doc = await Lawyer.findByIdAndUpdate(
    lawyerId,
    { $set: { status } },
    { new: true }
  ).exec();
  if (!doc) {
    throw new HttpError(404, "Lawyer not found");
  }
  return toDto(doc);
}

export async function deleteLawyer(lawyerId: string) {
  const doc = await Lawyer.findByIdAndDelete(lawyerId).exec();
  if (!doc) {
    throw new HttpError(404, "Lawyer not found");
  }
  return { id: String(doc._id) };
}

export async function assertOwner(lawyerId: string, userId: string) {
  if (!mongoose.isValidObjectId(lawyerId)) {
    throw new HttpError(400, "Invalid lawyer id");
  }
  const doc = await Lawyer.findById(lawyerId).select("userId").exec();
  if (!doc) {
    throw new HttpError(404, "Lawyer not found");
  }
  if (String(doc.userId) !== userId) {
    throw new HttpError(403, "You can only modify your own profile");
  }
  return doc;
}

export async function incrementHiredCount(lawyerId: string) {
  const lawyer = await Lawyer.findByIdAndUpdate(
    lawyerId,
    { $inc: { hiredCount: 1 } },
    { new: true }
  ).exec();

  if (lawyer) {
    const threshold = Number(process.env.UNPUBLISH_THRESHOLD ?? 10);
    if (lawyer.hiredCount >= threshold && lawyer.published) {
      lawyer.published = false;
      await lawyer.save();

      // Find lawyer user email to notify
      try {
        const User = (await import("../models/User")).default;
        const lawyerUser = await User.findById(lawyer.userId).exec();
        if (lawyerUser) {
          const { logEmail } = await import("./email-service");
          logEmail(
            lawyerUser.email,
            "Profile Unpublished: Hiring Limit Reached",
            `Hi ${lawyer.name},\n\nYour profile has been unpublished because you have reached the platform threshold of ${threshold} hires. Please review your active cases and re-publish your profile when you have capacity.\n\nBest regards,\nThe LegalEase Team`
          );
        }
      } catch (e) {
        console.error("Failed to send unpublish threshold email:", e);
      }
    }
  }
}

export async function recomputeStatus(lawyerId: string, activeAcceptedUnpaid: number) {
  const next: LawyerStatus = activeAcceptedUnpaid >= BUSY_THRESHOLD ? "busy" : "available";
  await Lawyer.findByIdAndUpdate(lawyerId, { $set: { status: next } }).exec();
  return next;
}
