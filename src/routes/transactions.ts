import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/async-handler";
import { authMiddleware, requireRole } from "../middleware/auth";
import * as transactionService from "../services/transaction-service";
import { HttpError } from "../middleware/error-handler";

const router = Router();

router.use(authMiddleware);

router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const role = req.currentUser!.role;
    let result;
    if (role === "user") {
      result = await transactionService.listForUser(req.currentUser!.userId);
    } else if (role === "lawyer") {
      result = await transactionService.listForLawyer(req.currentUser!.userId);
    } else {
      throw new HttpError(403, "Admins should use the global transactions route");
    }
    res.json(result);
  })
);

router.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "10", 10);
    const result = await transactionService.listAll(page, limit);
    res.json(result);
  })
);

export default router;
