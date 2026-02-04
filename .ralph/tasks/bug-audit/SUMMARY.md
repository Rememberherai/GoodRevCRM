# GoodRevCRM Security & Bug Audit — Executive Summary

> **Audit Period**: 2026-02-03 to 2026-02-04
> **Scope**: Full codebase (~85,500 lines of TypeScript, 46 SQL migrations, ~100 API routes)
> **Methodology**: Manual code review of all application code, organized into 35 audit tasks
> **Auditor**: Ralph autonomous audit agent

---

## 1. Finding Totals

### By Severity

| Severity | Count | % of Total |
|----------|-------|------------|
| CRITICAL | 4 | 1.1% |
| HIGH | 64 | 17.1% |
| MEDIUM | 174 | 46.4% |
| LOW | 125 | 33.3% |
| INFO | 8 | 2.1% |
| **TOTAL** | **375** | **100%** |

### By Category

| Category | Count | % of Total |
|----------|-------|------------|
| VALIDATION | 95 | 25.3% |
| AUTH | 89 | 23.7% |
| BUSINESS_LOGIC | 70 | 18.7% |
| INFO_DISCLOSURE | 51 | 13.6% |
| INJECTION | 28 | 7.5% |
| INFRASTRUCTURE | 20 | 5.3% |
| RLS | 8 | 2.1% |
| RACE_CONDITION | 7 | 1.9% |
| EXTERNAL | 6 | 1.6% |

### By Audit Area

| Task | Area | Findings |
|------|------|----------|
| 1 | Auth Middleware | 5 |
| 2 | Supabase Client Factories | 6 |
| 3 | Tracking Endpoints | 6 |
| 4 | Cron Endpoint | 6 |
| 5 | Automation Engine | 7 |
| 6 | Automation Actions | 12 |
| 7 | Automation Conditions | 5 |
| 8 | Time-based Triggers | 7 |
| 9 | Automation API Routes | 8 |
| 10 | FullEnrich Webhook | 9 |
| 11 | Gmail Webhook | 7 |
| 12 | Gmail Service | 12 |
| 13 | Gmail OAuth | 7 |
| 14 | Gmail Connection Routes | 10 |
| 15 | Gmail Sync Routes | 10 |
| 16 | Sequence Processor | 13 |
| 17 | People API | 8 |
| 18 | Organizations API | 13 |
| 19 | Opportunities API | 11 |
| 20 | RFP API | 16 |
| 21 | Tasks API | 7 |
| 22 | Email Send/Inbox | 11 |
| 23 | Sequences API | 12 |
| 24 | Email Threads | 5 |
| 25 | Bulk Operations API | 9 |
| 26 | Import/Export | 12 |
| 27 | Webhooks API | 10 |
| 28 | Content Library | 11 |
| 29 | Meetings API | 9 |
| 30 | Notes/Activity/Tags/Search | 13 |
| 31 | Settings/Schema/Members | 22 |
| 32 | Projects/Notifications/User | 13 |
| 33 | Validators (Zod schemas) | 21 |
| 34 | External Integrations | 18 |
| 35 | Database RLS/Migrations/RPC | 23 |

---

## 2. Top 10 Most Critical Findings

### #1 — [CRITICAL] Finding 4.1: CRON_SECRET is optional — endpoint fully public when unset
- **File**: `app/api/cron/process-sequences/route.ts`
- **Impact**: When `CRON_SECRET` is not set (the default), the cron endpoint is completely unauthenticated. Any internet user can trigger sequence email processing and time-based automation evaluation, causing real email sends, task creation, and automation events — all with admin-level database access. This is the single most dangerous finding in the audit.

### #2 — [CRITICAL] Finding 10.1: FullEnrich webhook signature verification bypassed when secret is unset
- **File**: `app/api/webhooks/fullenrich/route.ts`
- **Impact**: `verifySignature()` returns `true` if `FULLENRICH_WEBHOOK_SECRET` is not configured. Attackers can submit fabricated enrichment payloads that overwrite CRM contact data (phone numbers, emails, social profiles, company info) via admin client, with no authentication required.

### #3 — [CRITICAL] Finding 11.1: Gmail webhook accepts forged push notifications — no Pub/Sub verification
- **File**: `app/api/gmail/webhook/route.ts`
- **Impact**: The Gmail push notification endpoint performs no verification (no OIDC token, no bearer token, no IP allowlist). Any attacker can forge push notifications to trigger email syncs for arbitrary users, consuming API quota and potentially causing data processing issues.

