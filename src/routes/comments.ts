import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/async-handler";
import { authMiddleware, requireRole } from "../middleware/auth";
import * as commentService from "../services/comment-service";
import { z } from "zod";
import { HttpError } from "../middleware/error-handler";

const router = Router();

const createSchema = z.object({
  lawyerId: z.string().min(1, "lawyerId is required"),
  text: z.string().min(1, "Comment text is required"),
  rating: z.number().int().min(1).max(5)
});

const updateSchema = z.object({
  text: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5).optional()
});

router.get(
  "/lawyer/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "10", 10);
    const result = await commentService.listForLawyer(req.params.id as string, page, limit);
    res.json(result);
  })
);

router.use(authMiddleware);

router.post(
  "/",
  requireRole("user"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid payload");
    }
    const result = await commentService.createComment(
      req.currentUser!.userId,
      parsed.data.lawyerId,
      parsed.data.text,
      parsed.data.rating
    );
    res.status(201).json(result);
  })
);

router.get(
  "/me",
  requireRole("user"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await commentService.listForUser(req.currentUser!.userId);
    res.json(result);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid payload");
    }
    const result = await commentService.updateComment(
      req.params.id as string,
      req.currentUser!.userId,
      req.currentUser!.role,
      parsed.data.text,
      parsed.data.rating
    );
    res.json(result);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const result = await commentService.deleteComment(
      req.params.id as string,
      req.currentUser!.userId,
      req.currentUser!.role
    );
    res.json(result);
  })
);

export default router;
