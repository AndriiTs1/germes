import { Prisma, SupplierAgreementStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  supplierAgreementTermsSchema,
  type SupplierAgreementTermsInput,
} from "@/lib/validation/supplier-agreement";

const AGREEMENT_NUMBER_UNIQUE_INDEX = "supplier_agreements_supplierId_agreementNumber_key";
const AGREEMENT_NUMBER_FIELDS = ["supplierId", "agreementNumber"];
const SUPPLIER_AGREEMENTS_TABLE = "supplier_agreements";

export type CreateSupplierAgreementError = "SUPPLIER_NOT_FOUND" | "DUPLICATE_AGREEMENT_NUMBER" | "CREATE_FAILED";

export type CreateSupplierAgreementResult =
  | { ok: true; agreementId: string }
  | { ok: false; error: CreateSupplierAgreementError };

class SupplierNotFoundError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Postgres reports key columns quoted when their names are mixed-case ("agreementNumber"). */
function unquoteIdentifier(value: string): string {
  return value.trim().replace(/^"(.*)"$/, "$1");
}

/**
 * Prisma 7 + @prisma/adapter-pg shape (same as createPurchaseOrder): the
 * adapter's constraint is { index } or, without a name, { fields }. Only
 * the exact (supplierId, agreementNumber) unique index counts.
 */
function isAgreementNumberConstraint(constraint: unknown): boolean {
  if (!isRecord(constraint)) return false;
  if (constraint.index === AGREEMENT_NUMBER_UNIQUE_INDEX) return true;

  const fields = constraint.fields;
  return (
    Array.isArray(fields) &&
    fields.length === AGREEMENT_NUMBER_FIELDS.length &&
    fields.every((field, index) => typeof field === "string" && unquoteIdentifier(field) === AGREEMENT_NUMBER_FIELDS[index])
  );
}

/**
 * True only for a P2002 confidently attributed to the agreement-number
 * unique index — never "any P2002". meta.target is a narrow fallback for
 * other runtimes.
 */
function isAgreementNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const meta: unknown = error.meta;
  if (!isRecord(meta)) return false;

  if (typeof meta.table === "string" && meta.table !== SUPPLIER_AGREEMENTS_TABLE) {
    return false;
  }

  const adapterError = meta.driverAdapterError;
  if (isRecord(adapterError) && isRecord(adapterError.cause)) {
    return isAgreementNumberConstraint(adapterError.cause.constraint);
  }

  const target = meta.target;
  if (typeof target === "string") return target === AGREEMENT_NUMBER_UNIQUE_INDEX;
  return (
    Array.isArray(target) &&
    target.length === AGREEMENT_NUMBER_FIELDS.length &&
    target.every((field, index) => field === AGREEMENT_NUMBER_FIELDS[index])
  );
}

/** "YYYY-MM-DD" (already validated) → UTC midnight, same convention as PurchaseOrder dates. */
function toUtcDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Creates one DRAFT SupplierAgreement (no items, no price tiers) and its
 * AuditLog CREATE entry in a single transaction — if either write fails,
 * neither is kept.
 *
 * Server-owned, never taken from input: supplierId (the caller's route
 * context), status (always DRAFT) and createdById (the authenticated
 * user). The terms are re-validated here with supplierAgreementTermsSchema
 * rather than trusting that a caller did.
 *
 * No supplier-status rule: a DRAFT is a preparatory document; only the
 * supplier's existence is required. No authorization here — the caller
 * must requirePermission("suppliers.update") and pass that user's id.
 *
 * The (supplierId, agreementNumber) unique index is the source of truth
 * for duplicates: a P2002 on exactly that index maps to
 * DUPLICATE_AGREEMENT_NUMBER; every other failure to CREATE_FAILED, with
 * no database detail leaked.
 */
export async function createSupplierAgreement(
  currentUserId: string,
  supplierId: string,
  input: SupplierAgreementTermsInput,
): Promise<CreateSupplierAgreementResult> {
  const parsed = supplierAgreementTermsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "CREATE_FAILED" };
  }
  const terms = parsed.data;

  try {
    const agreementId = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
      if (!supplier) {
        throw new SupplierNotFoundError();
      }

      const agreement = await tx.supplierAgreement.create({
        data: {
          supplierId: supplier.id,
          agreementNumber: terms.agreementNumber,
          status: SupplierAgreementStatus.DRAFT,
          validFrom: toUtcDate(terms.validFrom),
          validTo: terms.validTo === null ? null : toUtcDate(terms.validTo),
          currency: terms.currency,
          prepaymentPercent: terms.prepaymentPercent,
          balanceDueDays: terms.balanceDueDays,
          balanceDueBasis: terms.balanceDueBasis,
          paymentTermsNote: terms.paymentTermsNote,
          incoterm: terms.incoterm,
          incotermVersion: terms.incotermVersion,
          incotermPlace: terms.incotermPlace,
          defaultLeadTimeDays: terms.defaultLeadTimeDays,
          notes: terms.notes,
          createdById: currentUserId,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUserId,
          entityType: "SupplierAgreement",
          entityId: agreement.id,
          action: "CREATE",
          metadata: {
            supplierId: supplier.id,
            agreementNumber: terms.agreementNumber,
            currency: terms.currency,
            validFrom: terms.validFrom,
            validTo: terms.validTo,
          },
        },
      });

      return agreement.id;
    });

    return { ok: true, agreementId };
  } catch (error) {
    if (error instanceof SupplierNotFoundError) return { ok: false, error: "SUPPLIER_NOT_FOUND" };
    if (isAgreementNumberConflict(error)) return { ok: false, error: "DUPLICATE_AGREEMENT_NUMBER" };
    return { ok: false, error: "CREATE_FAILED" };
  }
}
