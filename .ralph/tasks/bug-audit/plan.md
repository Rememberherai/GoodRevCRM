{
  "project": "GoodRevCRM",
  "created": "2026-02-03",
  "total_tasks": 36,
  "tasks": [
    {
      "id": 1,
      "category": "auth-middleware",
      "description": "Audit middleware.ts for auth bypass vectors, route matching, redirect security",
      "glob": "middleware.ts",
      "priority": "CRITICAL",
      "focus": [
        "Routes excluded from auth check (public routes list)",
        "API routes that bypass middleware entirely",
        "Open redirect in login/callback flows",
        "Cookie manipulation / session fixation",
        "Missing CSRF protection"
      ],
      "passes": true,
      "findings": 5
    },
    {
      "id": 2,
      "category": "auth-supabase-clients",
      "description": "Audit Supabase client factories \u2014 admin/service client credential handling, singleton patterns",
      "glob": "lib/supabase/*.ts",
      "priority": "CRITICAL",
      "focus": [
        "Admin/service role key exposure to client bundle",
        "createAdminClient used without authorization guard",
        "Service key not validated at startup",
        "Missing auth context in admin operations",
        "Client vs server client separation"
      ],
      "passes": true,
      "findings": 6
    },
    {
      "id": 3,
      "category": "auth-tracking-routes",
      "description": "Audit unauthenticated tracking endpoints \u2014 admin client usage, enumeration, open redirect",
      "glob": "app/api/track/*/route.ts",
      "priority": "CRITICAL",
      "focus": [
        "Local createAdminClient definitions duplicating service key",
        "No auth by design \u2014 verify cannot be abused for data exfiltration",
        "Click tracking: URL validation (open redirect via decoded URL)",
        "Open tracking: tracking ID enumeration / brute force",
        "Data written with admin client not scoped to project",
        "IP address and user-agent stored without consent"
      ],
      "passes": true,
      "findings": 6
    },
    {
      "id": 4,
      "category": "auth-cron",
      "description": "Audit cron endpoint \u2014 optional CRON_SECRET makes endpoint public, admin client cross-project processing",
      "glob": "app/api/cron/process-sequences/route.ts",
      "priority": "CRITICAL",
      "focus": [
        "CRON_SECRET is optional: if falsy, auth is completely skipped",
        "POST handler delegates to GET without separate auth",
        "processSequences runs with admin client across ALL projects",
        "processTimeTriggers runs with admin client across ALL projects",
        "No rate limiting",
        "Error messages leak internal state"
      ],
      "passes": true,
      "findings": 6
    },
    {
      "id": 5,
      "category": "automation-engine",
      "description": "Audit automation engine core \u2014 global state race conditions, chain depth, admin client, cooldown map",
      "glob": "lib/automations/engine.ts",
      "priority": "CRITICAL",
      "focus": [
        "Global mutable let currentChainDepth (line 18) \u2014 race condition in concurrent requests",
        "Global recentExecutions Map (line 13) \u2014 shared across serverless invocations",
        "MAX_CHAIN_DEPTH not reset on all error paths",
        "currentChainDepth decrement in catch uses Math.max but can still drift",
        "setInterval cleanup (line 328) in serverless environment",
        "Admin client for all operations \u2014 no per-user scoping",
        "emitAutomationEvent swallows errors silently",
        "dryRunAutomation reads entity with admin client \u2014 IDOR if automationId not scoped"
      ],
      "passes": true,
      "findings": 8
    },
    {
      "id": 6,
      "category": "automation-actions",
      "description": "Audit automation action handlers \u2014 field injection, SSRF in webhook, email creation, sequence enrollment",
      "glob": "lib/automations/actions.ts",
      "priority": "CRITICAL",
      "focus": [
        "executeUpdateField: field_name from config written to arbitrary column via admin client",
        "protectedFields list completeness (missing owner_id? is_active?)",
        "executeFireWebhook: SSRF protection \u2014 IPv6, DNS rebinding, cloud metadata 169.254.169.254",
        "executeFireWebhook: payload includes full entity data (data leakage to external URL)",
        "executeSendEmail: template injection via template content",
        "executeEnrollInSequence: gmail_connection selected without user context",
        "executeAssignOwner: user_id not validated as project member",
        "All actions use admin client bypassing RLS"
      ],
      "passes": true,
      "findings": 12
    },
    {
      "id": 7,
      "category": "automation-conditions",
      "description": "Audit automation conditions \u2014 dot-notation path traversal, type confusion, empty conditions",
      "glob": "lib/automations/conditions.ts",
      "priority": "HIGH",
      "focus": [
        "getFieldValue: dot-notation path traversal on arbitrary data objects",
        "String coercion in evaluateOperator may cause type confusion",
        "Missing prototype pollution checks (__proto__, constructor, prototype)",
        "evaluateConditions returns true for empty conditions array (permissive default)"
      ],
      "passes": true,
      "findings": 5
    },
    {
      "id": 8,
      "category": "automation-time-triggers",
      "description": "Audit time-based triggers \u2014 admin client, unbounded queries, event storms",
      "glob": "lib/automations/time-triggers.ts",
      "priority": "HIGH",
      "focus": [
        "processTimeTriggers fetches ALL active time automations across all projects",
        "tableName from entityTableMap not sanitized",
        "findInactiveEntities emits events for each match \u2014 potential event storm",
        "automation_time_checks deduplication \u2014 unbounded last_matched_entity_ids array",
        "Admin client for all operations"
      ],
      "passes": true,
      "findings": 7
    },
    {
      "id": 9,
      "category": "automation-api",
      "description": "Audit automation API routes \u2014 CRUD, test endpoint, execution listing",
      "glob": "app/api/projects/[slug]/automations/**/route.ts",
      "priority": "HIGH",
      "focus": [
        "Auth check consistency across GET/POST/PUT/DELETE/PATCH",
        "Project membership verification via slug",
        "Test endpoint: does dry-run prevent side effects?",
        "Input validation for trigger_config, conditions, actions JSON",
        "Execution listing: sensitive data in trigger_event/actions_results",
        "IDOR on automation [id] parameter"
      ],
      "passes": true,
      "findings": 8
    },
    {
      "id": 10,
      "category": "webhook-fullenrich",
      "description": "Audit FullEnrich webhook \u2014 signature bypass when secret unset, admin client, payload processing",
      "glob": "app/api/webhooks/fullenrich/route.ts",
      "priority": "HIGH",
      "focus": [
        "verifySignature returns true if FULLENRICH_WEBHOOK_SECRET not set (bypass!)",
        "timingSafeEqual with different-length Buffer.from strings may throw",
        "Admin client for all DB operations",
        "enrichmentId from user-controlled payload used in DB query",
        "No rate limiting",
        "Error messages may leak internal state"
      ],
      "passes": true,
      "findings": 9
    },
    {
      "id": 11,
      "category": "webhook-gmail",
      "description": "Audit Gmail webhook and sync routes",
      "glob": "app/api/gmail/webhook/route.ts",
      "priority": "HIGH",
      "focus": [
        "Webhook token/signature verification",
        "Admin client usage scope",
        "Push notification data validation",
        "Email content injection vectors",
        "Rate limiting"
      ],
      "passes": true,
      "findings": 7
    },
    {
      "id": 12,
      "category": "email-gmail-service",
      "description": "Audit Gmail service \u2014 email sending, tracking pixel injection, link wrapping, MIME construction",
      "glob": "lib/gmail/service.ts",
      "priority": "HIGH",
      "focus": [
        "wrapLinksWithTracking: regex-based HTML parsing (fragile, bypass possible)",
        "injectTrackingPixel: HTML injection if pixelUrl contains special chars",
        "createMimeMessage: header injection via unescaped To/Subject/CC/BCC",
        "stripHtml: XSS in plain text fallback",
        "Admin client for token refresh and email storage",
        "Access token stored/refreshed without encryption"
      ],
      "passes": true,
      "findings": 12
    },
    {
      "id": 13,
      "category": "email-gmail-oauth",
      "description": "Audit Gmail OAuth flow \u2014 state param CSRF, token storage, redirect handling",
      "glob": "lib/gmail/oauth.ts",
      "priority": "HIGH",
      "focus": [
        "State parameter validated on callback?",
        "Redirect URI from NEXT_PUBLIC_APP_URL (user-controllable via host header?)",
        "Token storage security (encrypted at rest?)",
        "Scope escalation risks",
        "Error messages leaking sensitive info"
      ],
      "passes": true,
      "findings": 7
    },
    {
      "id": 14,
      "category": "email-gmail-routes",
      "description": "Audit Gmail connect/callback/disconnect/test/connections routes",
      "glob": "app/api/gmail/*/route.ts",
      "priority": "HIGH",
      "focus": [
        "OAuth callback: state parameter CSRF protection",
        "Connect: auth check, scope request validation",
        "Disconnect: cleanup of stored tokens",
        "Test: auth check, connection ownership",
        "Connections: auth check, data scoping to user"
      ],
      "passes": true,
      "findings": 10
    },
    {
      "id": 15,
      "category": "email-gmail-sync",
      "description": "Audit Gmail sync routes \u2014 trigger, toggle, status",
      "glob": "app/api/gmail/sync/*/route.ts",
      "priority": "HIGH",
      "focus": [
        "Auth check on all sync routes",
        "Connection ownership validation (user_id)",
        "Admin client usage for sync operations",
        "Data scoping \u2014 synced emails associated with correct project",
        "Rate limiting on sync trigger"
      ],
      "passes": true,
      "findings": 10
    },
    {
      "id": 16,
      "category": "email-sequences",
      "description": "Audit sequence processor and variable substitution \u2014 template injection, email sending",
      "glob": "lib/sequences/*.ts",
      "priority": "HIGH",
      "focus": [
        "Variable substitution: {{variable}} replaced in HTML body without HTML escaping",
        "substituteVariables uses regex replace \u2014 stored XSS if person data contains HTML",
        "fetchVariableContext uses admin client for all data access",
        "processSequences: no rate limiting on email sends",
        "processEnrollment: error handling may leave enrollment in inconsistent state",
        "Gmail connection selection without user consent verification"
      ],
      "passes": true,
      "findings": 13
    },
    {
      "id": 17,
      "category": "api-people",
      "description": "Audit people CRUD routes \u2014 search/sort injection, project scoping, IDOR",
      "glob": "app/api/projects/[slug]/people/**/route.ts",
      "priority": "HIGH",
      "focus": [
        "search param interpolated into .or() ilike filter (filter injection)",
        "sortBy passed directly to .order() (column enumeration)",
        "limit/page not bounded (memory exhaustion with large limit)",
        "DELETE: soft delete vs hard delete consistency",
        "IDOR on person [id] \u2014 cross-project access",
        "Zod validation on POST/PATCH but raw params on GET"
      ],
      "passes": true,
      "findings": 8
    },
    {
      "id": 18,
      "category": "api-organizations",
      "description": "Audit organizations CRUD routes including add-contacts and discover-contacts",
      "glob": "app/api/projects/[slug]/organizations/**/route.ts",
      "priority": "HIGH",
      "focus": [
        "Search/sort injection in .or()/.order()",
        "add-contacts: validates person IDs belong to same project?",
        "discover-contacts: external API integration security (SSRF?)",
        "IDOR on organization [id]",
        "Cross-project reference validation"
      ],
      "passes": true,
      "findings": 13
    },
    {
      "id": 19,
      "category": "api-opportunities",
      "description": "Audit opportunities CRUD routes \u2014 stage transitions, value handling, cross-project refs",
      "glob": "app/api/projects/[slug]/opportunities/**/route.ts",
      "priority": "HIGH",
      "focus": [
        "Search/sort injection",
        "Stage transition validation",
        "Value/amount field handling (currency, overflow, negative)",
        "organization_id / primary_contact_id cross-project references",
        "IDOR on opportunity [id]"
      ],
      "passes": true,
      "findings": 11
    },
    {
      "id": 20,
      "category": "api-rfps",
      "description": "Audit RFP routes \u2014 CRUD, export, questions, AI generation, stats",
      "glob": "app/api/projects/[slug]/rfps/**/route.ts",
      "priority": "HIGH",
      "focus": [
        "RFP export: file generation security, path traversal",
        "Question generation: AI prompt injection via user content",
        "generate-all: unbounded AI calls (cost/DoS)",
        "Status transition validation",
        "Content library search injection",
        "IDOR on rfp [id] and question [questionId]"
      ],
      "passes": true,
      "findings": 16
    },
    {
      "id": 21,
      "category": "api-tasks",
      "description": "Audit task CRUD routes \u2014 assignment validation, status transitions",
      "glob": "app/api/projects/[slug]/tasks/**/route.ts",
      "priority": "HIGH",
      "focus": [
        "assigned_to validated as project member?",
        "Status transition logic",
        "Due date handling (past dates, timezone issues)",
        "entity_type/entity_id cross-project references",
        "IDOR on task [id]"
      ],
      "passes": true,
      "findings": 7
    },
    {
      "id": 22,
      "category": "api-email",
      "description": "Audit email send, inbox, history, thread routes",
      "glob": "app/api/projects/[slug]/email/*/route.ts",
      "priority": "HIGH",
      "focus": [
        "Email send: connection ownership (user_id check)",
        "Email send: recipient validation, header injection",
        "History: data leakage across projects",
        "Inbox: auth and scoping",
        "Thread [threadId]: IDOR on threadId parameter",
        "Template rendering security"
      ],
      "passes": true,
      "findings": 11
    },
    {
      "id": 23,
      "category": "api-sequences",
      "description": "Audit sequence routes \u2014 CRUD, enrollment, steps, AI generation",
      "glob": "app/api/projects/[slug]/sequences/**/route.ts",
      "priority": "HIGH",
      "focus": [
        "Enrollment: person must belong to same project?",
        "Step content: stored XSS in body_html",
        "Generate route: AI prompt injection",
        "Enrollment management: IDOR on enrollment IDs",
        "Gmail connection selection validation",
        "Step ordering/reordering logic"
      ],
      "passes": true,
      "findings": 12
    },
    {
      "id": 24,
      "category": "api-email-thread",
      "description": "Audit email thread route separately (dynamic threadId segment)",
      "glob": "app/api/projects/[slug]/email/thread/[threadId]/route.ts",
      "priority": "HIGH",
      "focus": [
        "IDOR: can user access threads from other projects?",
        "threadId validation (format, injection)",
        "Auth check present",
        "Data scoping to project"
      ],
      "passes": true,
      "findings": 5
    },
    {
      "id": 25,
      "category": "api-bulk-import-export",
      "description": "Audit bulk operations, import, and export routes",
      "glob": "app/api/projects/[slug]/bulk/route.ts",
      "priority": "MEDIUM",
      "focus": [
        "Bulk operation size limits",
        "entity_ids array validated for project scope?",
        "RPC calls: parameter injection",
        "Import: file upload validation (type, size, malicious CSV/JSON)",
        "Export: data scoping, file access control",
        "IDOR on import/export [id]"
      ],
      "passes": true,
      "findings": 9
    },
    {
      "id": 26,
      "category": "api-import-export-routes",
      "description": "Audit import and export CRUD routes",
      "glob": "app/api/projects/[slug]/import/**/route.ts",
      "priority": "MEDIUM",
      "focus": [
        "File upload validation",
        "CSV/JSON parsing (prototype pollution, injection)",
        "Import data validation before DB insert",
        "Export data scoped to project",
        "IDOR on [id] params"
      ],
      "passes": true,
      "findings": 12
    },
    {
      "id": 27,
      "category": "api-webhooks-mgmt",
      "description": "Audit outbound webhook management routes \u2014 CRUD, test delivery, delivery logs",
      "glob": "app/api/projects/[slug]/webhooks/**/route.ts",
      "priority": "MEDIUM",
      "focus": [
        "Webhook URL validation (SSRF in test delivery)",
        "Webhook secret management",
        "Delivery log data exposure",
        "IDOR on webhook [id]",
        "Test delivery: auth check, URL validation"
      ],
      "passes": true,
      "findings": 10
    },
    {
      "id": 28,
      "category": "api-content-templates",
      "description": "Audit content library and email template routes",
      "glob": "app/api/projects/[slug]/content-library/**/route.ts",
      "priority": "MEDIUM",
      "focus": [
        "Content library upload: file type/size validation",
        "Content library search: search param injection",
        "Template CRUD: stored XSS in HTML templates",
        "Template versions: access control",
        "IDOR on entryId, template [id]"
      ],
      "passes": true,
      "findings": 11
    },
    {
      "id": 29,
      "category": "api-misc-project-routes",
      "description": "Audit meetings, notes, activity, search, tags, schema, dashboard, analytics, settings, members, invitations, drafts, reports, widgets, research, enrich, epa-import, upload-logo",
      "glob": "app/api/projects/[slug]/meetings/**/route.ts",
      "priority": "MEDIUM",
      "focus": [
        "Auth pattern consistency across all routes",
        "Project scoping on all queries",
        "Input validation via Zod",
        "IDOR on [id] parameters",
        "Cross-entity references validated",
        "Notes: stored XSS in content",
        "Search: injection in search parameters"
      ],
      "passes": true,
      "findings": 9
    },
    {
      "id": 30,
      "category": "api-notes-activity-tags",
      "description": "Audit notes, activity, tags, and search routes",
      "glob": "app/api/projects/[slug]/notes/**/route.ts",
      "priority": "MEDIUM",
      "focus": [
        "Notes: stored XSS in content field",
        "Activity log: query injection, data leakage",
        "Tags: cross-project tag references via assign route",
        "Search: injection in search parameters",
        "IDOR on all [id] params"
      ],
      "passes": true,
      "findings": 13
    },
    {
      "id": 31,
      "category": "api-schema-settings-members",
      "description": "Audit schema, settings, members, invitations, and remaining project routes",
      "glob": "app/api/projects/[slug]/schema/**/route.ts",
      "priority": "MEDIUM",
      "focus": [
        "Schema: field definition manipulation, reorder injection",
        "Settings: auth check, project ownership",
        "Members: role escalation, IDOR on userId",
        "Invitations: auth, invitation token security",
        "Dashboard/analytics: data aggregation across unauthorized entities",
        "Upload-logo: file type/size validation, path traversal"
      ],
      "passes": true,
      "findings": 22
    },
    {
      "id": 32,
      "category": "api-top-level",
      "description": "Audit top-level routes: projects list/create, user profile/settings, notifications",
      "glob": "app/api/projects/route.ts",
      "priority": "MEDIUM",
      "focus": [
        "Projects route: creation validation, slug uniqueness/injection",
        "User profile/settings: IDOR, email change without verification",
        "Notifications: cross-user notification access",
        "Push notifications: subscription management security"
      ],
      "passes": true,
      "findings": 13
    },
    {
      "id": 33,
      "category": "validators",
      "description": "Audit all Zod validators for completeness and missing constraints",
      "glob": "lib/validators/*.ts",
      "priority": "MEDIUM",
      "focus": [
        "Missing .max() on string fields (DoS via large payloads)",
        "Missing .max() on array fields",
        "Overly permissive z.record() or z.unknown() usage",
        "Email/URL validation pattern completeness",
        "Custom field validation (arbitrary JSON?)",
        "Automation validator: action config not type-checked per action type"
      ],
      "passes": true,
      "findings": 21
    },
    {
      "id": 34,
      "category": "integrations",
      "description": "Audit external integrations \u2014 OpenRouter AI, FullEnrich client, EPA ECHO client, Gmail sync/contact-matcher",
      "glob": "lib/openrouter/*.ts",
      "priority": "MEDIUM",
      "focus": [
        "API key exposure in client-side code",
        "AI prompt injection in structured-output prompts",
        "Response validation from AI/external APIs",
        "Cost control / rate limiting on AI calls",
        "FullEnrich client: SSRF, credential handling",
        "EPA ECHO client: data validation on import",
        "Gmail sync: admin client scope, data association",
        "Contact matcher: false positive implications"
      ],
      "passes": true,
      "findings": 18
    },
    {
      "id": 35,
      "category": "database-rls",
      "description": "Audit RLS policies, migration security, RPC functions across all migrations",
      "glob": "supabase/migrations/*.sql",
      "priority": "MEDIUM",
      "focus": [
        "RLS enabled on all tables (check for missing policies)",
        "RLS policies check project membership correctly",
        "Service role bypass policies",
        "RPC functions: SQL injection via parameters",
        "Trigger functions: privilege escalation",
        "Missing indexes on foreign keys (performance DoS)",
        "Automation tables: RLS policies"
      ],
      "passes": true,
      "findings": 23
    },
    {
      "id": 36,
      "category": "summary",
      "description": "FINAL: Compile all findings into SUMMARY.md with severity counts, top risks, remediation plan",
      "glob": ".ralph/tasks/bug-audit/FINDINGS.md",
      "priority": "FINAL",
      "focus": [
        "Aggregate finding counts by severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)",
        "Aggregate finding counts by category",
        "Rank top 10 most critical findings with descriptions",
        "Identify systemic patterns across the codebase",
        "Generate prioritized remediation recommendations",
        "Create executive summary"
      ],
      "passes": true,
      "findings": 375
    }
  ]
}
