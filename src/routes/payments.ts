import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/async-handler";
import { authMiddleware, requireRole } from "../middleware/auth";
import * as paymentService from "../services/payment-service";
import express from "express";

import { paymentRateLimiter } from "../middleware/rate-limit";

const router = Router();

// Webhook needs raw body to verify signature
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).send("Missing stripe-signature header");
    }
    const result = await paymentService.handleWebhook(req.body, signature as string);
    res.json(result);
  })
);

router.use(paymentRateLimiter);
router.use(authMiddleware);

router.post(
  "/publish-fee",
  requireRole("lawyer"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await paymentService.createPublishCheckout(req.currentUser!.userId);
    res.json(result);
  })
);

router.post(
  "/hire/:hiringId",
  requireRole("user"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await paymentService.createHireCheckout(req.params.hiringId, req.currentUser!.userId);
    res.json(result);
  })
);

export default router;
