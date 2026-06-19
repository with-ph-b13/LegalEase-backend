import "dotenv/config";
import express from "express";
import cors from "cors";
import passport from "passport";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import authRoutes from "./routes/auth";
import lawyerRoutes from "./routes/lawyers";
import hiringRoutes from "./routes/hirings";
import commentRoutes from "./routes/comments";
import transactionRoutes from "./routes/transactions";
import adminRoutes from "./routes/admin";
import shortlistRoutes from "./routes/shortlist";
import uploadRoutes from "./routes/uploads";
import { authRateLimiter } from "./middleware/rate-limit";
import paymentRoutes from "./routes/payments";

const app = express();

app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

// Webhook needs raw body to verify signature
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV });
});

app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/lawyers", lawyerRoutes);
app.use("/api/hirings", hiringRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/shortlist", shortlistRoutes);
app.use("/api/upload", express.json({ limit: "10mb" }), uploadRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
