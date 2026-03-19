# Office 365 (Outlook) Email Integration Plan

> **Rescoped: 2026-03-18** — updated to reflect current codebase state (migrations through 0113, full inbound sync, bounce detection, sequences, templates, signatures, chat tools, MCP tools, automations).

## Context

The CRM has a mature Gmail integration: OAuth, outbound sending with open/click tracking, MIME attachments, threading (In-Reply-To/References), inbound sync via Pub/Sub + History API, bounce detection with circuit breakers, contact matching, email signatures, templates, drafts, and full chat/MCP tool coverage. All email functionality is currently Gmail-only under `lib/gmail/`, `app/api/gmail/`, and `components/gmail/`.

A client (Lillianah) may provide an Office 365 email address. We need to support sending and receiving emails from O365 accounts using the **Microsoft Graph API**, alongside existing Gmail support.

## Gmail Compatibility Rules

The #1 priority is **do not break Gmail**. These rules apply to every phase:

1. **No direct `lib/gmail/*` imports outside provider adapters** — after the provider abstraction is in place, all callers must go through `getEmailProvider()`. This includes contracts, sequences, cron jobs, and API routes.
2. **Keep `/api/gmail/*` endpoints stable** — UI components hardcode these paths (`gmail-connection.tsx`, `send-email-modal.tsx`, `contract-detail-client.tsx`). Add Outlook endpoints separately. Only introduce `/api/email/*` after the provider-neutral backend is proven.
3. **Keep `gmail_connection_id` in request payloads** — validators and forms use this name (`lib/validators/contract.ts`, `lib/validators/sequence.ts`). Accept both `gmail_connection_id` and `email_connection_id` on the server during transition. No repo-wide rename up front.
4. **Every phase must pass `npm test` and manual Gmail smoke test** before proceeding.

## Approach: Microsoft Graph API

- **Outbound:** Two-step send via `POST /me/messages` (create draft) → `POST /me/messages/{id}/send` to get a message ID for tracking/threading.
- **Inbound sync:** Graph API subscriptions (webhooks) + delta queries, analogous to Gmail's Pub/Sub + History API.

## Prerequisites (Azure AD)

1. Azure Portal → App registrations → New registration
2. Set redirect URI: `{APP_URL}/api/outlook/callback`
3. Create client secret
4. Add delegated permissions: `Mail.Send`, `Mail.ReadWrite`, `Mail.Read`, `User.Read`, `offline_access`
5. Grant admin consent
6. Provide client ID + secret → `.env.local`

