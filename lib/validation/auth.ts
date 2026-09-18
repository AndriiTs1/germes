import { z } from "zod";

/**
 * Stable codes, not English text — LoginForm resolves each one through
 * dictionary.auth.errors via resolveFieldError. Keep in sync with
 * dictionary.auth.errors in en/uk/ru.
 */
export const AUTH_ERROR_CODES = ["invalidEmail", "passwordRequired"] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email("invalidEmail" satisfies AuthErrorCode)),
  password: z.string().min(1, "passwordRequired" satisfies AuthErrorCode),
});

export type LoginInput = z.infer<typeof loginSchema>;
