/**
 * Zod schemas under lib/validation/*.ts set `message` to a stable error
 * CODE (e.g. "invalidEmail"), never end-user text. This maps that code to
 * the localized string via the caller's `dictionary.*.errors` map — the
 * one place per form where the mapping happens, so components never carry
 * their own locale conditionals. Falls back to the raw code only if a
 * dictionary entry is ever missing (shouldn't happen: uk/ru are
 * structurally type-checked against en.ts).
 */
export function resolveFieldError(
  errors: Record<string, string>,
  code: string | undefined,
): string | undefined {
  if (!code) return undefined;
  return errors[code] ?? code;
}
