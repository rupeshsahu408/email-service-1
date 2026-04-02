# Sendora

A privacy-first, Proton Mail-inspired email web application built with Next.js 15.

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 (via `@import "tailwindcss"`)
- **Database**: Replit PostgreSQL via Drizzle ORM
- **Email sending**: Resend API
- **CAPTCHA**: Cloudflare Turnstile (bypassed in development)
- **Rate limiting**: Upstash Redis
- **Font**: Geist Sans / Geist Mono
- **Dev server**: Port 5000, host 0.0.0.0

## Key Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page (hero, features, pricing, CTA, footer) |
| `/login` | Sign-in page |
| `/signup` | 4-step registration wizard |
| `/inbox` | Full 3-pane email client |
| `/settings` | User settings (appearance, inbox, compose, security, etc.) |
| `/upgrade` | Business plan upgrade page (8 sections, Razorpay checkout) |

## Design System

**Color palette (Proton Mail-inspired):**
- Sidebar: `#1c1b33` (always dark, regardless of theme)
- Accent: `#6d4aff` (purple)
- Background: `#f3f0fd` (light lavender)
- Foreground: `#1c1b33`
- Muted: `#65637e`
- Border: `#e8e4f8`
- Card: `#ffffff`

CSS variables defined in `src/app/globals.css`. Dark mode toggled via `html.dark` class.

## Key Components

- `src/components/inbox-client.tsx` — Main email UI: dark sidebar, message list, thread detail, floating compose panel
- `src/components/landing.tsx` — Proton-inspired landing page with hero, features grid, security section, pricing, CTA, footer
- `src/components/login-form.tsx` — Centered login card with show/hide password
- `src/components/signup-wizard.tsx` — 4-step signup: username → captcha → password → recovery key
- `src/components/settings-client.tsx` — Full settings panel (10 sections)
- `src/components/theme-provider.tsx` — Applies theme + accent color from settings API on navigation

## API Routes

All under `src/app/api/`:
- `auth/login`, `auth/logout`, `auth/signup`, `auth/username` — Authentication
- `mail/messages` — List + PATCH + DELETE messages
- `mail/messages/[id]` — Single message detail
- `mail/thread/[tid]` — Thread view
- `mail/send` — Send email (JSON or multipart)
- `mail/drafts` — GET/PUT draft
- `mail/labels` — GET/POST labels
- `mail/attachments/[id]` — Download attachment
- `settings` — GET/PATCH user settings (includes billing info)
- `resend/webhook` — Inbound mail webhook
- `razorpay/create-subscription` — Create Razorpay subscription
- `razorpay/verify` — Verify payment and upgrade plan
- `razorpay/cancel-subscription` — Cancel active subscription (cancel_at_cycle_end)
- `razorpay/webhook` — Handle Razorpay events (activated, charged, payment.failed, cancelled, halted)

## Database Schema

Tables: `users`, `messages`, `messageLabelMap`, `labels`, `composeDrafts`, `attachments`, `userSettings`, `userSessions`

Message folders: `inbox | sent | trash | archive`

User billing fields: `plan` (free|business), `planStatus` (free|active|past_due|cancelled), `planExpiresAt`, `razorpayOrderId`, `razorpaySubscriptionId`

## Environment Secrets

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Replit PostgreSQL (managed) |
| `RESEND_API_KEY` | Outbound email via Resend |
| `RESEND_WEBHOOK_SECRET` | Inbound mail webhook |
| `EMAIL_DOMAIN` | Server-side email domain |
| `NEXT_PUBLIC_EMAIL_DOMAIN` | Client-side domain display |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server secret |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile widget site key |
| `UPSTASH_REDIS_REST_URL` | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting auth |
| `RAZORPAY_KEY_ID` | Razorpay API key ID (server) |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret (server) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay key for frontend checkout |
| `RAZORPAY_PLAN_AMOUNT` | Plan amount in paise (default: 49900 = ₹499) |
| `NEXT_PUBLIC_RAZORPAY_PLAN_DISPLAY_PRICE` | Display price e.g. "₹499" |

## Development Notes

- **Turnstile**: In `NODE_ENV=development`, site key is set to `""` so the widget is hidden; server validates `"dev-skip"` token automatically.
- **Upstash URL fix**: `src/lib/rate-limit.ts` strips leading/trailing quotes from env vars.
- **HMR**: `next.config.ts` sets `allowedDevOrigins` for Replit's proxied preview.
- **Draft auto-save**: Compose form auto-saves every 900ms via `PUT /api/mail/drafts`.
- **Inbox sidebar**: Always dark (`#1c1b33`), hardcoded — not affected by light/dark theme toggle.
- **Migrations**: Run `npm run db:migrate` after pulling updates that add new tables/columns. This repo also has a startup DB bootstrap in `src/instrumentation.ts`, but it may not cover every Drizzle migration.