### #4 — [CRITICAL] Finding 35.1: Notifications INSERT policy — any user can send notifications to any other user
- **File**: `supabase/migrations/0034_notifications.sql`
- **Impact**: The RLS `WITH CHECK (true)` policy on notifications INSERT allows any authenticated user to create notifications for any other user, including crafted `action_url` fields that could redirect victims to phishing sites.

### #5 — [HIGH] Finding 35.18: Hardcoded user UUID grants permanent backdoor access to all projects
- **File**: `supabase/migrations/0053_add_chris_to_all_projects.sql`
- **Impact**: A database trigger automatically adds a hardcoded user as a member to every current and future project. If this account is compromised, the attacker gains access to ALL CRM data across ALL tenants. This is effectively a persistent backdoor in the database schema.

### #6 — [HIGH] Finding 35.5: SECURITY DEFINER bulk operation functions lack all authorization
- **File**: `supabase/migrations/0028_bulk_operations.sql`
- **Impact**: All 9 bulk operation RPC functions (bulk_update_people, bulk_delete_people, bulk_assign_tags, etc.) are `SECURITY DEFINER` with no authorization checks. Any authenticated user can bulk-update or delete records in ANY project by supplying an arbitrary `project_id`, completely bypassing RLS.

### #7 — [HIGH] Finding 35.7: SECURITY DEFINER reporting functions expose cross-tenant data
- **File**: `supabase/migrations/0032_reporting.sql`
- **Impact**: Five reporting functions (pipeline values, revenue, team emails, conversion metrics) are `SECURITY DEFINER` with no project membership verification. Any authenticated user can query sensitive business data for any project.

### #8 — [HIGH] Finding 6.1: Automation `executeUpdateField` allows arbitrary column writes
- **File**: `lib/automations/actions.ts`
- **Impact**: The protected fields denylist (`id`, `project_id`, `created_at`) is incomplete. Automation actions can target `deleted_at`, `owner_id`, `email`, and other sensitive columns, enabling privilege escalation or data corruption via crafted automation configurations.

### #9 — [HIGH] Finding 6.3: SSRF protection in webhook action is bypassable
- **File**: `lib/automations/actions.ts`
- **Impact**: Webhook URL validation only blocks basic IPv4 patterns. Attackers can bypass via IPv6 loopback (`[::1]`), DNS rebinding, octal IP notation (`0177.0.0.1`), or `0.0.0.0`, enabling SSRF to internal services including the cloud metadata endpoint.

### #10 — [HIGH] Finding 34.12: Gmail contact matcher queries across all projects
- **File**: `lib/gmail/contact-matcher.ts`
- **Impact**: The contact matching function queries the `people` table without any `project_id` filter using an admin client. It can match and associate emails with contacts from any project in the system, breaking multi-tenant data isolation.

---

## 3. Systemic Patterns Observed

### Pattern 1: Fail-Open Security Checks
Multiple security controls default to allowing access when their configuration is missing:
- `CRON_SECRET` optional → cron endpoint public (Finding 4.1)
- `FULLENRICH_WEBHOOK_SECRET` optional → webhook signature bypass (Finding 10.1)
- Gmail webhook has no verification mechanism at all (Finding 11.1)

**Root cause**: Security secrets treated as optional configuration rather than required infrastructure.

### Pattern 2: Admin Client Sprawl
12+ files define their own `createAdminClient()` functions with inconsistent error handling, bypassing the centralized factory. Every admin client call bypasses RLS entirely. Many of these usages could use user-scoped clients instead.

**Files affected**: `lib/automations/engine.ts`, `lib/automations/actions.ts`, `lib/automations/time-triggers.ts`, `lib/gmail/service.ts`, `lib/sequences/processor.ts`, `lib/sequences/variables.ts`, `app/api/track/click/route.ts`, `app/api/track/open/route.ts`, `app/api/webhooks/fullenrich/route.ts`, `app/api/gmail/webhook/route.ts`, `app/api/gmail/sync/toggle/route.ts`, `app/api/gmail/sync/trigger/route.ts`

### Pattern 3: PostgREST Filter Injection via Search Parameter
Approximately 15+ API routes interpolate user-controlled `search` parameters directly into `.or()` PostgREST filter strings:
```typescript
query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
```
This pattern allows an attacker to inject additional filter operators or access columns not intended to be searchable.

**Affected routes**: People, Organizations, Opportunities, RFPs, Tasks, Meetings, Notes, Tags, Content Library, Email Templates, Sequences, Webhooks, Members, and more.

