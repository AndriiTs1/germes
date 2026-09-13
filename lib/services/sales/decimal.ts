import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Single documented boundary representation for money/kg quantities leaving
 * a SALES service: a decimal string. Never a raw Prisma.Decimal (not safely
 * serializable into a Client Component) and never a JS number (unsafe
 * floating-point for money). Callers that need to display a value can parse
 * the string themselves; callers that need to keep computing should stay in
 * Prisma.Decimal until the final boundary crossing.
 */
export function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}
