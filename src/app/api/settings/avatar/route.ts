import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const raw = form.get("avatar");
  if (!(raw instanceof File)) {
    return NextResponse.json({ error: "Avatar file is required" }, { status: 400 });
  }
  if (!raw.type.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "Please upload an image file" }, { status: 400 });
  }
  if (raw.size <= 0 || raw.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Avatar must be smaller than 2 MB" }, { status: 400 });
  }
  const buf = Buffer.from(await raw.arrayBuffer());
  const dataUrl = `data:${raw.type};base64,${buf.toString("base64")}`;
  await getDb()
    .update(users)
    .set({ avatarUrl: dataUrl })
    .where(eq(users.id, user.id));
  return NextResponse.json({ ok: true, avatarUrl: dataUrl });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await getDb()
    .update(users)
    .set({ avatarUrl: null })
    .where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