**Env vars:** `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

---

## Implementation

### Phase 0: Inventory & Safety Net

Before writing any Outlook code, audit and document every call site that directly imports from `lib/gmail/`:

**Direct `lib/gmail/service.ts` → `sendEmail()` callers (must all go through provider):**
- `app/api/projects/[slug]/email/send/route.ts`
- `lib/sequences/processor.ts`
- `app/api/projects/[slug]/contracts/[id]/send/route.ts`
- `app/api/projects/[slug]/contracts/[id]/remind/route.ts`
- `lib/contracts/completion.ts`
- `lib/contracts/notifications.ts`
- `app/api/cron/contract-reminders/route.ts`

**Direct `lib/gmail/sync.ts` callers (must dispatch by provider):**
- `app/api/cron/sync-emails/route.ts` — **critical**: currently selects all `gmail_connections` with `status='connected'` and blindly calls Gmail sync. Will break the moment an Outlook connection exists.
- `app/api/gmail/webhook/route.ts`
- `app/api/gmail/sync/trigger/route.ts`

**UI hardcoded `/api/gmail/*` endpoints (do NOT rename, add Outlook separately):**
- `components/gmail/gmail-connection.tsx` — `/api/gmail/connections`, `/api/gmail/connect`, `/api/gmail/disconnect`, `/api/gmail/sync/*`
- `components/gmail/send-email-modal.tsx` — `/api/gmail/connections`
- `app/(dashboard)/projects/[slug]/contracts/[id]/contract-detail-client.tsx` — `/api/gmail/connections`

**Validators using `gmail_connection_id` (keep as-is, accept alias on server):**
- `lib/validators/contract.ts` — `sendContractSchema`
- `lib/validators/sequence.ts`

### Phase 1: Database Migration (`0114_email_provider_support.sql`)

```sql
-- Add provider column to gmail_connections
ALTER TABLE gmail_connections
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'gmail';

ALTER TABLE gmail_connections
  DROP CONSTRAINT IF EXISTS gmail_connections_provider_check;
ALTER TABLE gmail_connections
  ADD CONSTRAINT gmail_connections_provider_check CHECK (provider IN ('gmail', 'outlook'));

-- Add provider-neutral sync columns for Outlook
-- (Gmail uses history_id; Outlook uses deltaLink)
ALTER TABLE gmail_connections
  ADD COLUMN IF NOT EXISTS sync_cursor TEXT;

-- Add provider-neutral ID columns to emails table
-- (Outlook messages don't have gmail_message_id/gmail_thread_id format)
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_thread_id TEXT;

-- Backfill provider columns from Gmail columns for existing rows
UPDATE emails
  SET provider_message_id = gmail_message_id,
      provider_thread_id = gmail_thread_id
  WHERE provider_message_id IS NULL;
```

**Schema notes:**
- Keep table name `gmail_connections` — renaming breaks FKs, RLS policies, and hundreds of code references.
- Keep `gmail_message_id` / `gmail_thread_id` columns — they're used everywhere. The new `provider_message_id` / `provider_thread_id` columns provide a neutral layer for Outlook. Gmail rows populate both.
- `sync_cursor` stores Outlook's `deltaLink` (Gmail continues using `history_id`).
- FK columns named `gmail_connection_id` in `sent_emails`, `sequence_enrollments`, `contract_documents` remain unchanged — they reference the `gmail_connections` table which now holds both providers.

**Post-migration:** Regenerate types + typecheck per CLAUDE.md.

### Phase 2: Provider Abstraction Layer

**New file: `lib/email/tracking.ts`**
Extract provider-agnostic utilities from `lib/gmail/service.ts`:
- `injectTrackingPixel(html, trackingId)` — inserts invisible pixel before `</body>`
- `wrapLinksWithTracking(html, trackingId)` — rewrites `<a href>` to tracking redirect
- `normalizeEmailHtml(html)` — paragraph spacing normalization for email clients

Update `lib/gmail/service.ts` to import from shared module.

**New file: `lib/email/provider.ts`**
```typescript
interface EmailProvider {
  sendEmail(
    connection: GmailConnection,
    input: SendEmailInput,
    userId: string,
    projectId?: string | null
  ): Promise<SendEmailResult>;

  getValidAccessToken(connection: GmailConnection): Promise<string>;

  // Inbound sync
  registerWatch?(connection: GmailConnection): Promise<void>;
  stopWatch?(connection: GmailConnection): Promise<void>;
  performInitialSync?(connection: GmailConnection, userId: string): Promise<void>;
  performIncrementalSync?(connection: GmailConnection, userId: string): Promise<void>;

  // Threading
  getThreadHistory?(accessToken: string, threadId: string): Promise<any[]>;
  checkForReplies?(accessToken: string, messageId: string, threadId: string): Promise<boolean>;
}

function getEmailProvider(provider: 'gmail' | 'outlook'): EmailProvider;
```

Gmail provider wraps existing functions from `lib/gmail/service.ts` and `lib/gmail/sync.ts`.

**Critical: Update sync cron immediately**

`app/api/cron/sync-emails/route.ts` must filter by provider and dispatch accordingly as soon as this phase lands. Without this, adding any Outlook connection will cause the cron to call Gmail sync on it and fail.

```typescript
// Before: blindly calls Gmail sync on all connections
// After: dispatch by provider
for (const connection of connections) {
  const provider = getEmailProvider(connection.provider ?? 'gmail');
  await provider.performIncrementalSync(connection, connection.user_id);
}
```

### Phase 3: Migrate All Direct Gmail Imports

Replace every direct `import { sendEmail } from '@/lib/gmail/service'` with the provider factory. This must happen **before** any Outlook connection can be created.

**Files to update:**
- `app/api/projects/[slug]/email/send/route.ts` — use `getEmailProvider(connection.provider)`
- `lib/sequences/processor.ts` — use `getEmailProvider(gmailConnection.provider)`
- `app/api/projects/[slug]/contracts/[id]/send/route.ts` — use provider factory
- `app/api/projects/[slug]/contracts/[id]/remind/route.ts` — use provider factory
- `lib/contracts/completion.ts` — use provider factory
- `lib/contracts/notifications.ts` — use provider factory
- `app/api/cron/contract-reminders/route.ts` — use provider factory
- `app/api/cron/sync-emails/route.ts` — dispatch by provider (see Phase 2)

**Enforcement:** After this phase, grep for `from '@/lib/gmail/service'` and `from '@/lib/gmail/sync'` — the only imports should be inside `lib/email/provider.ts` (the Gmail adapter).

**Run `npm test` + manual Gmail smoke test:** send an email, run a sequence step, send a contract, trigger sync. Everything must still work identically.

### Phase 4: Outlook OAuth

**New file: `lib/outlook/oauth.ts`**
- Auth URL: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- Token URL: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- Scopes: `Mail.Send Mail.ReadWrite Mail.Read User.Read offline_access`
- Functions: `getOutlookAuthorizationUrl()`, `exchangeOutlookCodeForTokens()`, `refreshOutlookAccessToken()`, `getOutlookUserProfile()`
- Note: Microsoft always returns a new refresh token on refresh — must always store latest

**New API routes:**
- `app/api/outlook/connect/route.ts` — initiates OAuth flow
- `app/api/outlook/callback/route.ts` — handles callback, stores in `gmail_connections` with `provider='outlook'`
- `app/api/outlook/disconnect/route.ts` — revokes tokens + deletes connection

### Phase 5: Outlook Email Sending

**New file: `lib/outlook/service.ts`**

Key differences from Gmail:
- **No MIME construction** — Graph API accepts structured JSON (`toRecipients`, `subject`, `body`)
- **Attachments** — Graph API accepts base64-encoded attachments in the message JSON (no MIME multipart needed)
- **Threading** — use `internetMessageHeaders` to set In-Reply-To and References headers directly
- **Thread grouping** — `conversationId` from Graph API is analogous to Gmail's `thread_id`

Send flow:
1. Get valid access token (refresh if expired)
2. Inject tracking pixel + wrap links (shared utilities from Phase 2)
3. `POST /me/messages` — create draft with JSON body → returns message with `id` and `internetMessageId`
4. `POST /me/messages/{id}/send` — send the draft
5. Store in `sent_emails` + `emails` tables — populate both `gmail_message_id` (with Outlook message ID) and `provider_message_id` / `provider_thread_id`
6. Create activity log entry
7. Return `SendEmailResult`

### Phase 6: Outlook Inbound Sync

**New file: `lib/outlook/sync.ts`**

Analogous to `lib/gmail/sync.ts`. Uses Graph API equivalents:

| Gmail | Outlook (Graph API) |
|-------|-------------------|
| Pub/Sub watch | `POST /subscriptions` (webhook) |
| History API | Delta queries (`/me/mailFolders/inbox/messages/delta`) |
| `history_id` | `deltaLink` (stored in `sync_cursor` column) |
| Labels | Folder IDs |

Features to replicate:
- **Initial sync** — fetch last 30 days via `/me/messages?$filter=receivedDateTime ge ...&$top=500`
- **Incremental sync** — delta queries with `deltaLink` tracking
- **Bounce detection** — detect NDRs from Graph message metadata (`internetMessageHeaders` for DSN)
- **Contact matching** — reuse `lib/gmail/contact-matcher.ts` (already provider-agnostic)
- **Circuit breaker** — same pattern: disable sync after N consecutive errors

**New API routes:**
- `app/api/outlook/sync/trigger/route.ts` — manual sync trigger
- `app/api/outlook/sync/toggle/route.ts` — enable/disable sync
- `app/api/outlook/sync/status/route.ts` — get sync status
- `app/api/outlook/webhook/route.ts` — receives Graph subscription notifications

**Webhook validation:** Graph API requires endpoint validation during subscription creation (returns a `validationToken` query param that must be echoed back).

### Phase 7: Thread Model Normalization

The current UI/API assumes Gmail thread IDs in several places. These need to become provider-neutral:

**`app/api/projects/[slug]/email/inbox/route.ts`**
- Currently: `.eq('gmail_thread_id', threadId)` — update to also check `provider_thread_id`

**`app/api/projects/[slug]/email/thread/[threadId]/route.ts`**
- Currently: validates thread ID with regex `/^[a-f0-9]+$/i` (Gmail hex format) — relax to accept Outlook thread IDs too
- Currently: `.eq('gmail_thread_id', threadId)` — update to check both columns

**`components/email/entity-email-tab.tsx`**
- Currently: groups threads by `email.gmail_thread_id` — use `provider_thread_id` fallback

### Phase 8: UI Updates

**Modify: `components/gmail/gmail-connection.tsx`**
- Add "Connect Outlook" button alongside "Connect Gmail"
- Show provider icon (Gmail / Outlook) per connection
- Show sync status per provider
- Keep all `/api/gmail/*` endpoint calls — Outlook uses its own `/api/outlook/*` endpoints

**Modify: `components/gmail/send-email-modal.tsx`**
- Show provider icon in "From" dropdown
- Handle case where user has both Gmail and Outlook connected
- Keep fetching from `/api/gmail/connections` (which now includes Outlook connections via the `provider` field)

**Modify: Sequence enrollment dialogs**
- Connection dropdown should show provider icon so user knows which account they're enrolling with

**Modify: Contract send dialog** (`contract-detail-client.tsx`)
- Show provider icon in connection picker

### Phase 9: Types

**Modify: `types/gmail.ts`**
- Add `provider: 'gmail' | 'outlook'` to `GmailConnection` type
- Add `EmailProvider` type alias
- Add Outlook-specific types (Graph API message format, subscription payload)

### Phase 10: Vitest Tests

Tests run via `npm test` (`vitest run`) or `npm run test:watch`. Follow the existing pattern in `tests/` — validator schemas, pure function unit tests, type assertions. Import from `@/` aliases.

**New file: `tests/outlook/outlook.test.ts`**

```typescript
describe('Outlook Validators', () => {
  // OAuth callback schema — code + state required, non-empty
  // Connection query schema — provider filter ('gmail' | 'outlook')
  // Disconnect schema — connection_id UUID required
});

describe('Outlook OAuth Helpers', () => {
  // calculateTokenExpiry — same as Gmail, verify ISO string output
  // isTokenExpired — future/past/within-buffer cases (Microsoft uses same pattern)
  // Note: Microsoft always rotates refresh tokens — test that token storage includes new refresh_token
});
```

**New file: `tests/outlook/outlook-service.test.ts`**

```typescript
describe('Outlook Graph API Message Construction', () => {
  // buildGraphMessage — structured JSON output (toRecipients, subject, body)
  // buildGraphMessage with CC/BCC — correct recipient arrays
  // buildGraphMessage with attachments — base64 encoding, contentType
  // buildGraphMessage with threading — internetMessageHeaders for In-Reply-To/References
  // buildGraphMessage with HTML body — body.contentType = 'HTML'
});
```

**New file: `tests/email/tracking.test.ts`**

Tests for the extracted shared utilities (Phase 2):

```typescript
describe('Email Tracking (shared)', () => {
  describe('injectTrackingPixel', () => {
    // Injects pixel before </body>
    // Handles HTML without </body> tag
    // Pixel URL includes tracking ID
    // Does not double-inject
  });

  describe('wrapLinksWithTracking', () => {
    // Wraps <a href> with tracking redirect
    // Skips mailto: links
    // Skips anchor (#) links
    // Preserves link text and attributes
    // Handles multiple links
    // URL-encodes original URL in tracking redirect
  });

  describe('normalizeEmailHtml', () => {
    // Normalizes paragraph spacing for email clients
    // Preserves inline styles
  });
});
```

**New file: `tests/email/provider.test.ts`**

Tests for the provider abstraction (Phase 2):

```typescript
describe('Email Provider Factory', () => {
  // getEmailProvider('gmail') — returns Gmail provider
  // getEmailProvider('outlook') — returns Outlook provider
  // getEmailProvider with invalid provider — throws
  // Both providers implement EmailProvider interface (sendEmail, getValidAccessToken)
});
```

**Modify: `tests/gmail/gmail.test.ts`**

Add provider-aware tests to existing file:

```typescript
describe('Gmail Connection with Provider', () => {
  // sendEmailSchema still validates without provider (backward compat)
  // gmailConnectionQuerySchema accepts provider filter
  // Connection type includes provider field
});
```

**Modify: `tests/sequence/sequence.test.ts`**

Add provider dispatch tests:

```typescript
describe('Sequence Processor Provider Dispatch', () => {
  // Dispatches to Gmail provider when connection.provider === 'gmail'
  // Dispatches to Outlook provider when connection.provider === 'outlook'
  // Falls back to Gmail for connections without provider field (legacy)
});
```

**New file: `tests/outlook/outlook-sync.test.ts`**

```typescript
describe('Outlook Sync', () => {
  describe('Webhook Validation', () => {
    // Echoes validationToken on subscription creation
    // Rejects requests without valid subscription ID
  });

  describe('Bounce Detection', () => {
    // Detects NDR from Graph internetMessageHeaders
    // Extracts bounced recipient from DSN
    // Ignores non-bounce messages
  });

  describe('Delta Query Tracking', () => {
    // Stores deltaLink after sync
    // Uses deltaLink for incremental sync
    // Falls back to full sync when deltaLink is missing
  });
});
```

**Run command:** `npm test` to verify all new and existing tests pass.

### Phase 11: Chat & MCP Tools

**Modify: `lib/chat/tool-registry.ts`**
- Update `email.send` tool — include provider selection if user has multiple connections
- Update `email.inbox` / `email.history` — works across providers (already queries `emails` table)
- Add connection management awareness (show which providers are connected)

**Modify: `lib/mcp/tools/`**
- Update email MCP tools to support provider parameter
- Add Outlook connection management tools if needed

**Modify: `lib/chat/system-prompt.ts`**
- Update email capability description to mention Outlook support

### Phase 12: Automations

**Modify: `app/api/projects/[slug]/email/send/route.ts`**
- Emit `email.sent` automation event (currently missing for both providers)

**Modify: `lib/outlook/sync.ts`** and **`lib/gmail/sync.ts`**
- Emit `email.received` automation event on inbound sync (missing for both providers)

**Modify: `lib/automations/engine.ts`**
- Register new trigger types: `email.sent`, `email.received`

---

## Recommended Rollout Order

Stage the work to minimize risk. Each stage is independently shippable:

| Stage | Phases | What ships | Risk |
|-------|--------|-----------|------|
| **1. Provider abstraction** | 0, 1, 2, 3 | No user-facing changes. All Gmail callers go through provider factory. Sync cron is safe. | Low — pure refactor |
| **2. Outlook outbound** | 4, 5, 8 (partial), 9 | Users can connect O365 and send email. No sync yet. | Medium — new OAuth flow |
| **3. Outlook sync** | 6, 7 | Inbound email sync + thread rendering for Outlook | Medium — new webhook + thread model |
| **4. Contracts + sequences** | (already done in Phase 3) | Contracts/sequences work with Outlook connections | Low — provider factory handles it |
| **5. Chat/MCP/automations** | 11, 12 | AI tools and automation triggers for both providers | Low — additive |
| **6. Tests** | 10 | Full vitest coverage | Low — additive |

---

## Key Files to Modify

| File | Change |
|------|--------|
| `lib/gmail/service.ts` | Extract tracking utils to shared module |
| `lib/gmail/sync.ts` | Wrap in provider interface |
| `lib/sequences/processor.ts` | Provider dispatch for send |
| `app/api/projects/[slug]/email/send/route.ts` | Provider dispatch + `email.sent` event |
| `app/api/projects/[slug]/contracts/[id]/send/route.ts` | Provider dispatch |
| `app/api/projects/[slug]/contracts/[id]/remind/route.ts` | Provider dispatch |
| `lib/contracts/completion.ts` | Provider dispatch |
| `lib/contracts/notifications.ts` | Provider dispatch |
| `app/api/cron/contract-reminders/route.ts` | Provider dispatch |
| `app/api/cron/sync-emails/route.ts` | Filter by provider + dispatch |
| `app/api/gmail/connections/route.ts` | Include provider in response |
| `app/api/projects/[slug]/email/inbox/route.ts` | Provider-neutral thread filtering |
| `app/api/projects/[slug]/email/thread/[threadId]/route.ts` | Relax thread ID validation |
| `components/email/entity-email-tab.tsx` | Provider-neutral thread grouping |
| `types/gmail.ts` | Add provider field + Outlook types |
| `components/gmail/gmail-connection.tsx` | Outlook connect button + provider icons |
| `components/gmail/send-email-modal.tsx` | Provider icon in From dropdown |
| `lib/chat/tool-registry.ts` | Provider-aware email tools |
| `lib/chat/system-prompt.ts` | Update email capability description |
| `lib/automations/engine.ts` | New trigger types |
| `tests/gmail/gmail.test.ts` | Add provider-aware tests |
| `tests/sequence/sequence.test.ts` | Add provider dispatch tests |

## New Files

| File | Purpose |
|------|---------|
| `lib/email/tracking.ts` | Shared tracking pixel/link wrapping |
| `lib/email/provider.ts` | Provider interface + factory |
| `lib/outlook/oauth.ts` | Microsoft OAuth flow |
| `lib/outlook/service.ts` | Graph API sending + threading + attachments |
| `lib/outlook/sync.ts` | Graph API inbound sync + bounce detection |
| `app/api/outlook/connect/route.ts` | OAuth initiation |
| `app/api/outlook/callback/route.ts` | OAuth callback |
| `app/api/outlook/disconnect/route.ts` | Disconnect |
| `app/api/outlook/sync/trigger/route.ts` | Manual sync trigger |
| `app/api/outlook/sync/toggle/route.ts` | Enable/disable sync |
| `app/api/outlook/sync/status/route.ts` | Sync status |
| `app/api/outlook/webhook/route.ts` | Graph subscription webhook |
| `supabase/migrations/0114_email_provider_support.sql` | Add provider column + neutral ID columns |
| `tests/outlook/outlook.test.ts` | Outlook validator + OAuth helper tests |
| `tests/outlook/outlook-service.test.ts` | Graph API message construction tests |
| `tests/outlook/outlook-sync.test.ts` | Webhook validation, bounce detection, delta query tests |
| `tests/email/tracking.test.ts` | Shared tracking pixel/link wrapping tests |
| `tests/email/provider.test.ts` | Provider factory tests |

## Out of Scope (Future)

- Renaming `gmail_connections` table to `email_connections`
- Renaming `gmail_connection_id` FK columns across all tables
- Moving `/api/gmail/*` to `/api/email/*` (only after provider-neutral backend is proven)
- Calendar integration (Graph API supports it but separate initiative)
- Shared mailbox support (delegated access)
- Exchange on-premises (EWS) — Graph API is cloud-only

## Gaps to Fix Regardless of Outlook (apply to Gmail too)

These are missing from the current Gmail implementation and should be addressed during this work:

1. **`email.sent` automation trigger** — not emitted from send route or sequence processor
2. **`email.received` automation trigger** — not emitted from inbound sync
3. **`checkForReplies()`** — exists in `lib/gmail/service.ts` but unused anywhere

## Verification

### Gmail Regression Checklist (run after every phase)

1. `npm test` — all existing tests pass
2. `npm run typecheck` — no type errors
3. Send email from Gmail via project email send route
4. Send email from Gmail via contract send
5. Send email from Gmail via contract remind
6. Run sequence step with Gmail connection — verify threading + attachments
7. Trigger email sync cron — verify Gmail sync still works
8. Verify Gmail webhook receives and processes push notifications
9. Verify tracking pixel opens + link clicks still record events
10. Verify contract completion notification sends via Gmail
11. Verify contract reminder cron sends via Gmail

### Outlook Integration Checklist

1. Connect O365 test account via OAuth flow
2. Send email from O365 — verify delivery, tracking pixel, click tracking
3. Test sequence enrollment with O365 connection — verify threading and quoted replies
4. Test attachment sending via sequence from O365
5. Test inbound sync from O365 — verify emails appear in inbox, contact matching works
6. Test bounce detection for O365
7. Verify UI shows both providers with correct icons
8. Verify chat tools work with Outlook connections
9. Test automation triggers fire for both providers
10. Test thread viewer renders Outlook threads correctly
