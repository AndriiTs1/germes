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
 * Only three read-only Dilovod operations are exposed: listMetadata,
 * getMetadata and request (direct queries only). There is deliberately no
 * public generic call(action, params) — a write action cannot be reached
 * through this module.
 */

const API_VERSION = "0.25";
const REQUEST_TIMEOUT_MS = 20_000;

/** The only actions this module can ever send. Read-only by construction. */
type ReadOnlyAction = "listMetadata" | "getMetadata" | "request";

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

/** Bounds for read-only request queries (PoC discovery, not bulk export). */
export const REQUEST_MAX_LIMIT = 50;
export const REQUEST_MAX_OFFSET = 10_000;
export const REQUEST_MAX_FIELDS = 20;
export const REQUEST_MAX_FILTERS = 5;
const REQUEST_MAX_FILTER_VALUE_LENGTH = 200;
const REQUEST_MAX_LIST_VALUES = 20;

/** Field paths: up to three dot-separated identifiers, e.g. "id", "parent.code". */
const FIELD_PATH_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*){0,2}$/;
const ALIAS_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
/** Field paths/aliases that look like credentials are never requested. */
const SENSITIVE_NAME = /key|token|password|secret|authorization/i;

/**
 * Comparison operators from the official request documentation. The
 * hierarchy operators (IH, !IH, ILH, !ILH, IPL) are not needed for discovery
 * and are deliberately not allowed yet.
 */
export const REQUEST_OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "%", "!%", "IL"] as const;
export type RequestOperator = (typeof REQUEST_OPERATORS)[number];

type FilterScalar = string | number | boolean;

export type RequestFilter = {
  /** Must be one of the aliases defined in `fields` (official contract). */
  alias: string;
  operator: RequestOperator;
  /** A scalar, or a list of scalars for the IL operator. */
  value: FilterScalar | FilterScalar[];
};

export type RequestQuery = {
  /** A single metadata object, e.g. "catalogs.firms" (direct query only). */
  objectName: string;
  /** dataPath → alias, as in the official `fields` parameter. */
  fields: Record<string, string>;
  filters?: RequestFilter[];
  /** 1..REQUEST_MAX_LIMIT */
  limit: number;
  /** 0..REQUEST_MAX_OFFSET */
  offset?: number;
};

export type RequestResult = {
  /** Rows reduced to the requested aliases only. */
  rows: Record<string, unknown>[];
  /** Number of rows returned by Dilovod before bounding. */
  receivedRows: number;
  /** True when Dilovod returned more rows than `limit` (extra rows dropped). */
  truncated: boolean;
  /** Number of row keys that were not requested aliases (dropped, never shown). */
  droppedKeys: number;
};

function invalid(note: string): never {
  throw new DilovodPocError("INVALID_ARGUMENT", "request", undefined, note);
}

function isFilterScalar(value: unknown): value is FilterScalar {
  if (typeof value === "string") return value.length <= REQUEST_MAX_FILTER_VALUE_LENGTH;
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "boolean";
}

/** Validates and normalizes a query. Throws INVALID_ARGUMENT before any request is sent. */
function validateRequestQuery(query: RequestQuery): RequestQuery {
  if (!OBJECT_NAME_PATTERN.test(query.objectName)) invalid("objectName must look like <type>.<name>");

  const fieldEntries = Object.entries(query.fields ?? {});
  if (fieldEntries.length === 0) invalid("at least one field is required");
  if (fieldEntries.length > REQUEST_MAX_FIELDS) invalid(`at most ${REQUEST_MAX_FIELDS} fields`);

  const aliases = new Set<string>();
  for (const [path, alias] of fieldEntries) {
    if (!FIELD_PATH_PATTERN.test(path)) invalid("field path must be identifiers separated by dots (max 3 parts)");
    if (!ALIAS_PATTERN.test(alias)) invalid("alias must be an identifier (max 40 characters)");
    if (SENSITIVE_NAME.test(path) || SENSITIVE_NAME.test(alias)) invalid("credential-like field names are not allowed");
    if (aliases.has(alias)) invalid("aliases must be unique");
    aliases.add(alias);
  }

  const filters = query.filters ?? [];
  if (filters.length > REQUEST_MAX_FILTERS) invalid(`at most ${REQUEST_MAX_FILTERS} filters`);
  for (const filter of filters) {
    if (!aliases.has(filter.alias)) invalid("filter alias must be one of the requested field aliases");
    if (!(REQUEST_OPERATORS as readonly string[]).includes(filter.operator)) invalid("unsupported filter operator");
    if (filter.operator === "IL") {
      if (!Array.isArray(filter.value) || filter.value.length === 0 || filter.value.length > REQUEST_MAX_LIST_VALUES) {
        invalid(`IL needs a list of 1..${REQUEST_MAX_LIST_VALUES} values`);
      }
      if (!filter.value.every(isFilterScalar)) invalid("invalid IL value");
    } else if (Array.isArray(filter.value) || !isFilterScalar(filter.value)) {
      invalid("invalid filter value");
    }
  }

  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > REQUEST_MAX_LIMIT) {
    invalid(`limit must be an integer 1..${REQUEST_MAX_LIMIT}`);
  }
  const offset = query.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > REQUEST_MAX_OFFSET) {
    invalid(`offset must be an integer 0..${REQUEST_MAX_OFFSET}`);
  }

  return { ...query, filters, offset };
}

/**
 * The response shape is only partly documented: rows keyed by alias (default),
 * or { columns, data } when links are not assembled. Both are accepted; any
 * other shape is UNEXPECTED_SHAPE (structure only, never values).
 */
function toRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    if (!data.every(isPlainObject)) {
      throw new DilovodPocError("UNEXPECTED_SHAPE", "request", undefined, "rows must be objects");
    }
    return data;
  }
  if (isPlainObject(data) && Array.isArray(data.columns) && Array.isArray(data.data)) {
    const columns = data.columns;
    if (!columns.every((column) => typeof column === "string") || !data.data.every(Array.isArray)) {
      throw new DilovodPocError("UNEXPECTED_SHAPE", "request", undefined, "columns/data shape not recognised");
    }
    return (data.data as unknown[][]).map((row) =>
      Object.fromEntries(columns.map((column, index) => [column as string, row[index]])),
    );
  }
  throw new DilovodPocError("UNEXPECTED_SHAPE", "request", undefined, `response: ${describeShape(data)}`);
}

/**
 * request — READ-ONLY direct query of one metadata object (official
 * `request` action, `from` as a plain object name). The action is fixed to
 * "request"; callers only supply a validated, bounded query. Register query
 * types (sliceLast / balance / turnover) are not supported yet.
 *
 * Returned rows contain only the requested aliases and at most `limit` rows.
 */
export async function request(query: RequestQuery): Promise<RequestResult> {
  const action: ReadOnlyAction = "request";
  const valid = validateRequestQuery(query);

  const params: Record<string, unknown> = {
    from: valid.objectName,
    fields: valid.fields,
    limit: valid.offset ? { offset: valid.offset, count: valid.limit } : valid.limit,
  };
  if (valid.filters && valid.filters.length > 0) params.filters = valid.filters;

  const data = await send(action, params);
  const received = toRows(data);
  const allowed = new Set(Object.values(valid.fields));

  let droppedKeys = 0;
  const rows = received.slice(0, valid.limit).map((row) => {
    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (allowed.has(key)) kept[key] = value;
      else droppedKeys += 1;
    }
    return kept;
  });

  return { rows, receivedRows: received.length, truncated: received.length > valid.limit, droppedKeys };
}
