import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),
  BACKEND_URL: z.string().url().default("http://localhost:5000"),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(6).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  console.error("Invalid environment variables:\n" + issues);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
