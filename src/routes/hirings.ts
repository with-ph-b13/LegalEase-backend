import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/async-handler";
import { authMiddleware, requireRole } from "../middleware/auth";
import * as hiringService from "../services/hiring-service";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  requireRole("user"),
  asyncHandler(async (req: Request, res: Response) => {
    const { lawyerId } = req.body;
    if (!lawyerId) {
      return res.status(400).json({ error: "lawyerId is required" });
    }
    const result = await hiringService.createHire(req.currentUser!.userId, lawyerId);
    res.status(201).json(result);
  })
);

router.get(
  "/me",
  requireRole("user"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await hiringService.listForUser(req.currentUser!.userId);
    res.json(result);
  })
);

router.get(
  "/lawyer",
  requireRole("lawyer"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await hiringService.listForLawyer(req.currentUser!.userId);
    res.json(result);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const result = await hiringService.getHireById(req.params.id, req.currentUser!.userId, req.currentUser!.role);
    res.json(result);
  })
);

router.patch(
  "/:id/respond",
  requireRole("lawyer"),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (status !== "accepted" && status !== "rejected") {
      return res.status(400).json({ error: "Invalid status. Must be accepted or rejected." });
    }
    const result = await hiringService.respondToHire(req.params.id, req.currentUser!.userId, status);
    res.json(result);
  })
);

export default router;
