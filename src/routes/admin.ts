import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/async-handler";
import { authMiddleware, requireRole } from "../middleware/auth";
import User, { Role } from "../models/User";
import { HttpError } from "../middleware/error-handler";

const router = Router();

router.use(authMiddleware);
router.use(requireRole("admin"));

router.get(
  "/users",
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "20", 10);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      User.countDocuments().exec()
    ]);

    res.json({
      data: users,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  })
);

router.patch(
  "/users/:id/role",
  asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.body;
    if (!["user", "lawyer", "admin"].includes(role)) {
      throw new HttpError(400, "Invalid role");
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) throw new HttpError(404, "User not found");

    // Prevent demoting the last admin
    if (targetUser.role === "admin" && role !== "admin") {
      const adminCount = await User.countDocuments({ role: "admin" }).exec();
      if (adminCount <= 1) {
        throw new HttpError(400, "Cannot demote the last admin");
      }
    }

    targetUser.role = role as Role;
    await targetUser.save();

    res.json({ data: targetUser });
  })
);

router.delete(
  "/users/:id",
  asyncHandler(async (req: Request, res: Response) => {
    if (req.params.id === req.currentUser!.userId) {
      throw new HttpError(400, "Cannot delete yourself");
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) throw new HttpError(404, "User not found");

    // Prevent deleting the last admin
    if (targetUser.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" }).exec();
      if (adminCount <= 1) {
        throw new HttpError(400, "Cannot delete the last admin");
      }
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  })
);

router.get(
  "/lawyers",
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "20", 10);
    const skip = (page - 1) * limit;

    const Lawyer = (await import("../models/Lawyer")).default;

    const [lawyers, total] = await Promise.all([
      Lawyer.find().populate("userId", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      Lawyer.countDocuments().exec()
    ]);

    res.json({
      data: lawyers,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  })
);

router.patch(
  "/lawyers/:id/publish",
  asyncHandler(async (req: Request, res: Response) => {
    const { published } = req.body;
    const Lawyer = (await import("../models/Lawyer")).default;
    
    const lawyer = await Lawyer.findByIdAndUpdate(
      req.params.id, 
      { $set: { published: !!published } },
      { new: true }
    );
    
    if (!lawyer) throw new HttpError(404, "Lawyer not found");
    res.json({ data: lawyer });
  })
);

router.delete(
  "/lawyers/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const Lawyer = (await import("../models/Lawyer")).default;
    const lawyer = await Lawyer.findByIdAndDelete(req.params.id);
    if (!lawyer) throw new HttpError(404, "Lawyer not found");
    
    // Cascading: optionally we could delete comments/hirings here.
    // For now, we'll leave them as orphaned records or handle via DB triggers.
    
    res.json({ success: true });
  })
);

router.get(
  "/analytics",
  asyncHandler(async (req: Request, res: Response) => {
    const Lawyer = (await import("../models/Lawyer")).default;
    const Hiring = (await import("../models/Hiring")).default;
    const Transaction = (await import("../models/Transaction")).default;

    const [
      totalUsers,
      totalLawyers,
      totalHires,
      revenueResult,
      hiresOverTime,
      revenueByCategory
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Lawyer.countDocuments(),
      Hiring.countDocuments(),
      Transaction.aggregate([
        { $match: { status: "succeeded" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Hiring.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 30 }
      ]),
      Transaction.aggregate([
        { $match: { status: "succeeded", type: "hire_fee" } },
        {
          $lookup: {
            from: "lawyers",
            localField: "lawyerId",
            foreignField: "_id",
            as: "lawyer"
          }
        },
        { $unwind: "$lawyer" },
        {
          $group: {
            _id: "$lawyer.specialization",
            total: { $sum: "$amount" }
          }
        },
        { $sort: { total: -1 } }
      ])
    ]);

    res.json({
      totalUsers,
      totalLawyers,
      totalHires,
      totalRevenue: revenueResult.length > 0 ? revenueResult[0].total : 0,
      hiresOverTime,
      revenueByCategory
    });
  })
);

export default router;
