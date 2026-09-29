import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SupplierDetailOverview } from "@/components/procurement/supplier-detail-overview";
import { CustomerDetailNotes } from "@/components/sales/customer-detail-notes";
import { OrderDetailNotes } from "@/components/sales/order-detail-notes";
import { displayNotes } from "@/lib/display-notes";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DEMO_MARKER } from "../../scripts/demo-100m/config";

const MARKER = "[DEMO-100M]";
const ROOT = path.resolve(import.meta.dirname, "../..");

describe("displayNotes — internal markers never reach the UI", () => {
  it("hides the same marker the demo dataset writes", () => {
    expect(DEMO_MARKER).toBe(MARKER);
  });

  it("marker only (with or without whitespace) → null (hide the whole Notes block)", () => {
    expect(displayNotes(MARKER)).toBeNull();
    expect(displayNotes(`  ${MARKER}\n`)).toBeNull();
    expect(displayNotes(`${MARKER} ${MARKER}`)).toBeNull();
  });

  it("user text + marker → only the user text", () => {
    expect(displayNotes(`Call before delivery ${MARKER}`)).toBe("Call before delivery");
    expect(displayNotes(`${MARKER} Call before delivery`)).toBe("Call before delivery");
    expect(displayNotes(`Gate 3 ${MARKER} after 14:00`)).toBe("Gate 3 after 14:00");
    expect(displayNotes(`Line one\n${MARKER}\nLine two`)).toBe("Line one\n\nLine two");
  });

  it("ordinary notes are unchanged; empty / null → null", () => {
    expect(displayNotes("Доставка до 10:00\nТелефон менеджера")).toBe("Доставка до 10:00\nТелефон менеджера");
    expect(displayNotes("[1] note with brackets")).toBe("[1] note with brackets");
    expect(displayNotes(null)).toBeNull();
    expect(displayNotes(undefined)).toBeNull();
    expect(displayNotes("   ")).toBeNull();
  });
});

describe("notes blocks", () => {
  const dictionary = getDictionary("uk");

  it("sales order: marker-only notes render no Примітки block at all", () => {
    expect(OrderDetailNotes({ notes: MARKER, dictionary })).toBeNull();
  });

  it("sales order: user text is shown without the marker", () => {
    const html = renderToStaticMarkup(OrderDetailNotes({ notes: `Під'їзд з двору ${MARKER}`, dictionary })!);
    expect(html).toContain(dictionary.orderDetail.notes.title);
    expect(html).toContain("Під&#x27;їзд з двору");
    expect(html).not.toContain(MARKER);
  });

  it("customer: marker hidden, block hidden when nothing remains", () => {
    expect(CustomerDetailNotes({ notes: MARKER, dictionary })).toBeNull();
    const html = renderToStaticMarkup(CustomerDetailNotes({ notes: `VIP ${MARKER}`, dictionary })!);
    expect(html).toContain("VIP");
    expect(html).not.toContain(MARKER);
  });

  it("supplier: marker-only notes show the empty overview state, never the marker", () => {
    const supplier = {
      id: "s1", code: "SUP-001", name: "Supplier", status: "ACTIVE" as const, legalName: null, taxId: null, country: null,
      contactPerson: null, phone: null, email: null, address: null, notes: MARKER, responsible: null,
    };
    const hidden = renderToStaticMarkup(SupplierDetailOverview({ supplier, dictionary }));
    expect(hidden).not.toContain(MARKER);
    expect(hidden).toContain(dictionary.procurement.supplierDetail.overviewEmpty);
    const shown = renderToStaticMarkup(SupplierDetailOverview({ supplier: { ...supplier, notes: `Terms by email ${MARKER}` }, dictionary }));
    expect(shown).toContain("Terms by email");
    expect(shown).not.toContain(MARKER);
  });

  it("every page / form that renders or pre-fills notes goes through displayNotes", () => {
    for (const file of [
      "app/sales/orders/[id]/page.tsx",
      "app/sales/customers/[id]/page.tsx",
      "app/procurement/orders/[id]/page.tsx",
      "app/procurement/orders/[id]/edit/page.tsx",
      "components/sales/order-form/edit-order-form.tsx",
      "components/procurement/supplier-detail-overview.tsx",
    ]) {
      const code = readFileSync(path.join(ROOT, file), "utf8");
      expect(code, file).toContain("displayNotes(");
      expect(code, file).not.toMatch(/\{(order|customer|supplier)\.notes\}/);
      expect(code, file).not.toMatch(/notes: order\.notes \?\? ""/);
    }
  });
});
