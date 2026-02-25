/**
 * Build a /rec payload in canonical field order with proper defaults.
 *
 * Canonical order: date, uuid, origin, escrow, wallet, accept, period,
 * asset, type, ask, bid, stp, lmt, gtd, partial, public,
 * tao, alpha, price, status
 *
 * Args:
 *   fields: Partial record payload. Missing text fields default to '',
 *           missing numbers default to 0.
 *
 * Returns:
 *   Record with all fields in canonical order, sanitised.
 */
export function buildRecPayload(fields: Record<string, unknown>): Record<string, unknown> {
  const str = (v: unknown): string => (v == null ? "" : String(v));
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const bool = (v: unknown): boolean => !!v;

  return {
    date: str(fields.date),
    uuid: str(fields.uuid),
    origin: str(fields.origin),
    escrow: str(fields.escrow),
    wallet: str(fields.wallet),
    accept: str(fields.accept),
    period: num(fields.period),
    asset: num(fields.asset),
    type: num(fields.type),
    ask: num(fields.ask),
    bid: num(fields.bid),
    stp: num(fields.stp),
    lmt: num(fields.lmt),
    gtd: str(fields.gtd) || "gtc",
    partial: bool(fields.partial),
    public: bool(fields.public),
    tao: num(fields.tao),
    alpha: num(fields.alpha),
    price: num(fields.price),
    status: num(fields.status),
  };
}

/**
 * Fetch the current DB record (or default template) from /dbjson.
 *
 * Args:
 *   apiUrl: Backend API base URL.
 *   escrow: Optional escrow address to fetch an existing record.
 *
 * Returns:
 *   Record with field values from the database, or empty object on failure.
 */
export async function fetchDbRecord(apiUrl: string, escrow?: string): Promise<Record<string, unknown>> {
  try {
    const qs = escrow ? `?escrow=${encodeURIComponent(escrow)}` : "";
    const response = await fetch(`${apiUrl}/dbjson${qs}`);
    if (!response.ok) return {};
    let data = await response.json();
    if (typeof data === "string") data = JSON.parse(data);
    if (Array.isArray(data) && data.length > 0) return data[0] as Record<string, unknown>;
    if (typeof data === "object" && data !== null && !Array.isArray(data)) return data as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

export async function postJson(url: string, body: unknown): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((error: Error) => {
    if (error.message === "Failed to fetch") {
      throw new Error(
        "Cannot connect to server. This may be due to network issues or the server being unavailable"
      );
    }
    throw error;
  });
  return response;
}

/**
 * Extract a human-readable error message from a non-ok Response.
 */
export async function extractResponseError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type");
  let errorText: string;
  if (contentType && contentType.includes("application/json")) {
    try {
      const errorData = await response.json();
      errorText = typeof errorData === "string" ? errorData : JSON.stringify(errorData);
    } catch {
      errorText = await response.text();
    }
  } else {
    errorText = await response.text();
  }
  return `Error (${response.status}): ${errorText || response.statusText}`;
}

/**
 * Read the response body as JSON (with fallback to text).
 */
export async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }
  return await response.text();
}

export function parseRecResponse(
  responseText: string
): { message: string; tao: number; alpha: number; price: number; status?: number } | null {
  try {
    const trimmed = responseText.trim();
    if (!trimmed.startsWith("[")) return null;
    const jsonStr = trimmed.replace(/'/g, '"');
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length >= 4) {
      const status = parsed.length >= 5 ? Number(parsed[4]) : undefined;
      return {
        message: String(parsed[0] || ""),
        tao: Number(parsed[1]) || 0,
        alpha: Number(parsed[2]) || 0,
        price: Number(parsed[3]) || 0,
        ...(Number.isInteger(status) ? { status } : {}),
      };
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}
