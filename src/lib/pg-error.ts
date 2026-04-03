/**
 * Collect text from wrapped Postgres / Drizzle errors for pattern matching.
 */
function collectPgErrorBlob(err: unknown): string {
  const chunks: string[] = [];
  const seen = new Set<unknown>();

  function visit(cur: unknown, depth: number): void {
    if (cur == null || depth > 14 || seen.has(cur)) return;
    seen.add(cur);

    if (typeof cur === "string") {
      chunks.push(cur);
      return;
    }
    if (typeof cur === "object") {
      const o = cur as Record<string, unknown>;
      if (o.message != null) chunks.push(String(o.message));
      if (o.code != null) chunks.push(String(o.code));
      if (o.detail != null) chunks.push(String(o.detail));
      if (o.constraint != null) chunks.push(String(o.constraint));

      const nested: unknown[] = [];
      if (cur instanceof Error && cur.cause != null) nested.push(cur.cause);
      if (o.cause != null) nested.push(o.cause);
      if (o.originalError != null) nested.push(o.originalError);
      if (o.error != null) nested.push(o.error);

      for (const n of nested) visit(n, depth + 1);
    }
  }

  visit(err, 0);
  return chunks.join(" ");
}

/**
 * Detect PostgreSQL "undefined column" (42703) errors even when drivers / Drizzle
 * wrap the original `PostgresError` behind `cause`, `originalError`, etc.
 */
export function isPostgresUndefinedColumnError(err: unknown): boolean {
  const blob = collectPgErrorBlob(err);
  return (
    /\b42703\b/.test(blob) ||
    /undefined column/i.test(blob) ||
    /column .* does not exist/i.test(blob)
  );
}

/** Unique violation (duplicate key). */
export function isPostgresUniqueViolation(err: unknown): boolean {
  const blob = collectPgErrorBlob(err);
  return (
    /\b23505\b/.test(blob) ||
    /duplicate key/i.test(blob) ||
    /unique constraint/i.test(blob)
  );
}

/** ON CONFLICT has no matching unique index / constraint (often SQLSTATE 42P10). */
export function isPostgresOnConflictTargetError(err: unknown): boolean {
  const blob = collectPgErrorBlob(err);
  return (
    /\b42P10\b/.test(blob) ||
    /no unique or exclusion constraint matching the ON CONFLICT/i.test(blob)
  );
}

/** Foreign key violation (e.g. user_id not in users). */
export function isPostgresForeignKeyViolation(err: unknown): boolean {
  const blob = collectPgErrorBlob(err);
  return (
    /\b23503\b/.test(blob) ||
    /violates foreign key constraint/i.test(blob)
  );
}

/**
 * Prefer driver/Postgres fields (code, detail) — Drizzle's outer message is huge and
 * was hiding the real failure when logs were truncated.
 */
export function formatPostgresErrorForLog(err: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();

  function walk(cur: unknown, depth: number): void {
    if (cur == null || depth > 14 || seen.has(cur)) return;
    seen.add(cur);

    if (typeof cur === "object") {
      const o = cur as Record<string, unknown>;
      const code = o.code;
      if (typeof code === "string" && code.length > 0) {
        parts.push(`pg_code=${code}`);
      }
      for (const k of ["detail", "constraint", "schema", "table", "column", "routine"]) {
        const v = o[k];
        if (v != null && String(v).length > 0) {
          parts.push(`${k}=${String(v).slice(0, 400)}`);
        }
      }
      const msg = o.message != null ? String(o.message) : "";
      if (msg && !/^Failed query:/i.test(msg) && !msg.includes("params:")) {
        parts.push(`message=${msg.slice(0, 500)}`);
      }
    }

    if (cur instanceof Error && cur.cause != null) walk(cur.cause, depth + 1);
    if (typeof cur === "object" && cur != null) {
      const o = cur as Record<string, unknown>;
      for (const k of ["cause", "originalError", "error"]) {
        const n = o[k];
        if (n != null) walk(n, depth + 1);
      }
    }
  }

  walk(err, 0);

  const summary = parts.filter(Boolean).join(" | ");
  if (summary.length > 0) return summary.length > 1500 ? `${summary.slice(0, 1500)}…` : summary;

  const blob = collectPgErrorBlob(err);
  return blob.length > 1200 ? `${blob.slice(0, 1200)}…` : blob;
}
