import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { authMiddleware, requireRole } from "../middleware/auth";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../middleware/error-handler";
import User from "../models/User";
import * as lawyerService from "../services/lawyer-service";
import {
  lawyerCreateSchema,
  lawyerUpdateSchema,
  lawyerListQuerySchema,
} from "../validators/lawyer";

const router = Router();

function parseListQuery(req: Request) {
  const parsed = lawyerListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid query");
  }
  return parsed.data;
}

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const query = parseListQuery(req);
    const result = await lawyerService.listLawyers(query);
    res.json(result);
  })
);

router.get(
  "/featured",
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await lawyerService.getFeaturedLawyers();
    res.json({ data });
  })
);

router.get(
  "/top",
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await lawyerService.getTopLawyers(3);
    res.json({ data });
  })
);

router.get(
  "/me",
  authMiddleware,
  requireRole("lawyer"),
  asyncHandler(async (req: Request, res: Response) => {
    const lawyer = await lawyerService.getLawyerByUserId(req.currentUser!.userId);
    res.json({ data: lawyer });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const lawyer = await lawyerService.getLawyerById(req.params.id);
    res.json({ data: lawyer });
  })
);

router.post(
  "/",
  authMiddleware,
  requireRole("lawyer"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = lawyerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid payload");
    }
    const user = await User.findById(req.currentUser!.userId).select("email name").exec();
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    const existing = await lawyerService.getLawyerByUserId(req.currentUser!.userId);
    if (existing) {
      throw new HttpError(409, "You already have a profile. Use PATCH to update it.");
    }
    const created = await lawyerService.upsertOwnProfile(req.currentUser!.userId, {
      name: parsed.data.name,
      email: user.email,
      specialization: parsed.data.specialization,
      bio: parsed.data.bio,
      fee: parsed.data.fee,
      imageUrl: parsed.data.imageUrl,
    });
    res.status(201).json({ data: created });
  })
);

router.patch(
  "/:id",
  authMiddleware,
  requireRole("lawyer"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = lawyerUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid payload");
    }
    await lawyerService.assertOwner(req.params.id, req.currentUser!.userId);
    const updated = await lawyerService.setPublished(req.params.id, false).then(async () => {
      return lawyerService.updateOwnProfile(req.currentUser!.userId, parsed.data);
    });
    res.json({ data: updated });
  })
);

router.delete(
  "/:id",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Invalid lawyer id");
    }
    const role = req.currentUser!.role;
    if (role === "lawyer") {
      await lawyerService.assertOwner(req.params.id, req.currentUser!.userId);
    } else if (role !== "admin") {
      throw new HttpError(403, "Insufficient permissions");
    }
    await lawyerService.deleteLawyer(req.params.id);
    res.json({ data: { id: req.params.id } });
  })
);

router.patch(
  "/:id/publish",
  authMiddleware,
  requireRole("lawyer"),
  asyncHandler(async (req: Request, res: Response) => {
    await lawyerService.assertOwner(req.params.id, req.currentUser!.userId);
    const updated = await lawyerService.setPublished(req.params.id, true);
    res.json({ data: updated });
  })
);

router.patch(
  "/:id/toggle-publish",
  authMiddleware,
  requireRole("lawyer"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Invalid lawyer id");
    }
    await lawyerService.assertOwner(req.params.id, req.currentUser!.userId);
    const current = await lawyerService.getLawyerById(req.params.id);
    const updated = await lawyerService.setPublished(req.params.id, !current.published);
    res.json({ data: updated });
  })
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireRole("lawyer"),
  asyncHandler(async (req: Request, res: Response) => {
    const status = req.body?.status;
    if (status !== "available" && status !== "busy") {
      throw new HttpError(400, "status must be 'available' or 'busy'");
    }
    await lawyerService.assertOwner(req.params.id, req.currentUser!.userId);
    const updated = await lawyerService.setStatus(req.params.id, status);
    res.json({ data: updated });
  })
);

export default router;
