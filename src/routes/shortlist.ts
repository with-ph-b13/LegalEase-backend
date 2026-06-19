import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/async-handler";
import { authMiddleware } from "../middleware/auth";
import User from "../models/User";
import { HttpError } from "../middleware/error-handler";
import mongoose from "mongoose";

const router = Router();

router.use(authMiddleware);

// Get my shortlist
router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.currentUser!.userId)
      .populate("shortlist")
      .exec();
    
    if (!user) throw new HttpError(404, "User not found");
    
    res.json(user.shortlist || []);
  })
);

// Add to shortlist
router.post(
  "/:lawyerId",
  asyncHandler(async (req: Request, res: Response) => {
    const lawyerId = req.params.lawyerId;
    const Lawyer = (await import("../models/Lawyer")).default;
    
    const lawyerExists = await Lawyer.exists({ _id: lawyerId });
    if (!lawyerExists) throw new HttpError(404, "Lawyer not found");

    const user = await User.findByIdAndUpdate(
      req.currentUser!.userId,
      { $addToSet: { shortlist: new mongoose.Types.ObjectId(lawyerId as string) } },
      { new: true }
    );
    
    res.json({ success: true, shortlist: user?.shortlist });
  })
);

// Remove from shortlist
router.delete(
  "/:lawyerId",
  asyncHandler(async (req: Request, res: Response) => {
    const lawyerId = req.params.lawyerId;
    
    const user = await User.findByIdAndUpdate(
      req.currentUser!.userId,
      { $pull: { shortlist: new mongoose.Types.ObjectId(lawyerId as string) } },
      { new: true }
    );
    
    res.json({ success: true, shortlist: user?.shortlist });
  })
);

export default router;
