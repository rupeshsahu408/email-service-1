import { notFound } from "next/navigation";
import { createHash } from "crypto";
import { getDb } from "@/db";
import { confidentialMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ConfidentialViewerClient } from "@/components/confidential-viewer-client";

export const dynamic = "force-dynamic";

export default async function ConfidentialViewerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const rows = await getDb()
    .select()
    .from(confidentialMessages)
    .where(eq(confidentialMessages.tokenHash, tokenHash))
    .limit(1);
  const msg = rows[0];
  if (!msg) notFound();

  // eslint-disable-next-line react-hooks/purity -- server-rendered, per-request expiry check
  if (new Date(msg.expiresAt).getTime() <= Date.now()) {
    notFound();
  }

  if (msg.passcodeMode === "none") {
    return (
      <main className="min-h-screen bg-[#f3f0fd] flex items-center justify-center p-6">
        <div className="w-full max-w-3xl bg-white rounded-2xl border border-[#e8e4f8] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-[#f0edfb]">
            <div className="text-xs font-semibold text-[#9896b4]">Sendora · Confidential</div>
            <h1 className="text-lg font-semibold text-[#1c1b33] mt-1">
              {msg.subject || "Confidential message"}
            </h1>
            <div className="text-xs text-[#9896b4] mt-1">
              Expires {new Date(msg.expiresAt).toISOString().slice(0, 10)}
            </div>
          </div>
          <div className="px-6 py-6">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: msg.bodyHtml || `<pre>${msg.bodyText}</pre>` }}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <ConfidentialViewerClient
      token={token}
      subject={msg.subject || "Confidential message"}
      expiresAt={new Date(msg.expiresAt).toISOString()}
      passcodeMode={msg.passcodeMode}
    />
  );
}

