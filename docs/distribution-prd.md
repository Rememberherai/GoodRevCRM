# PRD: GoodRev CRM Distribution Package

**Status:** Draft
**Date:** 2026-03-16
**Author:** Evan

---

## Problem Statement

GoodRev CRM is a full-featured multi-tenant B2B CRM built on Next.js 16, Supabase, and React 19. It includes AI-powered research, email sequences, VoIP calling, automations, and more. Currently it operates as a personal production CRM with hardcoded secrets, personal data, and client-specific code embedded throughout the codebase and git history.

The goal is to create a clean, fork-ready version that anyone could clone, deploy to their own Vercel instance, and self-host — either as a paid one-time download or a free open-source release. A key differentiator is an AI-followable setup guide that makes onboarding frictionless.

---

## Product Vision

A self-hosted, AI-powered CRM that ships as a single git package. Clone it, configure your environment, deploy, and you're running your own CRM with:

- Organization & contact management
- Opportunity pipeline tracking
- Email sequences with Gmail integration
- AI research on companies and contacts via OpenRouter
- Workflow automations with 40+ trigger types
- Optional VoIP calling, SMS, data enrichment, and news monitoring

---

## Scope

### What Ships in the Distribution

**Core Features (always included):**
- Organizations, Contacts/People, Opportunities, RFPs
- Email sequences (Gmail API)
- AI research (OpenRouter)
- Automations engine (triggers, conditions, actions)
- Notes, Tasks, Activity tracking
- Global search
- User management with role-based project memberships
- Custom fields and schema management per project

**Optional Integrations (gracefully degrade when not configured):**
- Telnyx VoIP calling & SMS
- FullEnrich data enrichment
- NewsAPI organization monitoring
- Contact providers (Apollo, Hunter, LeadMagic, Prospeo)

### What Gets Excluded

- `scripts/municipal/` — personal scripts with hardcoded project IDs and client names
- `data/source-data/` — region-specific seed CSVs
- `.claude/`, `.ralph/` — personal AI assistant configurations containing secrets
- Municipal-specific documentation
- All git history (orphan branch approach to prevent secret leakage)

---

## Technical Plan

### Phase 1: Remove Secrets & Personal Data

| Item | File(s) | Action |
|------|---------|--------|
| Supabase connection strings | `CLAUDE.md` (3 instances) | Replace with `$DATABASE_URL` placeholder |
| AI assistant configs | `.claude/`, `.ralph/` | Add to `.gitignore`, `git rm --cached` |
| Chris auto-add trigger | `supabase/migrations/0053_*` | New migration to drop trigger & function |
| Hardcoded project IDs | `lib/municipal-scanner/config.ts` | Require `SCANNER_PROJECT_ID` env var |
| Client slug checks | `organizations-page-client.tsx` lines ~235, ~464 | Generalize or remove "lillianah" conditionals |
| Personal scripts | `scripts/municipal/` | Exclude from distribution |
| Client references in docs | `docs/office365-integration-plan.md` | Remove "Lillianah" references |

### Phase 2: Configurable Branding

Create `lib/config.ts` as a single source of truth:

```ts
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'CRM';

export const features = {
  telnyx: !!process.env.TELNYX_API_KEY,
  gmail: !!process.env.GOOGLE_CLIENT_ID,
  fullenrich: !!process.env.FULLENRICH_API_KEY,
  openrouter: !!process.env.OPENROUTER_API_KEY,
};
```

Replace hardcoded "GoodRev CRM" in ~8 files:
- `app/layout.tsx` — metadata title
- `app/(auth)/login/page.tsx` — login page branding
- `app/(dashboard)/projects/projects-page-client.tsx`
- `app/(dashboard)/settings/page.tsx`
- `components/layout/project-header.tsx`
- `lib/openrouter/client.ts` — siteName in API requests
- `app/api/gmail/test/route.ts` — test email subject
- `app/api/projects/[slug]/calls/[id]/recording/route.ts`

Additional:
- Update `supabase/config.toml` project_id to generic name
- Update `package.json` name field
- Add `NEXT_PUBLIC_APP_NAME` to `.env.example` and `lib/env.ts`

### Phase 3: Feature Flags for Optional Integrations

Most integrations already degrade when API keys are missing. Formalize this:
- Centralize feature detection in `lib/config.ts`
- Hide UI elements when their integration isn't configured
- Clean up ~14 municipal-specific npm scripts from `package.json`

### Phase 4: Clean Distribution Branch

Use an orphan branch to guarantee no secrets leak through git history:

1. Complete Phases 1-3
2. `git checkout --orphan distribution`
3. Stage all cleaned files, excluding personal data/scripts/configs
4. Single "Initial release" commit
5. This becomes the public repository's `main`

The personal `main` branch stays untouched for continued private use.

### Phase 5: AI-Followable SETUP.md

Create a comprehensive setup guide structured so both humans and AI assistants can follow it:

1. **Prerequisites** — Node 20+, Supabase account, Vercel account, Google Cloud project
2. **Quick Start** (5-min path) — clone, configure .env, install, migrate, run
3. **Supabase Setup** — create project, enable Google OAuth, copy API keys
4. **Google Cloud Setup** — enable Gmail API, create OAuth credentials, configure consent screen, set redirect URIs
5. **Optional Integrations** — step-by-step for OpenRouter, Telnyx, FullEnrich
6. **Deploy to Vercel** — connect repo, set env vars, configure cron jobs
7. **Post-Deploy** — first login, create project, invite team, connect Gmail
8. **Troubleshooting** — prepared statement errors, OAuth redirects, missing env vars

### Phase 6: Polish

- **README.md** — feature overview, tech stack, screenshots, quick start link
- **LICENSE** — MIT (or chosen license)
- **Rewrite CLAUDE.md** for forks — keep migration patterns and automation guidance, remove all personal connection strings

---

## Execution Order

| Phase | Depends On | Parallelizable With |
|-------|-----------|---------------------|
| 1 (secrets removal) | — | Phase 2 |
| 2 (branding) | — | Phase 1 |
| 3 (feature flags) | Phase 1 | — |
| 4 (clean branch) | Phases 1-3 | — |
| 5 (SETUP.md) | Draft early, finalize after Phase 4 | Phases 1-3 |
| 6 (polish) | Phase 4 | — |

---

## Verification Checklist

- [ ] `grep -r` for Supabase connection strings, API keys, "Lillianah", "evanc", personal UUIDs — zero hits on distribution branch
- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] Fresh clone + `.env.example` setup + migrations work end-to-end
- [ ] App loads at localhost:3000 with configurable brand name on login page
- [ ] No personal data visible in any committed file
- [ ] Optional integrations gracefully hidden when env vars are absent

---

## Tech Stack (for reference)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, TypeScript, Tailwind CSS, Radix UI |
| State | TanStack Query, Zustand |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth + Google OAuth |
| AI | OpenRouter (Claude, GPT-4, Gemini, Llama) |
| Email | Gmail API |
| Calling | Telnyx VoIP |
| Editor | Tiptap (WYSIWYG) |
| Charts | Recharts |
| Hosting | Vercel |

---

## Open Questions

1. **License choice** — MIT (permissive) vs AGPL (copyleft, requires open-sourcing modifications)?
2. **Municipal scanner** — Include as optional module or strip entirely from distribution?
3. **Pricing model** — Free open-source, paid one-time download, or dual-license?
