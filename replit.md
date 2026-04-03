# Sendora — Privacy-First Email Platform

## Overview

Sendora is a full-featured Email Service Provider (ESP) and personal/business email management system built with Next.js. It provides custom domain management, temporary inboxes, AI-powered assistance, and subscription-based billing.

## Architecture

- **Framework**: Next.js 15+ (React 19) with App Router
- **Database**: PostgreSQL (Replit built-in) via Drizzle ORM
- **Email Delivery**: Resend API
- **AI**: Google Gemini (gemini-2.5-flash-lite)
- **Payments**: Razorpay
- **Auth**: Custom session-based auth with Argon2 and WebAuthn/Passkey support
- **Rate Limiting**: Upstash Redis + Ratelimit
- **Bot Protection**: Cloudflare Turnstile
- **Storage**: Cloudinary (attachments)
- **UI**: Tailwind CSS 4, Lucide React, Tiptap rich-text editor

## Project Structure

```
src/
  app/           - Next.js App Router pages and API routes
    (root)/      - Landing page, login, signup, inbox UI
    admin/       - Admin dashboard
    api/         - API route handlers
  components/    - React components (UI, admin, compose editor)
  db/            - Drizzle ORM schema and DB client
    schema.ts    - Source of truth for all DB tables
    index.ts     - DB connection singleton (getDb())
  lib/           - Business logic and third-party integrations
scripts/         - DB maintenance scripts
drizzle/         - SQL migration files
```

## Key Files

- `src/db/schema.ts` — All database table definitions
- `src/instrumentation.ts` — Startup DB schema bootstrap (auto-runs on start)
- `src/lib/postgres-connection.ts` — Postgres connection options (handles local/cloud SSL)
- `src/lib/resend-mail.ts` — Email delivery via Resend
- `src/lib/gemini-json-client.ts` — Gemini AI integration
- `src/lib/session.ts` — Session management with Replit-aware cookie security
- `src/lib/app-url.ts` — App base URL resolution (supports Replit dev domain)

## Running the App

- **Dev**: `npm run dev` (port 5000)
- **DB migrations**: Auto-runs on startup via `src/instrumentation.ts`
- **Manual DB tools**: `npm run db:push`, `npm run db:migrate`, `npm run db:studio`
- **Seed admin**: `npm run db:seed-admin`

## Environment Variables / Secrets

### Required (set as Replit Secrets)
- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` — Secret for session signing
- `RESEND_API_KEY` — Resend email delivery API key
- `GEMINI_API_KEY` — Google Gemini AI API key
- `RAZORPAY_KEY_ID` — Razorpay payment key ID
- `RAZORPAY_KEY_SECRET` — Razorpay payment secret
- `CLOUDINARY_*` — Cloudinary credentials for attachment storage
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Rate limiting
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile bot protection

### Optional
- `NEXT_PUBLIC_APP_URL` — Override the public app URL for email links
- `RAZORPAY_PLAN_ID` — Pre-set Razorpay plan ID (already configured as env var)
- `SKIP_STARTUP_DB_BOOTSTRAP=1` — Skip DB auto-migration on startup

## Replit-Specific Notes

- The Replit PostgreSQL host is `helium` (local, no SSL required)
- `src/lib/postgres-connection.ts` has been updated to recognize `helium` as a local host
- `src/lib/app-url.ts` uses `REPLIT_DEV_DOMAIN` for public URL resolution
- `src/lib/session.ts` detects `REPLIT_DEV_DOMAIN` to set secure cookies in dev mode
- `next.config.ts` uses `REPLIT_DEV_DOMAIN` for `allowedDevOrigins`
