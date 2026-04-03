import { and, asc, count, eq, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  automationWorkflows,
  emailAutomationRules,
  importantContacts,
  messageLabels,
  messages,
  labels,
  users,
  type AutomationActionJson,
  type AutomationConditionJson,
  type MessageFolder,
} from "@/db/schema";
import { extractEmailAddress } from "@/lib/email-message";
import { logError, logInfo } from "@/lib/logger";
import { matchesSenderPattern } from "@/lib/mail-filter";
import { resolveSendFromForUser } from "@/lib/mail-from";
import { isResendConfigured, sendOutboundMail } from "@/lib/resend-mail";
import { TtlCache } from "@/lib/ttl-cache";

const rulesCache = new TtlCache<string, Awaited<ReturnType<typeof fetchRulesUncached>>>(
  60_000
);
const wfCache = new TtlCache<string, Awaited<ReturnType<typeof fetchWorkflowsUncached>>>(
  60_000
);

export function invalidateAutomationCache(userId: string): void {
  rulesCache.delete(userId);
  wfCache.delete(userId);
}

async function fetchRulesUncached(userId: string) {
  return getDb()
    .select()
    .from(emailAutomationRules)
    .where(
      and(
        eq(emailAutomationRules.userId, userId),
        eq(emailAutomationRules.enabled, true)
      )
    )
    .orderBy(asc(emailAutomationRules.sortOrder), asc(emailAutomationRules.createdAt));
}

async function fetchWorkflowsUncached(userId: string) {
  return getDb()
    .select()
    .from(automationWorkflows)
    .where(
      and(
        eq(automationWorkflows.userId, userId),
        eq(automationWorkflows.enabled, true)
      )
    )
    .orderBy(asc(automationWorkflows.createdAt));
}

async function getRules(userId: string) {
  const hit = rulesCache.get(userId);
  if (hit) return hit;
  const rows = await fetchRulesUncached(userId);
  rulesCache.set(userId, rows);
  return rows;
}

async function getWorkflows(userId: string) {
  const hit = wfCache.get(userId);
  if (hit) return hit;
  const rows = await fetchWorkflowsUncached(userId);
  wfCache.set(userId, rows);
  return rows;
}

async function loadImportantPatterns(userId: string): Promise<string[]> {
  return getDb()
    .select({ pattern: importantContacts.pattern })
    .from(importantContacts)
    .where(eq(importantContacts.userId, userId))
    .then((r) => r.map((x) => x.pattern));
}

async function isSenderUnknownForUser(params: {
  userId: string;
  messageId: string;
  fromAddr: string;
}): Promise<boolean> {
  const norm = extractEmailAddress(params.fromAddr);
  if (!norm.includes("@")) return false;
  const likeBracket = `%<${norm}%`;
  const [row] = await getDb()
    .select({ c: count() })
    .from(messages)
    .where(
      and(
        eq(messages.userId, params.userId),
        ne(messages.id, params.messageId),
        or(
          sql`lower(${messages.fromAddr}) = ${norm}`,
          sql`${messages.fromAddr} ilike ${likeBracket}`
        )
      )
    );
  return Number(row?.c ?? 0) === 0;
}

function subjectLower(subject: string): string {
  return subject.trim().toLowerCase();
}

function bodyLower(bodyText: string, bodyHtml?: string | null): string {
  const t = (bodyText || "").toLowerCase();
  if (!bodyHtml) return t;
  return `${t} ${bodyHtml.replace(/<[^>]+>/g, " ").toLowerCase()}`;
}

function evalCondition(
  c: AutomationConditionJson,
  ctx: {
    fromAddr: string;
    subject: string;
    bodyBlob: string;
    importantPatterns: string[];
    senderUnknown: boolean;
  }
): boolean {
  switch (c.kind) {
    case "from": {
      const v = c.value.trim().toLowerCase();
      if (!v) return false;
      if (c.op === "equals") {
        return extractEmailAddress(ctx.fromAddr) === v;
      }
      if (c.op === "contains") {
        return ctx.fromAddr.toLowerCase().includes(v);
      }
      if (c.op === "domain") {
        const dom = v.startsWith("@") ? v.slice(1) : v;
        return extractEmailAddress(ctx.fromAddr).endsWith(`@${dom}`);
      }
      return false;
    }
    case "subject":
      return (
        c.value.trim().length > 0 &&
        subjectLower(ctx.subject).includes(c.value.trim().toLowerCase())
      );
    case "body":
      return (
        c.value.trim().length > 0 &&
        ctx.bodyBlob.includes(c.value.trim().toLowerCase())
      );
    case "sender_unknown":
      return ctx.senderUnknown;
    case "important_contact":
      return ctx.importantPatterns.some((p) =>
        matchesSenderPattern(ctx.fromAddr, p)
      );
    default:
      return false;
  }
}

function conditionsMatch(
  list: AutomationConditionJson[],
  ctx: {
    fromAddr: string;
    subject: string;
    bodyBlob: string;
    importantPatterns: string[];
    senderUnknown: boolean;
  }
): boolean {
  if (!list.length) return false;
  return list.every((c) => evalCondition(c, ctx));
}

