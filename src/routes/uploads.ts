import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../middleware/error-handler";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const uploadSchema = z.object({
  image: z.string().min(1, "Image data is required"),
  name: z.string().max(255).optional(),
});

router.post(
  "/image",
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!env.IMGBB_API_KEY) {
      throw new HttpError(503, "Image upload is not configured");
    }

    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid payload");
    }

    const base64 = parsed.data.image;
    const dataUrlMatch = base64.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = dataUrlMatch?.[1];
    const imageData = dataUrlMatch ? dataUrlMatch[2] : base64;

    if (mimeType && !ALLOWED_TYPES.includes(mimeType)) {
      throw new HttpError(400, "Only JPEG, PNG, GIF, or WebP images are allowed");
    }

    const approxBytes = Math.floor((imageData.length * 3) / 4);
    if (approxBytes > MAX_FILE_SIZE) {
      throw new HttpError(400, "Image must be smaller than 5MB");
    }

    const formData = new FormData();
    formData.append("image", imageData);
    if (parsed.data.name) formData.append("name", parsed.data.name);

    const upstream = await fetch(`https://api.imgbb.com/1/upload?key=${env.IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });

    if (!upstream.ok) {
      const errBody = await upstream.json().catch(() => ({}));
      throw new HttpError(upstream.status, errBody.error?.message || "Failed to upload image");
    }

    const data = (await upstream.json()) as { data?: { url?: string } };
    if (!data.data?.url) {
      throw new HttpError(502, "Upload succeeded but no URL was returned");
    }

    res.json({ url: data.data.url });
  })
);

export default router;
