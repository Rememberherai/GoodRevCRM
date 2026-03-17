# E-Signature Module — Technical PRD

> Self-hosted e-signature system for GoodRevCRM. Replaces DocuSign/PandaDoc/OneFlow.
> Documents link to opportunities or stand alone. Signing happens on a public hosted page.
> Receipts sent via the user's own Gmail connection.
>
> **Status**: Reviewed through 8 rounds of design critique. Implementation-ready.
> **Date**: 2026-03-17

---

## Table of Contents

1. [Decision Log](#decision-log)
2. [State Machine](#state-machine)
3. [Database Schema](#database-schema)
4. [Gmail Connection Resolution](#gmail-connection-resolution)
5. [Public Signing Page Security](#public-signing-page-security)
6. [Audit Trail vs Activity Log](#audit-trail-vs-activity-log)
7. [Automation Event Emission](#automation-event-emission)
8. [Delegation Flow](#delegation-flow)
9. [Automation Integration](#automation-integration)
10. [API Routes](#api-routes)
11. [UI Pages](#ui-pages)
12. [npm Packages](#npm-packages)
13. [Implementation Phases](#implementation-phases)
14. [Verification](#verification)

---

## Decision Log

| Issue | Decision |
|-------|----------|
| Child tables missing `project_id` | All 5 tables get `project_id` directly. RLS uses direct `project_id` predicates via `project_memberships` join — matching `0086_project_secrets.sql` pattern |
| `created_by NOT NULL + ON DELETE SET NULL` conflict | `created_by` is nullable with `ON DELETE SET NULL`. User deletion shouldn't cascade-delete documents |
| State machine under-specified | Explicit state machine with all transitions, guards, side effects, and sequential-send idempotency mechanism |
| Sequential signing race condition | Group advancement uses `UPDATE ... WHERE current_signing_group = N RETURNING *` — only one concurrent submit wins the CAS. The winner sends next-group emails. Loser gets back 0 rows and skips email sending |
| Gmail connection resolution | `gmail_connection_id` stored at send time as soft reference (no FK). `sender_email` denormalized alongside it. Policy: reminders/receipts always use stored connection regardless of owner_id changes. If connection is expired/deleted, skip with audit warning |
| Audit trail vs activity_log | `contract_audit_trail` = legal record (immutable, service-role INSERT only). `activity_log` = CRM timeline (5 summary events via existing `log_activity()` RPC). No duplication — audit trail is authoritative, activity_log is a pointer |
| Storage model | **Service-role proxy only**. No direct storage access from any client. Private bucket with broad `authenticated` policies (matching `0071_sequence_step_attachments.sql` pattern). All PDF serving goes through API routes that enforce project membership or valid signing token |
| Public signing page PDF access | Split endpoint: `GET /api/sign/[token]` returns JSON metadata, `GET /api/sign/[token]/document` streams PDF bytes via service-role proxy. No signed URLs, no direct storage access from unauthenticated clients |
| Rate limiting | Best-effort in-memory throttle (30 req/min/IP). Labeled as defense-in-depth, not primary security. Primary protection is token validation + idempotent submit + status guards |
| Partial field progress | `PATCH /api/sign/[token]/fields` writes to `contract_fields.value`. Each PATCH also inserts an audit trail `field_filled` entry so intermediate values are recorded. Only final submitted values are legally binding |
| Recipient status model | `pending -> sent -> viewed -> signed` is the happy path. `declined` and `delegated` are **alternate terminal branches** from `sent` or `viewed`, not continuations after `signed` |
| Delegation model | Creates a **new successor recipient row** with fresh token. Original row status -> `delegated` with `delegated_to_recipient_id` pointing to successor. Original fields are re-assigned to successor. Clean audit trail, no mutation of legal records |
| Download after completion | Token-based downloads work **forever** for any recipient who was part of the signing (including delegated-from originals). Token validity for download only requires document `status = 'completed'`. If a document is soft-deleted (`deleted_at IS NOT NULL`), download tokens stop working — soft-delete takes precedence. This is the retention policy: CRM owners control document lifetime via soft-delete; external signers have permanent access only as long as the document is not deleted |
| Page count on upload | Use `pdf-lib` via `PDFDocument.load(bytes)` then `.getPageCount()`. Do NOT use `pdf-parse` for this — it's a text extraction library, not a page counter |
| Automation event emission | Explicit `emitAutomationEvent()` calls in API route handlers (matching existing pattern in `opportunities/route.ts`). Emission points listed below |
| Owner change after send | Policy: `gmail_connection_id` is immutable after send. If `owner_id` changes, reminders/receipts continue from original sender's Gmail. UI shows "Sent via {original_sender_email}" on document detail |
| `sender_email` nullability | Nullable in DB (drafts have no sender), but CHECK constraint enforces both `sender_email IS NOT NULL` AND `gmail_connection_id IS NOT NULL` for any non-draft status. Send route validates before state transition |
| Download guard for delegated | Delegated-from originals CAN download (status `delegated` is in download allowlist). They CANNOT take signing actions (status `delegated` is NOT in signing allowlist) |
| Submit transaction boundary | Phase A (DB transaction): validate + persist fields + update recipient + CAS. Phase B (post-commit, fire-and-forget): flatten + upload + email + automation. Failures in Phase B are caught by completion repair cron |
| Completion repair dedupe signal | `receipt_sent_at TIMESTAMPTZ` column on `contract_documents`. Normal completion sets it after sending receipts. Cron repair checks `receipt_sent_at IS NULL` to know receipts haven't been sent. The `completed` audit action is NOT used as dedupe — it's part of the normal success path and would suppress legitimate repair resends |
| Completion repair | Cron detects `status='completed' AND (signed_file_path IS NULL OR certificate_file_path IS NULL OR receipt_sent_at IS NULL) AND completed_at < now() - 5min`. Re-runs Phase B idempotently: skip artifacts already present, CAS-reserve `receipt_sent_at` before sending receipts. Duplicate receipts possible only in a sub-second crash window — accepted as benign |
| Delegation signature data | `signature_data`/`initials_data` stay on original recipient row, never copied to successor. Successor must create their own |
| Field value encoding | All values stored as TEXT with explicit encoding rules per field_type (checkbox='true'/'false', dropdown=exact option string, signature='adopted', date=ISO 8601) |
| `document.signed` event semantics | `document.signed` always means "one individual signer completed signing." It does NOT imply next-group email delivery or step completion. Next-group email send is a side effect of group advancement, not a modeled event. Automations should not depend on email delivery — only on the signer's status change |
| Send-time recipient status invariant | `sent` means "email send attempted" — NOT "successfully delivered." The send route updates each first-group recipient `pending -> sent` with `sent_at` individually, then attempts email delivery per-recipient. If Gmail send fails for a recipient, the recipient stays `sent` (not reverted to `pending`) and a `send_failed` detail is logged to audit trail. The owner sees a warning on the document detail page and can retry via the manual remind endpoint. This ensures the "any non-pending status" guard on `GET /api/sign/[token]` is always satisfied, and avoids a half-sent/half-pending inconsistency |
| `gmail_connection_id` CHECK constraint | DB CHECK enforces BOTH `sender_email IS NOT NULL` AND `gmail_connection_id IS NOT NULL` for any non-draft status. This is a DB-level invariant, not route-level only, because cron/reminders depend on the stored connection being present |
| Sequential signing_order contiguity | Send route validates that signing_order values across signers form a contiguous sequence `1, 2, ..., N` with no gaps. Enforced at send time (not creation), so recipients can be freely reordered during draft. This makes `current_signing_group + 1` advancement safe |
| Receipt dedupe granularity | Document-level, not per-recipient. Duplicate receipts to already-successful recipients are accepted as benign on retry. Per-recipient tracking deferred unless it becomes a real user complaint |
| `document.sent` emission semantics | Emitted when document leaves `draft`, regardless of per-recipient email delivery success. Means "owner initiated send," not "all emails delivered." Emitted exactly once per document lifecycle |
| Phase 2 field placement | API-only (no temporary form UI). Fields created via curl/Postman/MCP for testing. Phase 4 adds the graphical drag-drop editor |

---

## State Machine

### Document Status

```
                  +--- void ----------------------------+
                  |                                     v
  DRAFT --send--> SENT --view--> VIEWED                VOIDED
                  |                |
                  |    +-----------+
                  |    |
                  v    v
              PARTIALLY_SIGNED --last_sign--> COMPLETED
                  |
                  +-- decline --> DECLINED
                  |
                  +-- expire --> EXPIRED
```

### Transitions with Guards

| From | To | Trigger | Guard | Side Effects |
|------|----|---------|-------|-------------|
| `draft` | `sent` | Owner clicks Send | Has >=1 signer, gmail_connection valid, all signers have >=1 field | For each first-group recipient: flip `pending -> sent` with `sent_at`, then attempt email delivery. `sent` means "send attempted" not "delivered." If Gmail fails for a recipient, log `send_failed` to audit trail (recipient stays `sent`, owner sees warning). Audit `sent` on document, activity_log |
| `sent` | `viewed` | Signer opens link | First view by any signer | Audit `viewed`, notify owner (optional) |
| `sent`/`viewed` | `partially_signed` | Signer submits | Recipient status was `sent`/`viewed`, all required fields filled | Update recipient to `signed`, audit `signed`, advance next group if sequential |
| `partially_signed` | `partially_signed` | Another signer submits | Same as above | Same + check if all done |
| `partially_signed` | `completed` | Last signer submits | All signers status = `signed` | Flatten PDF, generate certificate, send receipt emails via stored gmail_connection, audit `completed`, activity_log, emit automation event |
| `sent`/`viewed`/`partially_signed` | `declined` | Any signer declines | Recipient status not already `signed` | Update recipient to `declined`, audit `declined`, notify owner, void remaining |
| any except `draft`/`completed`/`voided` | `voided` | Owner voids | Owner or admin role | Invalidate all tokens, audit `voided`, notify pending signers |
| `sent`/`viewed`/`partially_signed` | `expired` | Cron checks `expires_at` | `expires_at < now()` | Audit `expired`, notify owner |

### Recipient Status Transitions

```
pending --email sent--> sent --opens link--> viewed --submits--> signed (terminal)
                          |                    |
                          +-- declines --> declined (terminal)
                          |                    |
                          +-- delegates --> delegated (terminal, creates successor)
                                               +-- declines --> declined (terminal)
```

`declined` and `delegated` are **alternate terminal branches** from `sent` or `viewed` — NOT states that follow `signed`.

### Sequential Signing Logic

- Recipients with `signing_order = N` are in group N
- Only the current group receives emails and has active tokens
- `signing_order` is an integer on `contract_recipients`, NOT on the document
- **Contiguity validation**: The send route validates that signing_order values form a contiguous sequence starting at 1 (e.g. `1, 1, 2, 3` is valid; `1, 3` is rejected). This is enforced at send time, not at recipient creation, so recipients can be reordered freely during draft. Validation: `SELECT DISTINCT signing_order FROM contract_recipients WHERE document_id = $id AND role = 'signer' ORDER BY signing_order` must produce `1, 2, ..., N` with no gaps.
- **Group advancement uses compare-and-swap** to prevent double-send:

```sql
-- In POST /api/sign/[token]/submit, after updating recipient to 'signed':
-- Check if current group is complete, then atomically advance:
UPDATE contract_documents
SET current_signing_group = current_signing_group + 1
WHERE id = $doc_id
  AND signing_order_type = 'sequential'
  AND current_signing_group = $recipients_signing_order  -- CAS guard
  AND NOT EXISTS (
    SELECT 1 FROM contract_recipients
    WHERE document_id = $doc_id
      AND role = 'signer'
      AND signing_order = $recipients_signing_order
      AND status != 'signed'
  )
RETURNING current_signing_group;
```

- If RETURNING yields a row -> this submit won the race -> send next-group emails
- If RETURNING yields 0 rows -> another submit already advanced -> skip email sending
- The `+1` increment is safe because contiguity is validated at send time

### Completion CAS

```sql
-- After updating recipient to 'signed', check if ALL signers are done:
UPDATE contract_documents
SET status = 'completed', completed_at = NOW()
WHERE id = $doc_id
  AND status != 'completed'  -- CAS guard: only one wins
  AND NOT EXISTS (
    SELECT 1 FROM contract_recipients
    WHERE document_id = $doc_id
      AND role = 'signer'
      AND status != 'signed'
  )
RETURNING *;
```

- If RETURNING yields a row -> this submit triggers flatten/certificate/receipt (post-commit)
- If RETURNING yields 0 rows -> another submit already completed it -> skip

### Completion Artifact Repair

Phase B can fail at any point — after flattening but before certificate, after certificate but before receipts, etc. The cron job (`contract-reminders/route.ts`) detects ANY incomplete completion by checking all three artifact signals:

```sql
-- Find completed documents missing ANY completion artifact
SELECT * FROM contract_documents
WHERE status = 'completed'
  AND (signed_file_path IS NULL OR certificate_file_path IS NULL OR receipt_sent_at IS NULL)
  AND completed_at < NOW() - INTERVAL '5 minutes'  -- grace period for in-flight
  AND deleted_at IS NULL;
```

For each match, cron re-runs the Phase B steps **idempotently from the beginning**:
1. **Flatten**: If `signed_file_path IS NULL`, flatten and upload. If already set, skip.
2. **Certificate**: If `certificate_file_path IS NULL`, generate and upload. If already set, skip.
3. **Receipts**: Use CAS to reserve: `UPDATE contract_documents SET receipt_sent_at = NOW() WHERE id = $id AND receipt_sent_at IS NULL RETURNING *`. If RETURNING yields a row, send receipts. If 0 rows, skip.

**Receipt dedupe is document-level, not per-recipient.** If sending succeeds for some recipients and fails for others, the retry will resend to all recipients including those who already received a receipt. This is explicitly accepted: receipt emails are informational (not transactional), duplicate receipts are benign, and per-recipient tracking adds schema complexity disproportionate to the risk. If this ever becomes a real user complaint, per-recipient `receipt_sent_at` on `contract_recipients` can be added as a follow-up.

**Retry mechanics**: CAS-reserve `receipt_sent_at` -> attempt all sends -> if ANY send fails, NULL back `receipt_sent_at` so cron retries the full batch next cycle. If all sends succeed, `receipt_sent_at` stays set. If the NULL-back itself fails after a partial send failure, `receipt_sent_at` remains set and the failed recipients won't get receipts until manual intervention (owner can trigger via the document detail page). This is the accepted tradeoff.

The 5-minute grace period avoids racing with an in-flight completion.

---

## Database Schema

Migrations 0087-0092. All tables use direct `project_id` with RLS via `project_memberships` join. Pattern matches `0086_project_secrets.sql`.

### 0087: `contract_templates`

```sql
CREATE TABLE public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  file_path TEXT NOT NULL,           -- storage: {project_id}/templates/{id}/{filename}
  file_name TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 1,
  roles JSONB NOT NULL DEFAULT '[]', -- [{ name: "Client", order: 1 }]
  fields JSONB NOT NULL DEFAULT '[]', -- field definitions with role_name
  merge_fields JSONB NOT NULL DEFAULT '[]',
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
-- RLS: project member SELECT, member+ INSERT/UPDATE/DELETE (same 4-policy pattern as 0086)
-- Indexes: project_id, deleted_at WHERE NULL
-- Trigger: handle_updated_at()
```

### 0088: `contract_documents`

```sql
CREATE TABLE public.contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','viewed','partially_signed','completed','declined','expired','voided')),

  -- Files (Supabase Storage paths)
  original_file_path TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  original_file_hash TEXT,          -- SHA-256 at upload
  signed_file_path TEXT,            -- after flattening
  signed_file_hash TEXT,            -- SHA-256 of completed PDF
  certificate_file_path TEXT,
  page_count INTEGER NOT NULL DEFAULT 1,

  -- Relationships
  template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,

  -- Gmail connection used for sending. Soft reference (no FK) — if the connection row is
  -- deleted, this UUID becomes orphaned. We also store sender_email so the UI can display
  -- "Sent via X" even after deletion. Cron/reminders look up gmail_connections by this ID;
  -- if not found or expired, they skip with an audit warning.
  gmail_connection_id UUID,
  sender_email TEXT,
  -- Enforce: once sent, both sender_email and gmail_connection_id must exist
  CONSTRAINT chk_sender_on_send CHECK (
    status = 'draft' OR (sender_email IS NOT NULL AND gmail_connection_id IS NOT NULL)
  ),

  -- Workflow
  signing_order_type TEXT NOT NULL DEFAULT 'sequential'
    CHECK (signing_order_type IN ('sequential', 'parallel')),
  current_signing_group INTEGER DEFAULT 1,  -- tracks which group is active (sequential only)

  -- Lifecycle timestamps
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  receipt_sent_at TIMESTAMPTZ,        -- dedupe signal for completion repair cron

  -- Reminders
  reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_interval_days INTEGER DEFAULT 3,
  last_reminder_at TIMESTAMPTZ,

  -- Ownership (created_by nullable because ON DELETE SET NULL requires it)
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
-- RLS: project member SELECT, member+ INSERT/UPDATE/DELETE
-- Indexes: project_id, status, opportunity_id, organization_id, person_id, expires_at, deleted_at WHERE NULL, GIN on custom_fields
-- Trigger: handle_updated_at()
```

### 0089: `contract_recipients`

```sql
CREATE TABLE public.contract_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.contract_documents(id) ON DELETE CASCADE,

  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'signer' CHECK (role IN ('signer', 'cc', 'witness')),
  signing_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','viewed','signed','declined','delegated')),

  -- Token for public signing page
  signing_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  token_expires_at TIMESTAMPTZ,

  -- Event timestamps
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Delegation (creates a NEW successor recipient row; this row becomes terminal 'delegated')
  delegated_to_recipient_id UUID REFERENCES public.contract_recipients(id) ON DELETE SET NULL,
  delegated_at TIMESTAMPTZ,

  -- Legal capture (E-SIGN Act compliance)
  consent_ip TEXT,
  consent_user_agent TEXT,
  consent_timestamp TIMESTAMPTZ,
  signing_ip TEXT,
  signing_user_agent TEXT,

  -- Saved signature/initials data
  signature_data JSONB,  -- { type: 'draw'|'type'|'upload'|'adopt', data: base64, font?: string }
  initials_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: project member SELECT/INSERT/UPDATE/DELETE via direct project_id
-- Indexes: project_id, document_id, signing_token (UNIQUE), email, person_id, status
-- Trigger: handle_updated_at()
```

### 0090: `contract_fields`

```sql
CREATE TABLE public.contract_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.contract_documents(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.contract_recipients(id) ON DELETE CASCADE,

  field_type TEXT NOT NULL CHECK (field_type IN (
    'signature','initials','date_signed','text_input',
    'checkbox','dropdown','name','email','company','title'
  )),
  label TEXT,
  placeholder TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,

  -- Position (percentage coordinates, resolution-independent)
  page_number INTEGER NOT NULL DEFAULT 1,
  x DECIMAL(10,4) NOT NULL,
  y DECIMAL(10,4) NOT NULL,
  width DECIMAL(10,4) NOT NULL,
  height DECIMAL(10,4) NOT NULL,

  options JSONB,              -- for dropdown
  validation_rule TEXT,       -- regex
  auto_populate_from TEXT,    -- CRM path e.g. 'person.full_name'

  -- Filled value (always TEXT, encoding rules below)
  value TEXT,
  filled_at TIMESTAMPTZ,
  -- Value encoding by field_type:
  --   signature/initials: 'adopted' (actual image data is on contract_recipients.signature_data/initials_data)
  --   date_signed: ISO 8601 date string 'YYYY-MM-DD'
  --   text_input/name/email/company/title: plain text string
  --   checkbox: 'true' or 'false'
  --   dropdown: exact option string from options JSONB array

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: project member SELECT/INSERT/UPDATE/DELETE via direct project_id
-- Indexes: project_id, document_id, recipient_id, (document_id, page_number)
-- Trigger: handle_updated_at()
```

### 0091: `contract_audit_trail`

This is the **legal audit record** — immutable, append-only, no UPDATE/DELETE policies.

```sql
CREATE TABLE public.contract_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.contract_documents(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.contract_recipients(id) ON DELETE SET NULL,

  action TEXT NOT NULL CHECK (action IN (
    'created','sent','send_failed','viewed','field_filled','signed','declined',
    'voided','reminder_sent','delegated','downloaded','completed',
    'expired','consent_given','link_opened','signature_adopted'
  )),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user','signer','system')),
  actor_id TEXT,
  actor_name TEXT,

  ip_address TEXT,
  user_agent TEXT,
  details JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: project member SELECT only (no INSERT/UPDATE/DELETE via RLS — all inserts via service role)
-- Indexes: project_id, document_id, recipient_id, action, created_at
```

### 0092: `contract_storage_and_triggers`

```sql
-- Storage bucket (private, not public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: broad authenticated access (same pattern as sequence-attachments in 0071).
-- Project scoping is NOT enforced at the bucket level — it is enforced in API route handlers
-- that validate project membership before proxying files. Public signing pages use service
-- role through API proxy routes; they never access storage directly.
CREATE POLICY "Authenticated users can upload contracts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Authenticated users can read contracts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts');

CREATE POLICY "Authenticated users can delete contracts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts');

-- NO completion trigger on contract_recipients.
-- State transitions (group advancement, completion detection) are handled entirely
-- in the API layer using compare-and-swap UPDATE ... RETURNING to avoid races.

-- handle_updated_at triggers for all tables
CREATE TRIGGER set_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_contract_documents_updated_at BEFORE UPDATE ON public.contract_documents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_contract_recipients_updated_at BEFORE UPDATE ON public.contract_recipients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_contract_fields_updated_at BEFORE UPDATE ON public.contract_fields FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

---

## Gmail Connection Resolution

**Problem**: Gmail connections are user-scoped and fetched by explicit `connection_id` (see `app/api/projects/[slug]/email/send/route.ts`). Automations and cron can't use an auth'd user context.

**Solution**:
1. At send time, the UI picks a `gmail_connection_id` from the sender's connected accounts (same as the existing email compose flow)
2. This ID is stored on `contract_documents.gmail_connection_id` and is **immutable after send**
3. All subsequent emails for this document (reminders, receipts, next-group notifications) use this stored connection via **service role client** + the existing `sendEmail()` function from `lib/gmail/service.ts`
4. Before sending, validate `status = 'connected'`. If expired, skip with audit log entry `{ action: 'reminder_sent', details: { skipped: true, reason: 'gmail_connection_expired' } }`
5. UI shows a warning on documents whose gmail connection is expired

**Ownership change policy**: If `owner_id` changes after send, reminders and receipts continue using the **original stored `gmail_connection_id`**. The connection belongs to whoever sent the document, not the current owner. UI shows "Sent via {sender_email}" on the document detail page. If the original sender's Gmail connection is deleted or permanently expired, the document can be re-sent with a new connection by voiding and re-creating (not by patching the connection mid-flight).

---

## Public Signing Page Security

**Route**: `/app/sign/[token]/page.tsx` (client component, SSR-fetched data)

**Middleware** (`middleware.ts`): Add `/sign` to `publicRoutes`:
```typescript
const publicRoutes = ['/login', '/auth/callback', '/invite', '/sign'];
```

**API routes** (all under `/app/api/sign/[token]/`): These use **service role client** only (no auth context).

### Token Validation (per-action guards)

| Check | Signing actions (consent, fields, submit, decline, delegate) | Download | View metadata / PDF |
|-------|--------------------------------------------------------------|----------|---------------------|
| Token lookup | `contract_recipients` by `signing_token` | Same | Same |
| Token expiry | `token_expires_at` is null or > now() | **Ignored** (tokens work forever for download) | `token_expires_at` is null or > now() |
| Document status | NOT `voided`, `expired`, `completed`, `declined` | Must be `completed` | NOT `voided` |
| Document soft-delete | `deleted_at IS NULL` | `deleted_at IS NULL` (soft-delete kills access) | `deleted_at IS NULL` |
| Recipient status | Must be `sent` or `viewed` | May be `signed`, `declined`, OR `delegated` (all participants get download) | Any non-`pending` status |
| Sequential guard | `signing_order <= current_signing_group` | N/A | N/A |

Key distinction: **delegated-from originals can download** because their recipient status (`delegated`) is in the download allowlist. They cannot take signing actions because `delegated` is not in the signing allowlist.

**Intentional: declined and delegated recipients CAN view metadata and PDF before completion.** A signer who declined should still be able to see what they declined. A delegated-from original should still be able to view the document they delegated. This is read-only access (no signing actions allowed) and only exposes the same document they were already invited to sign. The document status guard (`NOT voided`) prevents access to voided documents. This is a deliberate design choice for transparency, not an oversight.

### Idempotent Submit (transaction boundary)

`POST /api/sign/[token]/submit` has two phases:

**Phase A — DB transaction** (atomic, rollback-safe):
1. Validate token (guards above)
2. If recipient already `signed`, return 200 `{ already_signed: true }` — no double-processing
3. Persist all field values to `contract_fields`
4. Update recipient: `status = 'signed'`, `signed_at`, `signing_ip`, `signing_user_agent`, `signature_data`, `initials_data`
5. Insert audit trail entries (`signed`, `signature_adopted`)
6. CAS group advancement (sequential) or CAS completion check
7. Commit

**Phase B — Post-commit side effects** (fire-and-forget, failures logged but don't roll back):
- If CAS completion won: flatten PDF -> upload to storage -> generate certificate -> upload -> update `signed_file_path`/`certificate_file_path`/hashes -> CAS-reserve `receipt_sent_at` -> send receipt emails (if reserve won) -> `emitAutomationEvent('document.completed')` -> `log_activity()`. If email send fails after reservation, NULL back `receipt_sent_at` so cron can retry. Duplicate receipts possible only if NULL-back itself fails — accepted as benign
- If CAS group advanced: send next-group emails -> `emitAutomationEvent('document.signed')`
- If neither: `emitAutomationEvent('document.signed')` only

Note: `document.signed` always means "one individual signer completed signing" — it does NOT imply next-group email delivery. Next-group send is a side effect, not an event.

Phase B failures are handled by the completion repair mechanism.

### Partial Progress

- `PATCH /api/sign/[token]/fields` saves individual field values without submitting
- Each PATCH inserts an audit trail `field_filled` entry with IP/UA so intermediate values are recorded
- Signer can close tab and return — their progress is saved in `contract_fields.value`
- Only the final submitted values are legally binding (audit trail distinguishes `field_filled` from `signed`)
- Submit validates all required fields are filled before accepting

### Rate Limiting (defense-in-depth)

- Best-effort in-memory Map keyed by IP, 30 requests/minute per signing endpoint
- Will reset on cold start and does not coordinate across instances — this is acceptable
- Primary security is: unguessable UUID tokens + status guards + idempotent submit
- Implemented as a utility in `lib/contracts/rate-limit.ts`

### PDF Access Model

- `GET /api/sign/[token]/document` streams PDF bytes through the API route via service role client
- `GET /api/sign/[token]` returns JSON metadata only (title, field config, page count)
- No signed URLs, no direct Supabase Storage URLs exposed to unauthenticated clients
- Authenticated CRM users also access PDFs through their own project-scoped API routes

### Data Scoping

- `GET /api/sign/[token]` returns only: document title, page count, fields assigned to THIS recipient, recipient name/email
- `GET /api/sign/[token]/document` returns only: raw PDF bytes for the document
- Other recipients' data, internal notes, custom_fields — never exposed

---

## Audit Trail vs Activity Log

| System | Purpose | Write pattern | Immutable? |
|--------|---------|--------------|------------|
| `contract_audit_trail` | Legal record for compliance | Service role INSERT only, no UPDATE/DELETE RLS | Yes |
| `activity_log` | CRM timeline (shows on opportunity/person detail) | Via `log_activity()` RPC from `0027_activity_log.sql` | No |

**Rule**: Audit trail gets EVERY event. Activity log gets only: `created`, `sent`, `completed`, `declined`, `voided` — one entry each, with `entity_type: 'contract'` and metadata pointing to the document.

**Activity log compatibility updates required** (DB column is `TEXT NOT NULL` with no CHECK constraint, so `'contract'` works at the SQL level, but the TS/UI layer has discriminated unions):

Files that reference `ActivityEntityType` (exhaustive grep — only 2 files in the repo):
- **`types/activity.ts`**: Add `'contract'` to `ActivityEntityType` union
- **`components/activity/activity-timeline.tsx`**: Add `contract: FileSignature` (or `PenTool`) to `entityIcons` map, and add a case to `getActivityDescription()` if contract-specific rendering is needed

---

## Automation Event Emission

Every `emitAutomationEvent()` call is explicit in API route code (matching existing pattern in `opportunities/route.ts`):

| Event | Emitted from | When |
|-------|-------------|------|
| `document.sent` | `POST /api/projects/[slug]/contracts/[id]/send/route.ts` | After document status transitions from `draft` to `sent`, regardless of per-recipient email delivery success. Emitted exactly once when the document leaves draft. Automations should treat this as "owner initiated send," not "all emails delivered" |
| `document.signed` | `POST /api/sign/[token]/submit/route.ts` | After individual recipient status -> `signed` |
| `document.completed` | `POST /api/sign/[token]/submit/route.ts` | After CAS detects all signers done and sets status -> `completed` |
| `document.declined` | `POST /api/sign/[token]/decline/route.ts` | After recipient status -> `declined` |
| `document.voided` | `POST /api/projects/[slug]/contracts/[id]/void/route.ts` | After document status -> `voided` |
| `document.expired` | `GET /api/cron/contract-reminders/route.ts` | After cron sets status -> `expired` |

```typescript
emitAutomationEvent({
  projectId: document.project_id,
  triggerType: 'document.completed',
  entityType: 'document',
  entityId: document.id,
  data: { title: document.title, opportunity_id: document.opportunity_id, ... },
});
```

---

## Delegation Flow

When a signer delegates:

1. `POST /api/sign/[token]/delegate` receives `{ email, name }` of the delegate
2. Create a **new `contract_recipients` row** for the delegate:
   - Same `document_id`, `project_id`, `signing_order`
   - New `signing_token`
   - Status = `pending`
3. Re-assign all `contract_fields` where `recipient_id = original` to the new recipient AND **clear `value` and `filled_at`** on those fields. Any partial values the original signer entered are preserved only in audit trail `field_filled` entries — the successor starts with a clean slate.
4. **Do NOT copy `signature_data` or `initials_data`** from the original recipient to the successor. These stay on the original row as a historical record. The successor must create their own.
5. Update original recipient: `status = 'delegated'`, `delegated_to_recipient_id = new.id`, `delegated_at = now()`
6. Insert audit trail entry: `action = 'delegated'`, details includes original + delegate info + list of cleared fields
7. Send signing email to delegate via stored `gmail_connection_id`

The original recipient's token becomes inactive (status guard rejects `delegated` status on subsequent requests).

---

## Automation Integration

**Files to modify** (complete list):

1. **`types/automation.ts`** — Add to TS unions + UI metadata:
   - `TriggerType`: add `'document.sent'`, `'document.signed'`, `'document.completed'`, `'document.declined'`, `'document.expired'`, `'document.voided'`
   - `ActionType`: add `'send_document'`, `'void_document'`, `'send_signing_reminder'`
   - `AutomationEntityType`: add `'document'`
   - `triggerTypeGroups`: add `document` group with all 6 triggers
   - `actionTypeOptions`: add 3 new entries
   - `TriggerConfig`: add `document_status?: string` for filtering

2. **`lib/validators/automation.ts`** — **CRITICAL**: Separate Zod allowlists that will reject payloads at runtime if not updated in parallel with the TS types:
   - `triggerTypes` array: add all 6 `document.*` trigger strings
   - `actionTypes` array: add `'send_document'`, `'void_document'`, `'send_signing_reminder'`
   - `automationEntityTypes` array: add `'document'`
   - Note: this file is already out of sync with `types/automation.ts`. Fix only document-related additions to avoid scope creep

3. **`lib/automations/actions.ts`** — Add to:
   - `entityTableMap`: add `document: 'contract_documents'`
   - `executeAction()` switch: add 3 new cases
   - `ALLOWED_FIELDS.contract_documents`: allowlist for `update_field`
   - New functions: `executeSendDocument()`, `executeVoidDocument()`, `executeSendSigningReminder()`

4. **`lib/automations/engine.ts`** — Add document trigger matching in `matchesTriggerConfig()`

5. **`lib/automations/conditions.ts`** — No changes needed (generic condition evaluator)

6. **`lib/mcp/server.ts`** — Register `registerContractTools()`

7. **`lib/mcp/tools/contracts.ts`** — New file, 10 tools

8. **`lib/chat/tool-registry.ts`** — Add `defineTool()` entries

9. **`hooks/use-chat.ts`** — Add to `MUTATING_TOOLS`

10. **`components/chat/chat-settings.tsx`** — Add contracts category

11. **`components/chat/chat-message-list.tsx`** — Add color for contracts tools

12. **`lib/chat/system-prompt.ts`** — Add contracts capability

---

## API Routes

### Authenticated (`/app/api/projects/[slug]/contracts/`)

| Route | Methods | Purpose |
|-------|---------|---------|
| `route.ts` | GET, POST | List/create documents |
| `[id]/route.ts` | GET, PATCH, DELETE | CRUD |
| `[id]/send/route.ts` | POST | Send (requires `gmail_connection_id` in body) |
| `[id]/void/route.ts` | POST | Void document |
| `[id]/remind/route.ts` | POST | Manual reminder |
| `[id]/download/route.ts` | GET | Download original or signed PDF |
| `[id]/certificate/route.ts` | GET | Download certificate |
| `[id]/fields/route.ts` | GET, PUT | Bulk get/update field placements |
| `[id]/recipients/route.ts` | GET, POST | Manage recipients |
| `[id]/recipients/[rid]/route.ts` | PATCH, DELETE | Update/remove recipient |
| `[id]/audit-trail/route.ts` | GET | View audit trail |
| `upload/route.ts` | POST | Upload PDF |
| `templates/route.ts` | GET, POST | List/create templates |
| `templates/[tid]/route.ts` | GET, PATCH, DELETE | Template CRUD |
| `templates/[tid]/create-document/route.ts` | POST | Instantiate template |

### Public (`/app/api/sign/[token]/`)

| Route | Methods | Purpose |
|-------|---------|---------|
| `route.ts` | GET | JSON: document title, recipient info, field config, page count, status |
| `document/route.ts` | GET | Binary: streams PDF bytes via service-role proxy |
| `consent/route.ts` | POST | Record e-sign consent (IP, UA, timestamp) |
| `fields/route.ts` | PATCH | Save partial field progress (+ audit trail entry per save) |
| `submit/route.ts` | POST | Submit all fields + signature (idempotent, CAS group advancement) |
| `decline/route.ts` | POST | Decline with reason |
| `delegate/route.ts` | POST | Delegate to another person (creates successor recipient row) |
| `download/route.ts` | GET | Binary: streams completed PDF (token works forever, requires doc `status = completed`) |

### Cron (`/app/api/cron/contract-reminders/route.ts`)

- Send reminders for documents where `reminder_enabled = true` AND `last_reminder_at + interval < now()`
- Expire documents where `expires_at < now()`
- Repair incomplete completions (see Completion Artifact Repair above)

---

## UI Pages

| Page | Path |
|------|------|
| Contract list | `/app/(dashboard)/projects/[slug]/contracts/page.tsx` |
| Contract detail (overview, recipients, audit trail tabs) | `/app/(dashboard)/projects/[slug]/contracts/[id]/page.tsx` |
| Field editor (PDF viewer + drag-drop) | `/app/(dashboard)/projects/[slug]/contracts/[id]/edit/page.tsx` |
| Templates list | `/app/(dashboard)/projects/[slug]/contracts/templates/page.tsx` |
| Public signing page | `/app/sign/[token]/page.tsx` |

---

## npm Packages

| Package | Purpose |
|---------|---------|
| `pdf-lib` | Server-side PDF flattening + certificate generation |
| `pdfjs-dist` | Client-side PDF rendering to canvas |
| `@pdf-lib/fontkit` | Custom font embedding for typed signatures |

Already installed: `pdf-parse`, `zod`, `@supabase/supabase-js`, `lucide-react`, `date-fns`, `react-hook-form`

---

## Implementation Phases

### Phase 0 — Schema + Types (no UI)
1. Migrations 0087-0092
2. Push to Supabase, regenerate types
3. `types/contract.ts` — TypeScript interfaces
4. `lib/validators/contract.ts` — Zod schemas
5. Typecheck passes

### Phase 1 — Upload + Recipients + Send
6. Upload API route (PDF to storage, SHA-256 hash, page count via `pdf-lib`)
7. Document CRUD routes
8. Recipient CRUD routes
9. Send route (resolve gmail_connection, send emails to first group, update statuses)
10. Contract list page (basic table with status badges)
11. Contract detail page (overview + recipients panel)

### Phase 2 — Public Signing Page
12. Middleware update for `/sign`
13. `lib/contracts/rate-limit.ts`
14. `lib/contracts/signing-token.ts` (validation logic)
15. **Minimal field placement** — `PUT /api/projects/[slug]/contracts/[id]/fields` accepts JSON array of field definitions. For Phase 2 testing, fields are created via the API endpoint directly (curl/Postman) or via MCP tools. **No temporary form UI** — Phase 4 adds the graphical drag-drop editor.
16. Public API routes (GET metadata, GET /document for PDF, consent, fields PATCH, submit, decline, delegate)
17. Signing page UI (PDF viewer via pdfjs-dist, field rendering over canvas, consent banner)
18. Signature capture modal (draw/type/upload/adopt tabs)
19. Audit trail logging for all signer actions

### Phase 3 — Completion Flow
20. `lib/contracts/pdf-flatten.ts` (embed signatures into PDF via pdf-lib)
21. `lib/contracts/certificate.ts` (generate certificate of completion PDF)
22. `lib/contracts/hash.ts` (SHA-256)
23. Completion handler: flatten -> hash -> store -> send receipt emails via stored gmail_connection
24. Download routes (original, signed, certificate)
25. Audit trail viewer tab on detail page

### Phase 4 — Field Editor
26. PDF viewer component (pdfjs-dist canvas rendering)
27. Field palette sidebar (draggable field types)
28. Drag-drop onto PDF pages with position tracking
29. Field properties panel (required, label, recipient assignment)
30. Bulk save to `contract_fields`

### Phase 5 — Templates + Automation + MCP
31. Template CRUD + create-from-template flow
32. Automation integration (all files listed above)
33. MCP tools (`lib/mcp/tools/contracts.ts`)
34. Chat agent tools
35. Cron job for reminders + expiry + completion repair
36. Opportunity linkage (show documents on opportunity detail page)

---

## Verification

1. **Phase 0**: `npm run typecheck` passes after migration push + type regen
2. **Phase 1**: Upload a PDF -> appears in list as draft -> add 2 recipients -> Send -> email arrives from your Gmail with `/sign/{token}` link
3. **Phase 2**: Open signing link in incognito -> consent screen -> fill fields -> draw signature -> submit -> recipient status = signed -> second signer gets email (sequential)
4. **Phase 3**: Both signers complete -> flattened PDF has embedded signatures -> certificate generated -> receipt email sent with attachments -> document status = completed
5. **Phase 4**: Open field editor -> drag signature field onto page 1 -> assign to recipient -> save -> fields appear on signing page
6. **Phase 5**: Create automation "document.completed -> change_stage to closed_won" -> sign a linked document -> opportunity stage auto-updates