async function ensureLabelOwned(userId: string, labelId: string): Promise<boolean> {
  const [r] = await getDb()
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.userId, userId)))
    .limit(1);
  return Boolean(r);
}

async function applyActions(params: {
  ownerUserId: string;
  messageId: string;
  actions: AutomationActionJson[];
}): Promise<void> {
  const db = getDb();
  const updates: Partial<typeof messages.$inferInsert> = {};
  const labelIds: string[] = [];
  let forwardTo: string | null = null;
  let forwardSubject = "";
  let forwardText = "";
  let forwardHtml: string | undefined;

  const [msgRow] = await db
    .select({
      folder: messages.folder,
      subject: messages.subject,
      bodyText: messages.bodyText,
      bodyHtml: messages.bodyHtml,
      fromAddr: messages.fromAddr,
    })
    .from(messages)
    .where(
      and(eq(messages.id, params.messageId), eq(messages.userId, params.ownerUserId))
    )
    .limit(1);
  if (!msgRow) return;

  for (const a of params.actions) {
    switch (a.type) {
      case "move_folder":
        updates.folder = a.folder as MessageFolder;
        if (a.folder === "spam") {
          updates.spamScore = 10;
        }
        break;
      case "mark_spam":
        updates.folder = "spam";
        updates.spamScore = 10;
        break;
      case "apply_label":
        if (await ensureLabelOwned(params.ownerUserId, a.labelId)) {
          labelIds.push(a.labelId);
        }
        break;
      case "set_priority":
        updates.priority = a.priority;
        break;
      case "forward":
        forwardTo = a.to.trim();
        forwardSubject = msgRow.subject;
        forwardText = msgRow.bodyText;
        forwardHtml = msgRow.bodyHtml ?? undefined;
        break;
      case "mark_read":
        if (a.read) updates.readAt = new Date();
        else updates.readAt = null;
        break;
      case "star":
        updates.starred = a.starred;
        break;
      default:
        break;
    }
  }

  if (Object.keys(updates).length > 0) {
    try {
      await db
        .update(messages)
        .set(updates)
        .where(
          and(eq(messages.id, params.messageId), eq(messages.userId, params.ownerUserId))
        );
    } catch (e) {
      logError("automation_message_update_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (labelIds.length > 0) {
    try {
      await db.insert(messageLabels).values(
        labelIds.map((labelId) => ({ messageId: params.messageId, labelId }))
      );
    } catch {
      /* ignore dup */
    }
  }

  if (forwardTo && isResendConfigured()) {
    try {
      const [userRow] = await db
        .select()
        .from(users)
        .where(eq(users.id, params.ownerUserId))
        .limit(1);
      if (!userRow) return;
      const fromResolved = await resolveSendFromForUser({
        user: userRow,
        mailboxId: null,
      });
      await sendOutboundMail({
        from: fromResolved.from,
        replyTo: fromResolved.replyTo,
        to: forwardTo,
        subject: `Fwd: ${forwardSubject}`.slice(0, 998),
        text: forwardText,
        html: forwardHtml,
      });
      logInfo("automation_forward_sent", {
        userId: params.ownerUserId,
        messageId: params.messageId,
      });
    } catch (e) {
      logError("automation_forward_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

/**
 * Run user-defined rules and workflows after an inbound message is stored.
 * Safe to call forever: failures are logged and swallowed.
 */
export async function runInboundAutomation(params: {
  ownerUserId: string;
  messageId: string;
  fromAddr: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
}): Promise<void> {
  try {
    const importantPatterns = await loadImportantPatterns(params.ownerUserId);
    const senderUnknown = await isSenderUnknownForUser({
      userId: params.ownerUserId,
      messageId: params.messageId,
      fromAddr: params.fromAddr,
    });
    const bodyBlob = bodyLower(params.bodyText, params.bodyHtml);
    const ctx = {
      fromAddr: params.fromAddr,
      subject: params.subject,
      bodyBlob,
      importantPatterns,
      senderUnknown,
    };

    const rules = await getRules(params.ownerUserId);
    for (const r of rules) {
      const conds = r.conditions as AutomationConditionJson[];
      const acts = r.actions as AutomationActionJson[];
      if (!conditionsMatch(conds, ctx)) continue;
      await applyActions({
        ownerUserId: params.ownerUserId,
        messageId: params.messageId,
        actions: acts,
      });
    }

    const workflows = await getWorkflows(params.ownerUserId);
    for (const w of workflows) {
      const conds = w.triggerConditions as AutomationConditionJson[];
      const steps = w.steps as AutomationActionJson[];
      if (!conditionsMatch(conds, ctx)) continue;
      await applyActions({
        ownerUserId: params.ownerUserId,
        messageId: params.messageId,
        actions: steps,
      });
    }
  } catch (e) {
    logError("run_inbound_automation_failed", {
      message: e instanceof Error ? e.message : String(e),
      userId: params.ownerUserId,
      messageId: params.messageId,
    });
  }
}
