"use client";

import { useState, type ReactNode } from "react";

/**
 * A short list that can be expanded to the full, already-loaded one. Both
 * item arrays are rendered on the server (keyed <li>s); only the expanded
 * flag lives here — expanding never fetches anything.
 */
export function PreviewList({
  preview,
  full,
  showAllLabel,
  collapseLabel,
  emptyPreview,
  className,
}: {
  preview: ReactNode[];
  full: ReactNode[];
  showAllLabel: string;
  collapseLabel: string;
  /** Shown instead of an empty preview while collapsed. */
  emptyPreview?: ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = full.length > preview.length;

  return (
    <>
      {!expanded && preview.length === 0 && emptyPreview ? (
        emptyPreview
      ) : (
        <ul className={className}>{expanded ? full : preview}</ul>
      )}
      {canToggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 self-start px-2 text-[12px] font-medium text-blue-600 hover:text-blue-700"
        >
          {expanded ? collapseLabel : showAllLabel}
        </button>
      ) : null}
    </>
  );
}
