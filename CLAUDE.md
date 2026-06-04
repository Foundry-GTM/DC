# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Provenance.** This file is derived from three source-of-truth documents that live **outside** this repo:
> - Build plan: `~/Documents/Claude/Projects/Bridge to B/drew-calin-track-b-build-plan.md`
> - Diagnostic prototype: `~/Documents/Claude/Projects/Bridge to B/the-revenue-architect-diagnostic.html`
> - Playbook prototype: `~/Documents/Claude/Projects/Bridge to B/the-revenue-architect-playbook.html`
>
> The build plan references an "Appendix A" (engineering rules) and "Appendix D" (do-not-build) that **do not exist** in the current file. The operating rules and do-not-build list below are reconstructed from the plan's **Decision Log**, **"What Lives in Code vs DB"**, and **MVP scope** sections. If real appendices surface later, reconcile against them.

---

## What this is

**Track B** — a self-serve, Stripe-billed SaaS with two product surfaces in **one Next.js app**, one company (Foundry GTM, a DBA of DC Socal Holdings LLC), deployed at `app.drewcalin.co`:

| Surface | Route | Free tier | Paid | Purpose |
|---|---|---|---|---|
| **10-Pillar Diagnostic** | `/diagnostic` | top-line scorecard | one-time **$99** (AI report + PDF + email) / $299 annual bundle | lead-gen funnel → consulting or upsell |
| **Sales Playbook Builder** | `/playbook` | view public examples | **$99/mo** solo · $299/mo team · $990/yr | the recurring SaaS product |
| **Admin** (Drew only) | `/admin` | — | — | manage all workspaces/diagnostics/playbooks |

Both surfaces share auth, billing, user/workspace model, and theme. **Not a monorepo** — one app, shared everything.

The two HTML prototypes are the **source of truth for v1 content, scoring logic, and UX**. **Port them, do not redesign them.** Keep the HTML files working as Drew's demo asset during the build.

---

## Locked stack (do not re-litigate)

| Layer | Choice |
|---|---|
| Framework | **Next.js 16 App Router** (server actions; `--no-src-dir`, import alias `@/*`) — scaffolded on 16.2.7 |
| Hosting | **Vercel** |
| DB | **Supabase Postgres** (with **RLS**) |
| Auth | **Supabase Auth** — magic link + Google OAuth (no passwords) |
| ORM | **Drizzle** (+ drizzle-kit) — schema-as-code, not Prisma |
| UI | **Tailwind + shadcn/ui** |
| Forms | **react-hook-form + zod** |
| Billing | **Stripe** Subscriptions + Webhooks |
| AI | **Anthropic Claude API** (Sonnet 4.5) via `@anthropic-ai/sdk` |
| PDF | **react-pdf** (`@react-pdf/renderer`) |
| Email | **Resend** + React Email |
| Analytics / Errors | PostHog · Sentry (free tiers) |

---

## Engineering operating rules

These are firm. Treat deviations as needing explicit sign-off.

1. **Methodology lives in code, never in the DB.** Diagnostic questions, scoring weights/logic, the 8-section Playbook structure, and AI prompts are versioned in Git under `/lib`. They are the IP. See the layout below.
2. **The DB holds user data only** — responses, generated reports, playbook content, subscription state, workspace metadata. Never persist questions, weights, or prompts there.
3. **RLS on every table.** A user can read/write only rows in a workspace they're a member of. Admin (Drew, by email allowlist / env var) bypasses the workspace boundary.
4. **AI in exactly three places, not sprinkled.** (a) v1 diagnostic narrative analysis; (b) v2 playbook section drafting; (c) v2 benchmarking. AI prompts carry Drew's operator judgment via few-shot examples — that's the defensibility, so version and keep them evaluable.
5. **Stripe is the source of truth for entitlement.** Webhooks (`checkout.session.completed`, subscription lifecycle) write `subscriptions`; RLS / gates read subscription status to unlock paid report content and Playbook edit mode.
6. **Auto-save everything.** Diagnostic and Playbook editing auto-save via server actions (~30s cadence in the prototype).
7. **Public read-only views are unauthenticated**, accessed by opaque token: report `/r/[token]`, playbook `/p/[token]`.
8. **One app, two surfaces.** Don't split into separate apps/repos or add a monorepo.

