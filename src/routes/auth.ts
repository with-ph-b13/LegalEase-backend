import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User, { Role } from "../models/User";
import { authMiddleware, generateToken } from "../middleware/auth";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../middleware/error-handler";
import { registerSchema, loginSchema } from "../validators/auth";
import { env } from "../config/env";

const router = Router();

function toUserResponse(user: { _id: unknown; email: string; name: string; avatar?: string; role: Role }) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
  };
}

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${env.BACKEND_URL}/api/auth/callback/google`,
        passReqToCallback: true,
      },
      async (req, _accessToken, _refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            const state = req.query.state as string;
            const role = state === "lawyer" ? "lawyer" : "user";
            user = await User.create({
              email: profile.emails?.[0]?.value || `${profile.id}@google.placeholder`,
              name: profile.displayName || "Google User",
              avatar: profile.photos?.[0]?.value,
              googleId: profile.id,
              role,
            });
          }
          done(null, user as unknown as Express.User);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

router.post(
  "/register",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid payload");
    }
    const { name, email, password, role } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new HttpError(409, "Email already registered");
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, role });
    const token = generateToken({ userId: user._id.toString(), email: user.email, role: user.role });

    // Trigger welcome email
    try {
      const { logEmail } = await import("../services/email-service");
      logEmail(
        user.email,
        "Welcome to LegalEase!",
        `Hi ${user.name},\n\nThank you for registering on LegalEase as a ${user.role}.\n\nBest regards,\nThe LegalEase Team`
      );
    } catch (e) {
      console.error("Email trigger failed:", e);
    }

    res.status(201).json({ token, user: toUserResponse(user) });
  })
);

router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid payload");
    }
    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      throw new HttpError(401, "Invalid credentials");
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw new HttpError(401, "Invalid credentials");
    }

    const token = generateToken({ userId: user._id.toString(), email: user.email, role: user.role });
    res.json({ token, user: toUserResponse(user) });
  })
);

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.currentUser) {
      throw new HttpError(401, "Not authenticated");
    }
    const user = await User.findById(req.currentUser.userId).select("-password");
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    res.json(toUserResponse(user));
  })
);

import { z } from "zod";
const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatar: z.string().url().optional(),
});

router.patch(
  "/me",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.currentUser) throw new HttpError(401, "Not authenticated");
    
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid payload");
    }

    const updated = await User.findByIdAndUpdate(
      req.currentUser.userId,
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updated) throw new HttpError(404, "User not found");
    
    res.json(toUserResponse(updated));
  })
);

router.get(
  "/google",
  (req: Request, res: Response, next: NextFunction) => {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new HttpError(503, "Google login is not configured");
    }
    const state = req.query.state as string;
    passport.authenticate("google", { scope: ["profile", "email"], session: false, state })(req, res, next);
  }
);

router.get(
  "/callback/google",
  (req: Request, res: Response, next: NextFunction) => {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new HttpError(503, "Google login is not configured");
    }
    passport.authenticate("google", { session: false, failureRedirect: "/login" }, (err: unknown, user: unknown) => {
      if (err || !user) {
        res.redirect(`${env.CLIENT_URL}/login?error=google_failed`);
        return;
      }
      const u = user as { _id: unknown; email: string; role: Role };
      const token = generateToken({ userId: String(u._id), email: u.email, role: u.role });
      res.redirect(`${env.CLIENT_URL}/?token=${token}`);
    })(req, res, next);
  }
);

export default router;
