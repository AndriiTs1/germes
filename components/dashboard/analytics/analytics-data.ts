export type ChartAccent = "mint" | "blue" | "amber" | "rose";

/** Stable key into dictionary.commandCenter.inventoryStatus.segments — the segment's label is never stored here. */
export type InventorySegmentKey =
  | "inStock"
  | "reserved"
  | "inTransit"
  | "lowStock";
