import { NextResponse } from "next/server";
import { formatUserEmail } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: formatUserEmail(user.localPart),
      localPart: user.localPart,
      avatarUrl: user.avatarUrl ?? null,
    },
  });
}
