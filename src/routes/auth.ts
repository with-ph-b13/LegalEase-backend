import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User";
import { generateToken } from "../middleware/auth";

const router = Router();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/api/auth/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.create({
            email: profile.emails?.[0]?.value || `${profile.id}@google.com`,
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value,
            googleId: profile.id,
          });
        }
        done(null, user as any);
      } catch (err) {
        done(err as Error);
      }
    }
  )
);

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "email, password, and name are required" });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hashed, name });

    const token = generateToken({ userId: user._id.toString(), email: user.email });
    res.status(201).json({
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name, avatar: user.avatar },
    });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken({ userId: user._id.toString(), email: user.email });
    res.json({
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name, avatar: user.avatar },
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    const token = generateToken({ userId: user._id.toString(), email: user.email });
    res.redirect(`${process.env.CLIENT_URL || "http://localhost:3000"}?token=${token}`);
  }
);

export default router as Router;
