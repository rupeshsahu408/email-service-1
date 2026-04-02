import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

import {
  ensurePasskeyTables,
  getRpIdFromRequest,
  setPasskeyChallengeCookie,
} from "@/lib/passkeys";

export async function POST(request: NextRequest) {
  await ensurePasskeyTables();

  const rpID = process.env.WEBAUTHN_RP_ID?.trim() || getRpIdFromRequest(request);

  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: "preferred",
    // allowCredentials intentionally omitted to enable discoverable credentials (passkeys).
  });

  await setPasskeyChallengeCookie({
    type: "authentication",
    challenge: options.challenge,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  return NextResponse.json({ ok: true, options });
}

