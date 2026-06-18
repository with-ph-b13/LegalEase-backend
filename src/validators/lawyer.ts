import { z } from "zod";
import { SPECIALIZATIONS } from "../models/Lawyer";

export const specializationEnum = z.enum(SPECIALIZATIONS);

export const lawyerCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    specialization: specializationEnum,
    bio: z.string().trim().min(20, "Bio must be at least 20 characters").max(2000),
    fee: z.coerce.number().int().min(0).max(1_000_000_00),
    imageUrl: z.string().url().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  })
  .strict();

export const lawyerUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    specialization: specializationEnum.optional(),
    bio: z.string().trim().min(20).max(2000).optional(),
    fee: z.coerce.number().int().min(0).max(1_000_000_00).optional(),
    imageUrl: z
      .string()
      .url()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    status: z.enum(["available", "busy"]).optional(),
  })
  .strict();

export const lawyerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(9),
  q: z.string().trim().optional(),
  specialization: specializationEnum.optional(),
  minFee: z.coerce.number().int().min(0).optional(),
  maxFee: z.coerce.number().int().min(0).optional(),
  available: z
    .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional()
    .transform((v) => (v === "true" || v === "1" ? true : v === "false" || v === "0" ? false : undefined)),
  sort: z.enum(["newest", "oldest", "hired", "fee_asc", "fee_desc"]).default("newest"),
});

export type LawyerCreateInput = z.infer<typeof lawyerCreateSchema>;
export type LawyerUpdateInput = z.infer<typeof lawyerUpdateSchema>;
export type LawyerListQuery = z.infer<typeof lawyerListQuerySchema>;
