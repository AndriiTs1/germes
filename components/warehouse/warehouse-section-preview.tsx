"use client";

import { useState, type ReactNode } from "react";

type WarehouseSectionPreviewProps = {
  preview: ReactNode;
  full: ReactNode;
  totalCount: number;
  previewCount: number;
  showAllLabel: string;
  collapseLabel: string;
};

/**
 * Presentation-only disclosure for read-only warehouse viewers.
 * All data is already loaded on the server; expanding performs no fetch.
 * Warehouse operators do not use this component.
 */
export function WarehouseSectionPreview({
  preview,
  full,
  totalCount,
  previewCount,
  showAllLabel,
  collapseLabel,
}: WarehouseSectionPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = totalCount > previewCount;

  return (
    <div className="flex flex-col">
      {expanded ? full : preview}

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
    </div>
  );
}
