import { z } from "zod";
import { formatProfessionalEmail } from "@/lib/constants";

const handleRegex = /^[a-z0-9](?:[a-z0-9.-]{1,30}[a-z0-9])?$/;
const reservedHandles = new Set([
  "admin",
  "support",
  "help",
  "api",
  "mail",
  "root",
  "www",
  "postmaster",
  "abuse",
  "noreply",
]);

export const professionalHandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(32)
  .regex(handleRegex, "Handle can only use a-z, 0-9, dot and hyphen")
  .refine((v) => !v.includes("..") && !v.includes("--"), {
    message: "Handle cannot contain consecutive separators",
  })
  .refine((v) => !reservedHandles.has(v), {
    message: "Handle is reserved",
  });

export function normalizeProfessionalHandle(input: string): string {
  return professionalHandleSchema.parse(input);
}

export function professionalEmailForHandle(handle: string): string {
  return formatProfessionalEmail(handle);
}