---

## Where the methodology goes (`/lib`)

Port from the prototypes into typed config — this is the highest-fidelity work:

- `/lib/diagnostic-config.ts` — the 10-pillar question structure (port from `the-revenue-architect-diagnostic.html`).
- `/lib/playbook-config.ts` — the 8-section structure (port from `the-revenue-architect-playbook.html`).
- `/lib/scoring.ts` — the scoring rubric (see "Scoring model" below).
- AI prompts — versioned prompt modules (few-shot examples included).

---

## Diagnostic — the 10 pillars

Grouped exactly as the prototype's nav:

- **Foundation:** 1 Unit Economics · 2 ICP & Personas · 3 Motion & Methodology
- **Funnel & Pipeline:** 4 Sales Funnel & Stages · 5 Lead Operations · 6 Pipeline & Capacity
- **Team & Accounts:** 7 Team & Segmentation · 8 Account Strategy
- **Execution:** 9 Enablement & Plays · 10 Stack & Operating Rhythm

Each pillar = numeric/qualitative inputs → computed metrics + a flag (`good` / `warn` / `bad`) + a callout. Pillar 1 (Unit Economics) computes blended CAC, ARPC, gross margin/customer, GM payback months, LTV, LTV:CAC from monthly run-rate inputs. (File uploads + "Analyze uploads" exist in the prototype but are a **v2** AI feature — see do-not-build.)

### Scoring model (port faithfully — `buildReport` / `levelToScore` in the prototype)

- Each pillar's `calc_pN()` sets a **level**: `good` / `warn` / `bad` (or unset).
- **level → score:** `good = 9`, `warn = 6`, `bad = 3`, unset = 0.
- **Overall (0–100)** = mean of *filled* pillar scores × 10. Unanswered pillars are excluded from the mean.
- **Gauge color:** ≥70 green (`#2D7D5F`), ≥40 rust (`#B5482A`), else red (`#B23B3B`).
- **Prioritized actions:** take pillars flagged `bad`/`warn`, `bad` first, top 3. Each maps to a consulting-offer CTA (the `ACTIONS` table — title + body + engagement offer per pillar/level).

The full diagnostic report renders this scorecard; **free tier shows top-line scores only**, paid unlocks the Claude-generated narrative + PDF + email.

---

## Playbook — the 8 sections

Source of truth: `the-revenue-architect-playbook.html`. The sections (TOC order):

1. **Our Numbers** — unit economics, pipeline health, conversion, capacity
2. **Who We Sell To** — ICP, personas, triggers, disqualifiers
3. **How We Sell** — motion, methodology (MEDDIC/Challenger), stages + exit criteria, forecast categories
4. **How We Route Leads** — capture, scoring, SLA, distribution
5. **What We Say** — value prop, plays, objections, battlecards
6. **How We Cover the Market** — segmentation, named accounts, account planning, multi-threading
7. **How We Hire** — rubric, interview kit, ramp, comp
8. **How We Operate** — cadence, pipeline review, forecast, win/loss, QBR, metrics

The prototype supports inline `contenteditable` edit mode + download/print. In the real app this becomes section-by-section forms with auto-save; **manual entry in v1, AI-assist in v2.**

---

## Data model (initial Drizzle schema)