### Pattern 4: Column Enumeration via Unvalidated `sortBy`
Approximately 15+ API routes pass user-controlled `sortBy` directly to Supabase `.order()`:
```typescript
query = query.order(sortBy, { ascending });
```
This allows attackers to enumerate database column names and sort by sensitive columns not exposed in the API response.

**Affected routes**: Same routes as Pattern 3.

### Pattern 5: Cross-Project Reference Injection
Many entity creation/update routes accept foreign key IDs (`organization_id`, `primary_contact_id`, `person_id`, etc.) without verifying the referenced entity belongs to the same project. An attacker can link entities across project boundaries.

**Affected entities**: Opportunities (org + contact refs), Meetings (attendee refs), Sequences (enrollment refs), People (org refs), Tags (cross-project assignment).

### Pattern 6: Stored XSS via Unsanitized HTML
HTML content is stored without sanitization across multiple entity types:
- Sequence step `body_html` (Finding 23.5)
- Email `body_html` in activity log (Finding 22.5)
- RFP `answer_html` (Finding 20.12)
- Note `content_html` (Finding 30.1)
- Content library entries (Finding 28.1)
- Template variable substitution `{{first_name}}` (Finding 16.1)
- SVG uploads in logo (Finding 31.14)

### Pattern 7: SECURITY DEFINER Functions Without Authorization
Multiple PostgreSQL functions are declared `SECURITY DEFINER` (runs as the function owner, bypassing RLS) but perform no authorization checks internally:
- 9 bulk operation functions (Finding 35.5)
- `log_activity` (Finding 35.6)
- 5 reporting functions (Finding 35.7)
- 4 analytics functions (Finding 35.8)
- `get_webhooks_for_event` leaks secrets (Finding 35.9)

### Pattern 8: Missing Input Validation on GET Endpoints
While POST/PATCH routes generally use Zod validators, GET routes with query parameters (`page`, `limit`, `search`, `sortBy`, `filter`) almost universally lack validation. No `limit` values are bounded (memory exhaustion), `page` can be 0 or negative, and sort/filter params are unvalidated.

### Pattern 9: `select('*')` Over-Selection
Many routes use `.select('*')` or broad column selections that include unnecessary fields. This pattern risks exposing sensitive data (tokens, secrets, internal IDs) if new columns are added to tables in the future.

### Pattern 10: Global Mutable State in Serverless
The automation engine uses module-level mutable variables (`currentChainDepth`, `recentExecutions` Map, `setInterval` for cleanup) that persist across warm serverless invocations. This causes race conditions, memory leaks, and incorrect behavior under concurrency.

---

## 4. Prioritized Remediation Recommendations

### Priority 1: CRITICAL — Immediate Action Required

| # | Action | Findings | Effort |
|---|--------|----------|--------|
| 1 | **Make CRON_SECRET required** — invert auth check to fail-closed: `if (!cronSecret \|\| authHeader !== ...)` | 4.1 | Small |
| 2 | **Make FULLENRICH_WEBHOOK_SECRET required** — same fail-closed pattern | 10.1 | Small |
| 3 | **Add Google Pub/Sub OIDC verification to Gmail webhook** — validate bearer token from Google | 11.1 | Medium |
| 4 | **Fix notifications RLS INSERT policy** — replace `WITH CHECK (true)` with `WITH CHECK (user_id = auth.uid())` | 35.1 | Small |
| 5 | **Remove hardcoded user trigger** — drop the trigger from migration 0053 and remove existing memberships | 35.18 | Small |

### Priority 2: HIGH — Address Within 1 Sprint

| # | Action | Findings | Effort |
|---|--------|----------|--------|
| 6 | **Add authorization to SECURITY DEFINER functions** — check project membership inside each function | 35.5, 35.6, 35.7, 35.8, 35.9 | Medium |
| 7 | **Fix email_template_versions and emails RLS policies** — restrict to project members | 35.2, 35.3 | Small |
| 8 | **Parameterize search queries** — stop interpolating `search` into `.or()` strings; use parameterized PostgREST filters | 17.1, 18.1, 19.1, + ~12 more | Large |
| 9 | **Allowlist sortBy columns** — validate `sortBy` against an explicit allowlist per route | 17.2, 18.2, 19.2, + ~12 more | Medium |
| 10 | **Add cross-project reference validation** — verify FK IDs belong to the same project before insert/update | 17.4, 19.4, 19.5, 20.3, 29.1 | Medium |
| 11 | **HTML-escape template variables** — escape `{{variable}}` values before substitution in email HTML | 16.1 | Small |
| 12 | **Sanitize stored HTML** — use DOMPurify or similar for `body_html`, `content_html`, `answer_html` before storage | 20.12, 22.5, 23.5, 28.1, 30.1 | Medium |
| 13 | **Consolidate admin client factories** — remove all local `createAdminClient` definitions, import from `lib/supabase/admin.ts` | 2.1, 2.2, 2.3 | Medium |
| 14 | **Fix SSRF protection** — use DNS resolution + comprehensive private IP check (IPv4, IPv6, octal, hex) | 6.3, 27.1, 27.2 | Medium |
| 15 | **Add project_id filter to contact matcher** — scope query to specific project | 34.12 | Small |
| 16 | **Fix MIME header injection** — sanitize To/Subject/CC/BCC fields (strip newlines, encode RFC 2047) | 12.1, 12.2 | Small |
| 17 | **Expand protected fields list** in automation `executeUpdateField` — add `deleted_at`, `owner_id`, `email`, `user_id`, etc. | 6.1 | Small |
| 18 | **Validate OAuth state parameter** on Gmail callback — store nonce in session, verify on return | 13.1, 14.8 | Medium |

