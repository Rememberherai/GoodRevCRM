# Office 365 (Outlook) Email Integration Plan

## Context

The CRM currently only supports Gmail for email sending. A client (Lillianah) may provide an Office 365 email address. We need to support sending emails from O365 accounts using the **Microsoft Graph API**, alongside existing Gmail support.

Today's work added significant email complexity: threading (In-Reply-To/References headers, quoted replies), MIME attachments for sequences, and enrollment UI improvements. The Outlook integration must support all of this.

## Approach: Microsoft Graph API

Use `POST https://graph.microsoft.com/v1.0/me/sendMail` via OAuth 2.0. Two-step send (create draft → send) to get a message ID back for tracking/threading.

## Prerequisites (Azure AD) — ~5 min for IT admin

1. Azure Portal → App registrations → New registration
2. Set redirect URI: `{APP_URL}/api/outlook/callback`
3. Create client secret
4. Add delegated permissions: `Mail.Send`, `Mail.ReadWrite`, `User.Read`, `offline_access`
5. Grant admin consent
6. Provide client ID + secret → `.env.local`

## Implementation

### Phase 1: Database Migration (`0072_email_provider_support.sql`)

```sql
ALTER TABLE gmail_connections
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'gmail'
  CHECK (provider IN ('gmail', 'outlook'));
```

Keep table name `gmail_connections` — renaming breaks many FKs, RLS policies, and code. All existing rows auto-default to `'gmail'`. Cosmetic rename is a future task.

Regenerate types + typecheck per CLAUDE.md.

### Phase 2: Extract Shared Utilities

**New file: `lib/email/tracking.ts`**
- Extract from `lib/gmail/service.ts`:
  - `injectTrackingPixel(html, trackingId)`
  - `wrapLinksWithTracking(html, trackingId)`
- These are pure HTML transforms, fully provider-agnostic
- Update `lib/gmail/service.ts` to import from shared module

**New file: `lib/email/provider.ts`**
- `EmailProvider` interface:
  ```typescript
  interface EmailProvider {
    sendEmail(connection: GmailConnection, input: SendEmailInput, userId: string, projectId?: string | null): Promise<SendEmailResult>;
    getValidAccessToken(connection: GmailConnection): Promise<string>;
  }
  ```
- `getEmailProvider(provider: 'gmail' | 'outlook'): EmailProvider` factory
- Gmail provider wraps existing `sendEmail()` from `lib/gmail/service.ts`

### Phase 3: Outlook OAuth

**New file: `lib/outlook/oauth.ts`**
- Auth URL: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- Token URL: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- Scopes: `Mail.Send Mail.ReadWrite User.Read offline_access`
- Functions: `getOutlookAuthorizationUrl()`, `exchangeOutlookCodeForTokens()`, `refreshOutlookAccessToken()`, `getOutlookUserProfile()`
- Note: Microsoft always returns a new refresh token on refresh — must always store latest

**New API routes:**
- `app/api/outlook/connect/route.ts` — initiates OAuth
- `app/api/outlook/callback/route.ts` — handles callback, stores in `gmail_connections` with `provider='outlook'`
- `app/api/outlook/disconnect/route.ts` — deletes connection

**Env vars:** `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

### Phase 4: Outlook Email Sending

**New file: `lib/outlook/service.ts`**

Key differences from Gmail:
- **No MIME construction** — Graph API accepts structured JSON (`toRecipients`, `subject`, `body`)
- **Attachments** — Graph API accepts base64-encoded attachments in the message JSON (no MIME multipart needed)
- **Threading** — Graph API supports `internetMessageId` for In-Reply-To; set `conversationId` for thread grouping
- **Quoted replies** — Reuse the same quoted-reply HTML construction from `lib/sequences/processor.ts`

Send flow:
1. Get valid access token (refresh if expired)
2. Inject tracking pixel + wrap links (shared utilities)
3. `POST /me/messages` — create draft with JSON body → returns message with `id` and `internetMessageId`
4. `POST /me/messages/{id}/send` — send the draft
5. Store in `sent_emails` + `emails` tables (same as Gmail path)
6. Return `SendEmailResult`

**Threading support:**
- Set `singleValueExtendedProperties` with `internetMessageId` for References/In-Reply-To
- Or use `@odata.type: "#microsoft.graph.message"` with `internetMessageHeaders` to set In-Reply-To and References headers directly
- `conversationId` from Graph API is Microsoft's thread grouping (analogous to Gmail thread_id)

### Phase 5: Wire Up Existing Routes

**Modify: `app/api/projects/[slug]/email/send/route.ts`**
- Check `connection.provider` after fetching connection
- Call `getEmailProvider(connection.provider).sendEmail(...)` instead of direct Gmail import
- Update error messages from "Gmail" to "Email"

**Modify: `lib/sequences/processor.ts`**
- Import provider factory
- After fetching `gmailConnection`, dispatch via `getEmailProvider(gmailConnection.provider).sendEmail(...)`
- Threading logic (In-Reply-To, quoted replies) stays in processor — it passes `reply_to_message_id` and `thread_id` in `SendEmailInput`, which each provider handles

**Modify: `app/api/gmail/connections/route.ts`**
- Include `provider` field in response

### Phase 6: UI Updates

**Modify: `components/gmail/gmail-connection.tsx`**
- Add "Connect Outlook" button alongside "Connect Gmail"
- Show provider icon per connection

**Modify: `components/gmail/send-email-modal.tsx`**
- Show provider icon in "From" dropdown

**Modify: enrollment dialogs** (sequence enrollment components)
- Connection dropdown should show provider icon so user knows which account they're enrolling with

### Phase 7: Types

**Modify: `types/gmail.ts`**
- Add `provider: 'gmail' | 'outlook'` to `GmailConnection` type
- Add `EmailProvider` type alias

## Key Files to Modify

| File | Change |
|------|--------|
| `lib/gmail/service.ts` | Extract tracking utils, keep Gmail-specific send |
| `lib/sequences/processor.ts` | Provider dispatch for send |
| `app/api/projects/[slug]/email/send/route.ts` | Provider dispatch |
| `app/api/gmail/connections/route.ts` | Include provider in response |
| `types/gmail.ts` | Add provider field |
| `components/gmail/gmail-connection.tsx` | Outlook connect button |
| `components/gmail/send-email-modal.tsx` | Provider icon in From dropdown |

## New Files

| File | Purpose |
|------|---------|
| `lib/email/tracking.ts` | Shared tracking pixel/link wrapping |
| `lib/email/provider.ts` | Provider interface + factory |
| `lib/outlook/oauth.ts` | Microsoft OAuth flow |
| `lib/outlook/service.ts` | Graph API sending + threading + attachments |
| `app/api/outlook/connect/route.ts` | OAuth initiation |
| `app/api/outlook/callback/route.ts` | OAuth callback |
| `app/api/outlook/disconnect/route.ts` | Disconnect |
| `supabase/migrations/0072_email_provider_support.sql` | Add provider column |

## Out of Scope (Future)

- Inbound email sync from Outlook (Graph supports it via subscriptions/webhooks)
- Renaming `gmail_connections` table to `email_connections`

## Verification

1. Run migration, regenerate types, typecheck
2. Verify existing Gmail flow unchanged: send, tracking, threading, sequence sends with attachments
3. Connect O365 test account via OAuth flow
4. Send email from O365 — verify delivery, tracking pixel, click tracking
5. Test sequence enrollment with O365 connection — verify threading (In-Reply-To) and quoted replies work
6. Test attachment sending via sequence from O365
7. Verify UI shows both providers with correct icons
