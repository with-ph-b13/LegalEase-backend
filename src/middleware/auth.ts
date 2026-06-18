import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "../models/User";

export interface AuthPayload {
  userId: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: AuthPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    const token = header.slice(7);
    req.currentUser = jwt.verify(token, JWT_SECRET) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.currentUser.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
