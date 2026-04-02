import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains } from "@/db/schema";
import {
  adminDisableDomainSending,
  adminEnableDomainSending,
  adminSuspendDomain,
  adminUnsuspendDomain,
} from "@/lib/admin-domain-mutations";
import { recordDomainActivity } from "@/lib/domain-activity";
import { verifyDomainTxtRecord } from "@/lib/domain-dns";
import { runDomainDnsPipeline } from "@/lib/domain-state";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { adminBulkDomainsBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminBulkDomainsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { action, domainIds } = parsed.data;
  const db = getDb();
  const results: { domainId: string; ok: boolean; error?: string }[] = [];

  for (const domainId of domainIds) {
    try {
      if (action === "suspend") {
        await adminSuspendDomain({
          domainId,
          actorUserId: admin.id,
          reason:
            parsed.data.action === "suspend"
              ? parsed.data.reason
              : undefined,
        });
        results.push({ domainId, ok: true });
        continue;
      }
      if (action === "unsuspend") {
        await adminUnsuspendDomain({ domainId, actorUserId: admin.id });
        results.push({ domainId, ok: true });
        continue;
      }
      if (action === "disable_sending") {
        await adminDisableDomainSending({
          domainId,
          actorUserId: admin.id,
          reason:
            parsed.data.action === "disable_sending"
              ? parsed.data.reason
              : undefined,
        });
        results.push({ domainId, ok: true });
        continue;
      }
      if (action === "enable_sending") {
        await adminEnableDomainSending({ domainId, actorUserId: admin.id });
        results.push({ domainId, ok: true });
        continue;
      }

      const row = await db
        .select()
        .from(domains)
        .where(eq(domains.id, domainId))
        .limit(1);
      if (row.length === 0) {
        results.push({ domainId, ok: false, error: "Not found" });
        continue;
      }

      if (action === "verify_dns") {
        const d = row[0]!;
        const now = new Date();
        await db
          .update(domains)
          .set({
            verificationStatus: "verifying",
            lastCheckAt: now,
            updatedAt: now,
          })
          .where(eq(domains.id, domainId));
        const vr = await verifyDomainTxtRecord(d.domainName, d.verificationToken);
        if (vr.ok) {
          await db
            .update(domains)
            .set({
              verificationStatus: "verified",
              verifiedAt: now,
              failureReason: null,
              updatedAt: now,
            })
            .where(eq(domains.id, domainId));
        } else {
          await db
            .update(domains)
            .set({
              verificationStatus: "failed",
              failureReason: vr.reason ?? "failed",
              updatedAt: now,
            })
            .where(eq(domains.id, domainId));
        }
        await runDomainDnsPipeline(domainId, {
          actorUserId: admin.id,
          actorType: "admin",
        });
        results.push({
          domainId,
          ok: vr.ok,
          ...(vr.ok ? {} : { error: vr.reason }),
        });
        continue;
      }

      if (action === "recheck_dns") {
        await recordDomainActivity({
          domainId,
          eventType: "dns_recheck",
          actorType: "admin",
          actorUserId: admin.id,
          detail: "Bulk DNS recheck",
        });
        await runDomainDnsPipeline(domainId, {
          actorUserId: admin.id,
          actorType: "admin",
        });
        results.push({ domainId, ok: true });
      }
    } catch (e) {
      results.push({
        domainId,
        ok: false,
        error: e instanceof Error ? e.message : "Error",
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    processed: results.length,
    succeeded: okCount,
    failed: results.length - okCount,
    results,
  });
}