### Priority 3: MEDIUM — Address Within 2-3 Sprints

| # | Action | Findings |
|---|--------|----------|
| 19 | **Add Zod validation to all GET query parameters** — bound `limit` (max 100), validate `page >= 1`, validate `search` length | ~30 findings |
| 20 | **Replace `select('*')` with explicit column lists** across all routes | ~15 findings |
| 21 | **Add rate limiting** to cron endpoint, tracking endpoints, and email send | 4.5, 3.2 |
| 22 | **Eliminate global mutable state** in automation engine — pass chain depth as parameter, use DB for deduplication | 5.1, 5.2 |
| 23 | **Import and enforce `lib/env.ts`** at application startup — add all security secrets to schema | 2.5 |
| 24 | **Fix open redirect** in click tracking — implement domain allowlist or reference stored link URLs | 3.1 |
| 25 | **Add project scoping** to `fetchVariableContext` in sequence processor | 16.2 |
| 26 | **Add middleware-level auth** for `/api/projects/` routes as defense-in-depth | 1.1 |
| 27 | **Restrict SVG uploads** — either disallow SVG or strip scripts from SVG content | 31.14 |
| 28 | **Sanitize error responses** — return generic messages to clients, log details server-side | 4.3, 4.4, + ~10 |

### Priority 4: LOW — Ongoing Improvements

| # | Action | Findings |
|---|--------|----------|
| 29 | **Add max length constraints** to all Zod string validators | ~25 findings |
| 30 | **Add max length constraints** to all Zod array validators | ~10 findings |
| 31 | **Reduce `select()` scope** to only required columns | ~15 findings |
| 32 | **Structured logging** — replace `console.error(error)` with filtered log output | ~12 findings |
| 33 | **Validate `next` redirect** in auth callback — prevent open redirect | 1.2 |
| 34 | **Fix static asset detection** in middleware — use file extension matching | 1.4 |

---

## 5. Risk Assessment Summary

### Multi-Tenant Isolation: **COMPROMISED**
The combination of SECURITY DEFINER functions without authorization (35.5-35.8), cross-project reference injection (19.4, 19.5, 20.3), admin client usage without project scoping (16.2, 34.12), and the hardcoded user backdoor (35.18) means that multi-tenant data isolation is not reliably enforced. An authenticated user in one project can potentially access, modify, or delete data belonging to other projects.

### External Attack Surface: **HIGH RISK**
Three CRITICAL findings (4.1, 10.1, 11.1) allow unauthenticated attackers to trigger email sends, corrupt CRM data, and force email syncs. The open redirect in click tracking (3.1) enables phishing from the trusted domain. PostgREST filter injection (17.1 and 14 similar) may allow data extraction.

### Stored XSS: **PERVASIVE**
HTML content is stored without sanitization across at least 7 entity types. The template variable substitution system (16.1) injects unsanitized user data into email HTML bodies. SVG uploads are allowed without script stripping (31.14). Any of these vectors could lead to account takeover if an admin views attacker-crafted content.

### Database Security: **INCOMPLETE**
While RLS is enabled on most tables, several policies are overly permissive (`WITH CHECK (true)`, `FOR ALL USING (true)`). 22+ SECURITY DEFINER functions bypass RLS entirely without performing their own authorization checks. This effectively negates the protection RLS is intended to provide for those operations.

---

*Total findings: 375 | CRITICAL: 4 | HIGH: 64 | MEDIUM: 174 | LOW: 125 | INFO: 8*
*Audit completed: 2026-02-04*
