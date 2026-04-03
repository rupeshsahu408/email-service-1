import { logError, logWarn } from "./logger";

const DEV_BYPASS_DEFAULT = "dev-skip";

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (process.env.NODE_ENV === "development") {
    const bypass =
      process.env.TURNSTILE_DEV_BYPASS_TOKEN?.trim() || DEV_BYPASS_DEFAULT;
    if (token === bypass) {
      logWarn("turnstile_dev_bypass_ok");
      return true;
    }
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    logWarn("turnstile_secret_not_configured", {
      hint: "TURNSTILE_SECRET_KEY is not set. Turnstile verification is skipped.",
    });
    return true;
  }

  if (token === DEV_BYPASS_DEFAULT) {
    logWarn("turnstile_bypass_token_in_production");
    return false;
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    logError("turnstile_verify_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return false;
  }
}