```
users            (Supabase Auth)        id, email, created_at
workspaces       (tenant container)     id, name, owner_user_id, created_at, plan (free|diagnostic|playbook|enterprise)
memberships                             id, workspace_id, user_id, role (owner|member)
diagnostics                             id, workspace_id, created_by, status (draft|submitted), data (jsonb), submitted_at
diagnostic_reports                      id, diagnostic_id, generated_at, pillar_scores (jsonb), ai_analysis (text), pdf_url
playbooks                               id, workspace_id, name, status (draft|published), data (jsonb)
playbook_sections                       id, playbook_id, section_key (numbers|icp|motion|...), content (jsonb), updated_at
subscriptions    (Stripe-synced)        id, workspace_id, stripe_subscription_id, plan, status, current_period_end
```

RLS scopes all reads/writes to workspace membership; admin role bypasses.

---

## Do NOT build (v1 scope guard)

Out of scope for v1 — do not implement unless explicitly asked:

- **AI-assisted Playbook generation** (v2) — v1 Playbook is manual entry only.
- **Diagnostic file upload + "Analyze uploads"** (v2) — the prototype's upload zones are a preview; don't wire real analysis in v1.
- **Team / multi-user workspaces & invitations & roles beyond owner/member** (v2).
- **Benchmarking against peer cohort** (v2 — needs 50+ submitted diagnostics first).
- **Email drip sequences** beyond basic transactional (onboarding sequences are v2).
- **White-label / branded client PDFs** (v2).
- **HubSpot / Salesforce or any CRM integration, "live" auto-refreshing diagnostics, public methodology directory, native mobile, public API, SSO** (v3+).
- **Do not put methodology in the DB. Do not add AI outside the three sanctioned surfaces. Do not split into multiple apps/repos.**

---

## Brand system (port to the Tailwind/shadcn theme)

DC Brand System v1 — **INK on PAPER, INDIGO primary action, RUST for warnings.**

| Token | Hex | Use |
|---|---|---|
| INK | `#0B0B12` | primary foreground / text |
| INK soft | `#1B1B24` | dark gradients |
| PAPER | `#F4EFE6` | primary background |
| Surface | `#FFFFFF` | cards |
| INDIGO | `#3B3DBF` | primary action / accent (`accent-soft #E5E5F7`) |
| RUST | `#B5482A` | warnings, "wax" callouts (`warn-soft #F7E5DD`) |
| MUTED | `#6B6760` | secondary text / rules |
| Border | `#DCD6CB` | warm rule on paper |
| Good | `#2D7D5F` | positive flag |
| Bad | `#B23B3B` | negative flag |

- **Body type:** Inter (system stack `-apple-system, Inter, …`), 15px / 1.5.
- **Wordmark / brand type:** Helvetica Neue, 600, uppercase, letter-spacing ~0.18em.
- **Radius** ~10px; soft layered shadow `0 1px 2px rgba(11,11,18,.04), 0 8px 24px rgba(11,11,18,.06)`.
- **DC seal:** SVG — two concentric circles (r=47 stroke 2.4, r=42 stroke 0.9) + "DC" in Helvetica Neue 700, in `currentColor`. Reuse as logo + favicon.

---

## Common commands

> The app has not been scaffolded yet — this repo currently holds only `README.md`. First scaffold (from the build plan):

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"

npm install @supabase/supabase-js @supabase/ssr drizzle-orm postgres
npm install -D drizzle-kit @types/node
npm install stripe @stripe/stripe-js zod react-hook-form @hookform/resolvers
npm install resend react-email @react-pdf/renderer posthog-js posthog-node @anthropic-ai/sdk
npx shadcn@latest init
npx shadcn@latest add button card form input label textarea dialog dropdown-menu select tabs toast tooltip
```

Once scaffolded, the standard loop is:

```bash
npm run dev            # local dev (Next.js)
npm run build          # production build
npm run lint           # eslint
npx drizzle-kit generate   # create migration from schema
npx drizzle-kit migrate    # apply migrations to Supabase
vercel --prod          # deploy
```

Update this section with the real scripts/test runner once they exist in `package.json`.
