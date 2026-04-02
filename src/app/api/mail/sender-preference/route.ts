import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import {
  removeSenderMailPreferenceForFrom,
  upsertSenderMailPreference,
} from "@/lib/sender-mail-preference";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  fromAddr: z.string().min(3).max(512),
  preference: z.enum(["trust", "spam"]),
});

/** Set future delivery preference for a sender (pattern = primary email). */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    await upsertSenderMailPreference({
      userId: user.id,
      fromAddr: parsed.data.fromAddr,
      preference: parsed.data.preference,
    });
  } catch {
    return NextResponse.json({ error: "Could not save preference" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({
  fromAddr: z.string().min(3).max(512),
});

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const raw = sp.get("fromAddr") ?? "";
  const parsed = deleteSchema.safeParse({ fromAddr: raw });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fromAddr" }, { status: 400 });
  }
  await removeSenderMailPreferenceForFrom(user.id, parsed.data.fromAddr);
  return NextResponse.json({ ok: true });
}
