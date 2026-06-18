import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    if (err.name === "CastError") {
      res.status(400).json({ error: "Invalid identifier" });
      return;
    }
    if (err.name === "ValidationError") {
      res.status(400).json({ error: err.message });
      return;
    }
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: "Duplicate value" });
      return;
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
    return;
  }
  console.error("Unknown error:", err);
  res.status(500).json({ error: "Internal server error" });
};
