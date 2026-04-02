import type {
  AutomationActionJson,
  AutomationConditionJson,
  MessageFolder,
} from "@/db/schema";

const FOLDERS: MessageFolder[] = [
  "inbox",
  "sent",
  "spam",
  "trash",
  "archive",
];

export function parseAutomationConditions(
  raw: unknown
): AutomationConditionJson[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: AutomationConditionJson[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const o = x as Record<string, unknown>;
    const kind = o.kind;
    if (kind === "sender_unknown" || kind === "important_contact") {
      out.push({ kind });
      continue;
    }
    if (kind === "from") {
      const op = o.op;
      const value = typeof o.value === "string" ? o.value.trim() : "";
      if (op !== "equals" && op !== "contains" && op !== "domain") return null;
      if (!value || value.length > 320) return null;
      out.push({ kind: "from", op, value });
      continue;
    }
    if (kind === "subject") {
      const value = typeof o.value === "string" ? o.value.trim() : "";
      if (!value || value.length > 500) return null;
      out.push({ kind: "subject", op: "contains", value });
      continue;
    }
    if (kind === "body") {
      const value = typeof o.value === "string" ? o.value.trim() : "";
      if (!value || value.length > 500) return null;
      out.push({ kind: "body", op: "contains", value });
      continue;
    }
    return null;
  }
  return out;
}

export function parseAutomationActions(raw: unknown): AutomationActionJson[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: AutomationActionJson[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const o = x as Record<string, unknown>;
    const type = o.type;
    if (type === "move_folder") {
      const folder = o.folder;
      if (typeof folder !== "string" || !FOLDERS.includes(folder as MessageFolder))
        return null;
      out.push({ type: "move_folder", folder: folder as MessageFolder });
      continue;
    }
    if (type === "apply_label") {
      const labelId = typeof o.labelId === "string" ? o.labelId : "";
      if (!/^[0-9a-f-]{36}$/i.test(labelId)) return null;
      out.push({ type: "apply_label", labelId });
      continue;
    }
    if (type === "mark_spam") {
      out.push({ type: "mark_spam" });
      continue;
    }
    if (type === "set_priority") {
      const p = o.priority;
      if (p !== "high" && p !== "normal" && p !== "low") return null;
      out.push({ type: "set_priority", priority: p });
      continue;
    }
    if (type === "forward") {
      const rawTo = o.to;
      const to = typeof rawTo === "string" ? rawTo.trim() : "";
      if (!to.includes("@") || to.length > 320) return null;
      out.push({ type: "forward", to });
      continue;
    }
    if (type === "mark_read") {
      out.push({ type: "mark_read", read: Boolean(o.read) });
      continue;
    }
    if (type === "star") {
      out.push({ type: "star", starred: Boolean(o.starred) });
      continue;
    }
    return null;
  }
  return out;
}
