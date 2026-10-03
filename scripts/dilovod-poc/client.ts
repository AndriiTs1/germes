/**
 * Dilovod PoC A — minimal READ-ONLY client. NOT runtime integration code.
 *
 * Used only by scripts/dilovod-poc/run.ts (operator CLI). Never import this
 * module from app/, components/ or lib/: it must never be bundled into the
 * Next.js application.
 *
 * Request format (official Dilovod API docs): POST to DILOVOD_API_URL,
 * application/x-www-form-urlencoded, one form field `packet` holding JSON
 * { version, key, action, params }. The API key travels inside the packet,
 * so the packet is never logged, returned or included in any error.
 *
 * Only two read-only Dilovod operations are exposed: listMetadata and
 * getMetadata. There is deliberately no public generic call(action, params) —
 * a write action cannot be reached through this module.
 */

const API_VERSION = "0.25";
const REQUEST_TIMEOUT_MS = 20_000;

/** The only actions this module can ever send. Read-only by construction. */
type ReadOnlyAction = "listMetadata" | "getMetadata";

export type DilovodPocErrorKind =
  | "CONFIG"
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP_STATUS"
  | "INVALID_JSON"
  | "PROVIDER_ERROR"
  | "UNEXPECTED_SHAPE"
  | "CONCURRENT_CALL"
  | "INVALID_ARGUMENT";

/**
 * Safe error: carries only the action, a category, an optional HTTP status
 * and an optional structural note built by this module (never the packet,
 * the key, the URL or any response body).
 */
export class DilovodPocError extends Error {
  constructor(
    readonly kind: DilovodPocErrorKind,
    readonly action: ReadOnlyAction,
    readonly httpStatus?: number,
    readonly note?: string,
  ) {
    super(
      `${action}: ${kind}` +
        (httpStatus !== undefined ? ` (HTTP ${httpStatus})` : "") +
        (note ? ` — ${note}` : ""),
    );
    this.name = "DilovodPocError";
  }
}

export type MetadataEntry = {
  name: string;
  presentation: string | null;
};

/** Dilovod prohibits multi-threaded API access: one request at a time. */
let requestInFlight = false;

function readConfig(action: ReadOnlyAction): { url: string; key: string } {
  const url = process.env.DILOVOD_API_URL;
  const key = process.env.DILOVOD_API_KEY;

  if (!url || !key) {
    throw new DilovodPocError("CONFIG", action, undefined, "DILOVOD_API_URL and DILOVOD_API_KEY are required");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DilovodPocError("CONFIG", action, undefined, "DILOVOD_API_URL is not a valid URL");
  }

  // The key is sent in the request body — never over plain HTTP.
  if (parsed.protocol !== "https:") {
    throw new DilovodPocError("CONFIG", action, undefined, "DILOVOD_API_URL must use https");
  }

  return { url: parsed.toString(), key };
}

/** Structural description only (type + up to 10 key names), never values. */
function describeShape(value: unknown): string {
  if (Array.isArray(value)) return `array(length ${value.length})`;
  if (value === null) return "null";
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return `object(keys: ${keys.slice(0, 10).join(", ")}${keys.length > 10 ? ", …" : ""})`;
  }
  return typeof value;
}

/** Private transport. Not exported: callers cannot choose the action. */
async function send(action: ReadOnlyAction, params: Record<string, unknown>): Promise<unknown> {
  if (requestInFlight) {
    throw new DilovodPocError("CONCURRENT_CALL", action, undefined, "only one Dilovod request at a time");
  }

  const { url, key } = readConfig(action);
  const body = new URLSearchParams({
    packet: JSON.stringify({ version: API_VERSION, key, action, params }),
  });

  requestInFlight = true;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "error",
    });
  } catch (error) {
    // Never forward the original error: its message/cause may include the URL.
    const isTimeout = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new DilovodPocError(isTimeout ? "TIMEOUT" : "NETWORK", action);
  } finally {
    requestInFlight = false;
  }

  if (!response.ok) {
    throw new DilovodPocError("HTTP_STATUS", action, response.status);
  }

  let data: unknown;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new DilovodPocError("INVALID_JSON", action, response.status);
  }

  // The error response format is not documented. An object with an `error`
  // key is treated as a provider error; its content is not exposed yet.
  if (data !== null && typeof data === "object" && !Array.isArray(data) && "error" in data) {
    throw new DilovodPocError("PROVIDER_ERROR", action, response.status, "response contains an `error` field (content not shown)");
  }

  return data;
}

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * listMetadata — the list of metadata objects available to this API node.
 * Documented response shape: an object keyed by metadata object name,
 *   { "catalogs.goods": { id, idPrefix, presentation }, ... }
 * Only the key (object name) and `presentation` are used; id/idPrefix are
 * neither required nor exposed. Anything else is reported as
 * UNEXPECTED_SHAPE with a structural note only (never values).
 */
export async function listMetadata(lang: "uk" | "ru" | "en" = "uk"): Promise<MetadataEntry[]> {
  const action: ReadOnlyAction = "listMetadata";
  const data = await send(action, { lang });

  if (!isPlainObject(data)) {
    throw new DilovodPocError("UNEXPECTED_SHAPE", action, undefined, `response: ${describeShape(data)}`);
  }

  const entries: MetadataEntry[] = [];
  for (const [name, value] of Object.entries(data)) {
    if (!isPlainObject(value)) {
      throw new DilovodPocError("UNEXPECTED_SHAPE", action, undefined, `entry value: ${describeShape(value)}`);
    }
    entries.push({ name, presentation: asString(value.presentation) });
  }

  return entries;
}

/**
 * Metadata object names as returned by listMetadata, e.g. "catalogs.goods",
 * "documents.sale", "informationRegisters.propValues": a type prefix, one dot,
 * an identifier. Anything else is rejected before any request is sent.
 */
const OBJECT_NAME_PATTERN = /^[A-Za-z]+\.[A-Za-z][A-Za-z0-9_]*$/;

/**
 * getMetadata — the metadata definition of one object. The response
 * structure is not documented, so it is not modelled yet: the plain JSON
 * object is returned as-is for structural inspection by the PoC CLI. A
 * non-object response is reported as UNEXPECTED_SHAPE (structure only).
 */
export async function getMetadata(
  objectName: string,
  lang: "uk" | "ru" | "en" = "uk",
): Promise<Record<string, unknown>> {
  const action: ReadOnlyAction = "getMetadata";

  if (!OBJECT_NAME_PATTERN.test(objectName)) {
    throw new DilovodPocError("INVALID_ARGUMENT", action, undefined, "objectName must look like <type>.<name>");
  }

  const data = await send(action, { objectName, lang });

  if (!isPlainObject(data)) {
    throw new DilovodPocError("UNEXPECTED_SHAPE", action, undefined, `response: ${describeShape(data)}`);
  }

  return data;
}
