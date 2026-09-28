/**
 * Internal technical markers stored in `notes` that must never be shown to
 * users. "[DEMO-100M]" tags the demo dataset rows (scripts/demo-100m/config.ts
 * DEMO_MARKER); it stays in the database, the UI simply hides it.
 */
const INTERNAL_NOTE_MARKERS = ["[DEMO-100M]"] as const;

/**
 * The user-facing part of a `notes` value: internal markers removed (with the
 * spaces around them on that line), surrounding whitespace trimmed. Returns
 * null when nothing user-written remains, so callers can hide the whole
 * Notes block. Pure presentation — the stored value is never changed.
 */
export function displayNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  let text = notes;
  for (const marker of INTERNAL_NOTE_MARKERS) {
    text = text.split(marker).join("\u0000");
  }
  text = text
    .replace(/[ \t]*\u0000[ \t]*/g, " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  return text === "" ? null : text;
}
