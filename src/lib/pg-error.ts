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

/** Best-effort debug string for logs (no PII beyond what the driver already put in the message). */
export function formatPostgresErrorForLog(err: unknown): string {
  const blob = collectPgErrorBlob(err);
  return blob.length > 1200 ? `${blob.slice(0, 1200)}…` : blob;
}
