# Documents Module PRD

**Version:** 3.1
**Date:** 2026-03-28
**Status:** Implementation-ready
**Implementation posture:** Extend the existing contracts platform; do not build a second signing system

---

## 1. Summary

Add a top-level **Documents** module that gives users one place to create, send, track, and manage signature documents across the product.

This module serves two jobs:

- surface every document the current user can access across all projects
- support truly standalone documents that are not attached to a CRM project

The product should feel like a user-level document workspace, but the implementation should continue to reuse the existing `contract_*` schema, signing flow, PDF processing, audit trail, and public `/sign/[token]` experience.

---

## 2. Problem

The current e-signature system is buried inside project-scoped contracts routes and views. That creates three practical problems:

- users cannot see all documents they are responsible for across projects in one place
- users cannot send a document unless they first decide which CRM project it belongs to
- the product already has enough signing infrastructure, but it is packaged as a project feature rather than as a first-class module

The Documents module solves discoverability and workflow friction, not a lack of signing capability.

---

## 3. Goals

- Create a top-level Documents module in the main module switcher
- Provide a unified document list across all accessible projects plus standalone documents
- Allow users to create and send standalone documents without choosing a project
- Reuse the existing contracts engine instead of cloning or renaming it
- Keep the public recipient signing flow unchanged
- Preserve project-scoped contract workflows for users who still work from inside a project

---

## 4. Non-Goals

- No rewrite of the current signing engine
- No table rename from `contract_*` to `document_*` in v1
- No new public signing UX; continue using `/sign/[token]`
- No standalone collaborative workspace model in v1 beyond explicit owner access rules
- No full WYSIWYG or HTML document composer
- No dashboard-style analytics beyond lightweight summary cards

## 4.1 Scope Tiers

The build is organized into two tiers with a clear boundary between them:

**Tier 1 — Core (Phases 1–6).** Ship target. The module is usable end-to-end:
navigation, schema, shared services, API, UI, settings, polish.

**Tier 2 — Integration (Phases 7–8).** Required by CLAUDE.md but depends on Tier 1 being stable:
MCP tools, chat agent tools, automation events, bulk actions.

---

## 5. Users And Jobs To Be Done

### 5.1 Internal user sending agreements

The user wants to upload a PDF, add recipients, place fields, send for signature, and monitor completion without having to create or choose a project first.

### 5.2 Cross-project operator

The user belongs to multiple projects and needs one queue for drafts, sent documents, signatures in progress, and completed documents.

### 5.3 Existing project-based user

The user still creates contracts from a project context, but expects those documents to also appear in the Documents module for global visibility.

---

## 6. Core Product Decisions

These decisions should be treated as locked for v1 unless implementation reveals a hard blocker.

### 6.1 Documents is a top-level module

Add **Documents** to the module switcher beside CRM, Accounting, and Calendar.

### 6.2 UI label stays "Documents"; implementation stays "contracts"

The user-facing module is called Documents. The codebase should keep using the existing contracts domain objects and tables in v1 to avoid expensive churn with little product value.

### 6.3 Standalone means "not attached to a project"

A standalone document has `project_id IS NULL`. It is not hidden inside a synthetic project and should not require creating a fake workspace record.

### 6.4 Standalone access is creator-only in v1

Standalone documents and templates are private to the user identified by `created_by`. The `owner_id` field is not used for standalone access control in v1. This keeps the RLS rules simple and avoids ambiguity about who can see what. Sharing and delegation can be added later if needed.

### 6.5 Standalone docs are not CRM-linked in v1

For standalone documents, `organization_id`, `person_id`, and `opportunity_id` should remain `NULL`. Those relations are project-scoped elsewhere in the product, and allowing them on standalone docs creates unclear ownership and permission rules.

### 6.6 Project docs still work exactly as they do now

Project-scoped contracts remain available inside project pages and also appear inside the Documents module aggregate views.

### 6.7 Public signing flow does not fork

Recipients should keep using the current `/sign/[token]` routes. The signing flow must work for both project and standalone documents through the same entry points.

### 6.8 First shipping slice is PDF-first

The first real release should support:

- upload PDF
- create document
- add recipients
- place fields
- send for signature
- track status
- reuse templates

Defer HTML-first authoring until the standalone fundamentals are stable.

---

## 7. V1 Scope

### 7.1 Navigation

- Add `Documents` to `components/layout/module-switcher.tsx`
- Add a Documents shell consistent with Accounting and Calendar
- Add a Documents sidebar with:
  - `All Documents`
  - `Templates`
  - `Settings`

### 7.2 Primary routes

```txt
/documents                       -> primary document hub and list
/documents/templates             -> template library
/documents/[id]                  -> document detail
/documents/[id]/edit             -> field editor
/documents/settings              -> module settings
```

### 7.3 All Documents page

The landing page should combine lightweight summary metrics with the real working list.

Required list capabilities:

- show project-scoped and standalone docs in one table
- label standalone records clearly
- filter by status
- filter by source:
  - all
  - standalone
  - specific project
- search by title
- sort by created date, updated date, title, status, sent date, completed date

Recommended columns:

- title
- status
- source project or `Standalone`
- recipients summary
- created at
- updated at or last activity
- actions

### 7.4 Create standalone document flow

Required flow:

1. Upload PDF
2. Enter title and optional description
3. Add recipients
4. Open editor to place fields
5. Send

This should reuse the current contracts validator and send flow wherever possible.

### 7.5 Document detail

The detail page should show:

- document metadata
- recipients and signing state
- audit trail
- download actions
- void and remind actions where allowed
- direct path into field editing while draft

### 7.6 Field editor

Reuse the current field editor components and behavior. The main change should be the data source and access model, not a second editor implementation.

### 7.7 Template library

The template library should show:

- standalone templates the user owns
- project templates from projects the user can access

Required actions:

- view templates
- create standalone template from uploaded PDF
- edit fields
- create document from template

Defer advanced categorization, merge-field mapping UX expansion, and HTML template authoring unless already trivial with existing code.

#### 7.7.1 Merge-field behavior for standalone documents created from templates

Project templates may define merge fields that reference CRM entities (e.g., `person.full_name`, `organization.name`, `opportunity.amount`). When a standalone document is created from such a template:

- CRM merge fields are **not auto-populated** because standalone docs have no CRM links (§6.5)
- Fields that would have been auto-populated are instead rendered as **blank editable fields** with their label visible, so the user can fill them manually
- The `auto_populate_from` key is preserved in the field definition but skipped at population time when `projectId` is null
- System merge fields that do not require CRM context (e.g., `date.today`) are still auto-populated normally
- The template library UI should show a subtle indicator on project templates that use CRM merge fields, so the user understands they will need to fill those fields manually when creating a standalone document from that template

### 7.8 Settings

Keep settings minimal in v1:

- default notification preferences
- default signing order
- default reminder interval
- default expiration period

If these settings do not already exist in a reusable way, ship the module without a deep settings experience and add them later.

---

## 8. Contracts Subsystem Audit (Phase 0 Output)

### 8.1 Tables requiring `project_id` nullability

All five contract tables have `project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE`:

| Table | Migration | NOT NULL line |
|-------|-----------|---------------|
| `contract_templates` | `0087_contract_templates.sql` | line 6 |
| `contract_documents` | `0088_contract_documents.sql` | line 6 |
| `contract_recipients` | `0089_contract_recipients.sql` | line 6 |
| `contract_fields` | `0090_contract_fields.sql` | line 6 |
| `contract_audit_trail` | `0091_contract_audit_trail.sql` | line 7 |

Each table also has an index on `project_id` and RLS policies that join against `project_memberships` via `project_id`. The `contract_audit_trail` table has SELECT-only RLS; all inserts are done via the service-role client which bypasses RLS.

### 8.2 RLS policies to update

Every contract table has SELECT, INSERT, UPDATE, DELETE policies (audit_trail has SELECT only; inserts use the service-role client) that all filter via:

```sql
EXISTS (
  SELECT 1 FROM project_memberships pm
  WHERE pm.project_id = <table>.project_id
  AND pm.user_id = auth.uid()
)
```

Each policy must be replaced with an `OR` branch for standalone ownership.

For tables with `created_by` (`contract_documents`, `contract_templates`):

```sql
EXISTS (
  SELECT 1 FROM project_memberships pm
  WHERE pm.project_id = <table>.project_id
  AND pm.user_id = auth.uid()
)
OR (
  <table>.project_id IS NULL
  AND <table>.created_by = auth.uid()
)
```

For child tables without `created_by` (`contract_recipients`, `contract_fields`, `contract_audit_trail`), the standalone branch must join through the parent `contract_documents` row:

```sql
OR (
  <table>.project_id IS NULL
  AND EXISTS (
    SELECT 1 FROM contract_documents cd
    WHERE cd.id = <table>.document_id
    AND cd.created_by = auth.uid()
  )
)
```

Note: `contract_audit_trail` has SELECT-only RLS. All audit inserts use the service-role client which bypasses RLS entirely, so no INSERT policy is needed.

### 8.3 Library functions requiring null-safe updates

| File | Current signature / assumption | Required change |
|------|-------------------------------|-----------------|
| `lib/contracts/audit.ts` | `AuditEntry.project_id: string` | Change to `project_id: string \| null` |
| `lib/contracts/completion.ts` | `handleCompletion(documentId: string, projectId: string)` | Change to `projectId: string \| null`, use `projectId ?? 'standalone'` in storage paths |
| `lib/contracts/signing-token.ts` | `TokenValidationResult.recipient.project_id: string` and `document.project_id: string` | Change both to `string \| null` |
| `lib/contracts/notifications.ts` | `document.project_id` passed directly to audit and email | Add null-safe handling |
| `lib/contracts/pdf-flatten.ts` | `flattenPdf({ documentId, projectId })` | Verify if `projectId` is used in storage path construction; make nullable |
| `lib/contracts/certificate.ts` | `generateCertificate({ documentId, projectId })` | Same as above |
| `lib/contracts/merge-fields.ts` | `context.projectId` used in `.eq('project_id', ...)` | Skip CRM lookups when `projectId` is null (standalone docs have no CRM links per §6.5) |

### 8.4 Storage path strategy for standalone documents

Current pattern: `${projectId}/documents/${documentId}/filename.pdf`

For standalone documents, use: `standalone/${userId}/documents/${documentId}/filename.pdf`

This keeps the storage bucket organized without requiring a project ID.

### 8.5 Route handlers with `project_id` assumptions

15+ route files under `app/api/projects/[slug]/contracts/` contain 50+ `.eq('project_id', project.id)` calls. These routes remain unchanged — they continue to work as project-scoped endpoints. The new `app/api/documents/` routes provide a separate entry point that calls the same shared service functions but resolves access via `created_by` instead of project membership.

### 8.6 UI components requiring refactoring

| Component | File | Lines | Standalone blocker |
|-----------|------|-------|--------------------|
| `NewContractDialog` | `components/contracts/new-contract-dialog.tsx` | 237 | Reads `slug` from `useParams()` for API URLs |
| `ContractsPageClient` | `app/(dashboard)/projects/[slug]/contracts/contracts-page-client.tsx` | 312 | All API calls use project slug |
| `ContractDetailClient` | `app/(dashboard)/projects/[slug]/contracts/[id]/contract-detail-client.tsx` | 1128 | Reads `slug` + `id` from params; all API calls project-scoped |
| `FieldEditorClient` | `app/(dashboard)/projects/[slug]/contracts/[id]/edit/field-editor-client.tsx` | 749 | Same as above |

**Strategy:** Do NOT refactor these components to be dual-mode. Instead, create new thin wrapper components for the Documents module that call the standalone API routes and reuse shared sub-components where possible. The project-scoped components stay untouched.

### 8.7 Cron jobs requiring null-safe handling

| File | Issue |
|------|-------|
| `app/api/cron/contract-reminders/route.ts` | Passes `doc.project_id` to `insertAuditTrail()` and `handleCompletion()` without null checks. Must handle standalone documents in the reminder loop. |

### 8.8 Gmail sending compatibility

`lib/gmail/service.ts` `sendEmail()` already accepts `projectId?: string | null` — no change needed. Standalone documents can send via the user's Gmail connection without project context.

---

## 9. Data Model And Permissions

### 9.1 Migration: `XXXX_standalone_contracts.sql`

Policy names are taken from the actual migrations (`0087`–`0091`). The audit trail table has SELECT-only RLS; all inserts use the service-role client which bypasses RLS, so no INSERT policy is needed.

```sql
-- ============================================================
-- Make project_id nullable across the contracts subsystem
-- ============================================================

-- 1. contract_documents
ALTER TABLE contract_documents
  ALTER COLUMN project_id DROP NOT NULL;

-- 2. contract_templates
ALTER TABLE contract_templates
  ALTER COLUMN project_id DROP NOT NULL;

-- 3. contract_recipients
ALTER TABLE contract_recipients
  ALTER COLUMN project_id DROP NOT NULL;

-- 4. contract_fields
ALTER TABLE contract_fields
  ALTER COLUMN project_id DROP NOT NULL;

-- 5. contract_audit_trail
ALTER TABLE contract_audit_trail
  ALTER COLUMN project_id DROP NOT NULL;

-- ============================================================
-- Add indexes for standalone document queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_contract_documents_created_by
  ON contract_documents (created_by);

CREATE INDEX IF NOT EXISTS idx_contract_documents_standalone
  ON contract_documents (created_by)
  WHERE project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contract_templates_standalone
  ON contract_templates (created_by)
  WHERE project_id IS NULL;

-- ============================================================
-- Update RLS policies to support standalone access
-- ============================================================
-- Policy names match the originals in 0087–0091 migrations:
--   contract_documents:  contract_documents_select, _insert, _update, _delete
--   contract_templates:  contract_templates_select, _insert, _update, _delete
--   contract_recipients: contract_recipients_select, _insert, _update, _delete
--   contract_fields:     contract_fields_select, _insert, _update, _delete
--   contract_audit_trail: contract_audit_trail_select (SELECT only; inserts are service-role)

-- ── contract_documents ──────────────────────────────────────
-- Standalone branch: created_by = auth.uid()

DROP POLICY IF EXISTS "contract_documents_select" ON contract_documents;
CREATE POLICY "contract_documents_select" ON contract_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_documents.project_id IS NULL
      AND contract_documents.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_documents_insert" ON contract_documents;
CREATE POLICY "contract_documents_insert" ON contract_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_documents.project_id IS NULL
      AND contract_documents.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_documents_update" ON contract_documents;
CREATE POLICY "contract_documents_update" ON contract_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_documents.project_id IS NULL
      AND contract_documents.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_documents_delete" ON contract_documents;
CREATE POLICY "contract_documents_delete" ON contract_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_documents.project_id IS NULL
      AND contract_documents.created_by = auth.uid()
    )
  );

-- ── contract_templates ──────────────────────────────────────
-- Standalone branch: created_by = auth.uid()

DROP POLICY IF EXISTS "contract_templates_select" ON contract_templates;
CREATE POLICY "contract_templates_select" ON contract_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_templates.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_templates.project_id IS NULL
      AND contract_templates.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_templates_insert" ON contract_templates;
CREATE POLICY "contract_templates_insert" ON contract_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_templates.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_templates.project_id IS NULL
      AND contract_templates.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_templates_update" ON contract_templates;
CREATE POLICY "contract_templates_update" ON contract_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_templates.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_templates.project_id IS NULL
      AND contract_templates.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_templates_delete" ON contract_templates;
CREATE POLICY "contract_templates_delete" ON contract_templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_templates.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_templates.project_id IS NULL
      AND contract_templates.created_by = auth.uid()
    )
  );

-- ── contract_recipients ─────────────────────────────────────
-- Child table: no created_by column. Standalone branch joins
-- through parent contract_documents.created_by.

DROP POLICY IF EXISTS "contract_recipients_select" ON contract_recipients;
CREATE POLICY "contract_recipients_select" ON contract_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_recipients.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_recipients.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_recipients.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_recipients_insert" ON contract_recipients;
CREATE POLICY "contract_recipients_insert" ON contract_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_recipients.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_recipients.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_recipients.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_recipients_update" ON contract_recipients;
CREATE POLICY "contract_recipients_update" ON contract_recipients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_recipients.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_recipients.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_recipients.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_recipients_delete" ON contract_recipients;
CREATE POLICY "contract_recipients_delete" ON contract_recipients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_recipients.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_recipients.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_recipients.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

-- ── contract_fields ─────────────────────────────────────────
-- Child table: no created_by column. Same parent-join pattern.

DROP POLICY IF EXISTS "contract_fields_select" ON contract_fields;
CREATE POLICY "contract_fields_select" ON contract_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_fields.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_fields.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_fields.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_fields_insert" ON contract_fields;
CREATE POLICY "contract_fields_insert" ON contract_fields
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_fields.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_fields.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_fields.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_fields_update" ON contract_fields;
CREATE POLICY "contract_fields_update" ON contract_fields
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_fields.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_fields.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_fields.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_fields_delete" ON contract_fields;
CREATE POLICY "contract_fields_delete" ON contract_fields
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_fields.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_fields.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_fields.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

-- ── contract_audit_trail ────────────────────────────────────
-- SELECT only. All inserts use the service-role client (bypasses RLS).
-- No INSERT/UPDATE/DELETE policies exist or are needed.

DROP POLICY IF EXISTS "contract_audit_trail_select" ON contract_audit_trail;
CREATE POLICY "contract_audit_trail_select" ON contract_audit_trail
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_audit_trail.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_audit_trail.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_audit_trail.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );
```

### 9.2 Post-migration checklist

1. Regenerate TypeScript types: `npx supabase gen types typescript --db-url '...' > types/database.ts`
2. Run `npm run typecheck` — expect breakage in `types/contract.ts`, `lib/contracts/audit.ts`, `lib/contracts/completion.ts`, `lib/contracts/signing-token.ts`, `lib/contracts/notifications.ts`
3. Fix all type errors (see §8.3 for the specific changes needed)
4. Verify existing project-scoped contract flows still work (RLS policies must not regress)

### 9.3 Query model for aggregate list

Create a shared helper in `lib/contracts/access.ts`:

```typescript
/**
 * Returns a Supabase query builder that fetches documents
 * the user can access: project-scoped (via membership) + standalone (via created_by).
 *
 * Uses the authenticated client so RLS handles the filtering.
 */
export function accessibleDocumentsQuery(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('contract_documents')
    .select('*, projects(name, slug)')
    .is('deleted_at', null)
    .or(`project_id.not.is.null,created_by.eq.${userId}`);
  // RLS handles the project membership check for project-scoped docs.
  // The or() ensures standalone docs (project_id IS NULL) are included
  // only if created_by matches (enforced by RLS).
}
```

---

## 10. API Strategy

### 10.1 Shared contracts service layer

Create `lib/contracts/service.ts` with extracted operations:

```typescript
// lib/contracts/service.ts

export async function createDocument(params: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string | null;
  title: string;
  description?: string;
  signingOrderType?: 'sequential' | 'parallel';
  filePath: string;
  originalFileName: string;
  pageCount: number;
  customFields?: Record<string, string>;
}): Promise<ContractDocument>

export async function getDocument(params: {
  supabase: SupabaseClient;
  documentId: string;
  userId: string;
}): Promise<ContractDocumentWithRelations | null>

export async function listDocuments(params: {
  supabase: SupabaseClient;
  userId: string;
  projectId?: string | null; // null = standalone only, undefined = all
  status?: ContractDocumentStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<{ documents: ContractDocumentWithRelations[]; total: number }>

export async function addRecipient(params: {
  supabase: SupabaseClient;
  documentId: string;
  projectId: string | null;
  name: string;
  email: string;
  role: string;
  signingOrder?: number;
  personId?: string;
}): Promise<ContractRecipient>

export async function saveFields(params: {
  supabase: SupabaseClient;
  documentId: string;
  projectId: string | null;
  fields: ContractFieldInput[];
}): Promise<void>

export async function sendDocument(params: {
  supabase: SupabaseClient;
  documentId: string;
  projectId: string | null;
  userId: string;
  gmailConnectionId: string;
  message?: string;
}): Promise<void>

export async function voidDocument(params: {
  supabase: SupabaseClient;
  documentId: string;
  userId: string;
  reason?: string;
}): Promise<void>

export async function getAuditTrail(params: {
  supabase: SupabaseClient;
  documentId: string;
}): Promise<ContractAuditTrail[]>

export async function remindRecipients(params: {
  supabase: SupabaseClient;
  documentId: string;
  projectId: string | null;
  userId: string;
}): Promise<void>

export async function cloneDocument(params: {
  supabase: SupabaseClient;
  documentId: string;
  projectId: string | null;
  userId: string;
}): Promise<ContractDocument>

export async function uploadDocumentPdf(params: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string | null;
  file: File;
}): Promise<{ filePath: string; pageCount: number; originalFileName: string }>
```

### 10.2 Migration path for existing project routes

**Do NOT rewrite existing project routes immediately.** The shared service layer is extracted incrementally:

1. Create `lib/contracts/service.ts` with the function signatures above
2. Implement each function by extracting logic from the corresponding project route
3. Update the project routes to call the shared functions
4. Build the new Documents API routes that also call the shared functions

This can be done route-by-route rather than all at once.

### 10.3 New top-level routes

```txt
app/api/documents/
  route.ts                                → GET (list), POST (create)
  upload/route.ts                         → POST (upload PDF)
  [id]/route.ts                           → GET, PATCH, DELETE
  [id]/send/route.ts                      → POST
  [id]/fields/route.ts                    → POST, PATCH, DELETE
  [id]/recipients/route.ts               → GET, POST
  [id]/recipients/[rid]/route.ts         → PATCH, DELETE
  [id]/audit-trail/route.ts              → GET
  [id]/remind/route.ts                    → POST
  [id]/void/route.ts                      → POST
  [id]/clone/route.ts                     → POST
  [id]/download/route.ts                  → GET
  [id]/certificate/route.ts              → GET
  templates/route.ts                      → GET (list all accessible), POST (create standalone)
  templates/[tid]/route.ts               → GET, PATCH, DELETE
  templates/[tid]/create-document/route.ts → POST
```

### 10.4 Auth model for Documents API routes

Every Documents API route:

1. Gets the authenticated user via `supabase.auth.getUser()`
2. For document-specific routes (`/documents/[id]/*`), fetches the document and verifies:
   - If `project_id` is non-null → verify user has project membership
   - If `project_id` is null → verify `created_by === user.id`
3. RLS provides defense-in-depth, but route-level checks give clear 403 errors

Create a shared auth helper in `lib/contracts/access.ts`:

```typescript
export async function verifyDocumentAccess(
  supabase: SupabaseClient,
  documentId: string,
  userId: string
): Promise<{ document: ContractDocument; authorized: boolean }>
```

---

## 11. UX Requirements

### 11.1 Status model

Continue using the existing document statuses: `draft`, `sent`, `viewed`, `partially_signed`, `completed`, `declined`, `expired`, `voided`.

### 11.2 Source labeling

Every document row and detail view should clearly identify one of:

- project name (linked to project if user has access)
- `Standalone`

### 11.3 Empty states

Required empty states:

- no accessible documents yet → CTA: "Upload your first document"
- no standalone templates yet → CTA: "Create a template"
- no search/filter results → CTA: "Clear filters"

### 11.4 Editing restrictions

Draft documents can be edited. Sent, completed, declined, expired, and voided documents should remain read-only.

### 11.5 Summary metrics

At the top of the `/documents` page, show 4 stat cards:

- **Total documents** — count of all accessible docs
- **Awaiting signature** — count where status in (`sent`, `viewed`, `partially_signed`)
- **Completed this month** — count where status = `completed` and `completed_at` is in current month
- **Expiring soon** — count where `expires_at` is within 7 days

### 11.6 Bulk actions (Tier 2)

Deferred to Tier 2 (Phase 7). When shipped, select multiple documents → available actions:

- **Remind** — send reminders for all selected docs that are awaiting signature
- **Void** — void all selected draft/sent docs
- **Delete** — soft-delete all selected draft docs

---

## 12. File Inventory

### 12.1 New files to create

**Navigation & shell (Phase 1):**

| # | File | Purpose |
|---|------|---------|
| 1 | `app/(dashboard)/documents/layout.tsx` | Auth check, render shell |
| 2 | `app/(dashboard)/documents/documents-shell.tsx` | Shell wrapper (header + sidebar + children) |
| 3 | `components/layout/documents-header.tsx` | ModuleSwitcher + NotificationBell + UserMenu |
| 4 | `components/layout/documents-sidebar.tsx` | Nav: All Documents, Templates, Settings + AI Agent button |

**Database (Phase 2):**

| # | File | Purpose |
|---|------|---------|
| 5 | `supabase/migrations/XXXX_standalone_contracts.sql` | Nullable project_id + RLS updates |

**Shared services (Phase 3):**

| # | File | Purpose |
|---|------|---------|
| 6 | `lib/contracts/service.ts` | Extracted reusable contract operations |
| 7 | `lib/contracts/access.ts` | `verifyDocumentAccess()`, `accessibleDocumentsQuery()` |

**API routes (Phase 4):**

| # | File | Purpose |
|---|------|---------|
| 8 | `app/api/documents/route.ts` | GET list + POST create |
| 9 | `app/api/documents/upload/route.ts` | POST upload PDF |
| 10 | `app/api/documents/[id]/route.ts` | GET, PATCH, DELETE |
| 11 | `app/api/documents/[id]/send/route.ts` | POST send |
| 12 | `app/api/documents/[id]/fields/route.ts` | POST, PATCH, DELETE fields |
| 13 | `app/api/documents/[id]/recipients/route.ts` | GET, POST recipients |
| 14 | `app/api/documents/[id]/recipients/[rid]/route.ts` | PATCH, DELETE recipient |
| 15 | `app/api/documents/[id]/audit-trail/route.ts` | GET audit trail |
| 16 | `app/api/documents/[id]/remind/route.ts` | POST remind |
| 17 | `app/api/documents/[id]/void/route.ts` | POST void |
| 18 | `app/api/documents/[id]/clone/route.ts` | POST clone |
| 19 | `app/api/documents/[id]/download/route.ts` | GET download |
| 20 | `app/api/documents/[id]/certificate/route.ts` | GET certificate |
| 21 | `app/api/documents/templates/route.ts` | GET list + POST create |
| 22 | `app/api/documents/templates/[tid]/route.ts` | GET, PATCH, DELETE |
| 23 | `app/api/documents/templates/[tid]/create-document/route.ts` | POST create from template |

**UI pages (Phase 5):**

| # | File | Purpose |
|---|------|---------|
| 24 | `app/(dashboard)/documents/page.tsx` | All documents list (server wrapper) |
| 25 | `app/(dashboard)/documents/documents-page-client.tsx` | Client component: list + filters + stats |
| 26 | `app/(dashboard)/documents/[id]/page.tsx` | Document detail (server wrapper) |
| 27 | `app/(dashboard)/documents/[id]/document-detail-client.tsx` | Client component: detail view |
| 28 | `app/(dashboard)/documents/[id]/edit/page.tsx` | Field editor (server wrapper) |
| 29 | `app/(dashboard)/documents/[id]/edit/field-editor-client.tsx` | Client component: field editor |
| 30 | `app/(dashboard)/documents/templates/page.tsx` | Template library (server wrapper) |
| 31 | `app/(dashboard)/documents/templates/templates-page-client.tsx` | Client component: template list |
| 32 | `components/documents/new-document-dialog.tsx` | Upload PDF + create standalone doc dialog |

**Settings (Phase 6):**

| # | File | Purpose |
|---|------|---------|
| 33 | `app/(dashboard)/documents/settings/page.tsx` | Settings page |

**MCP & Chat (Phase 7):**

| # | File | Purpose |
|---|------|---------|
| 34 | `lib/mcp/tools/documents.ts` | MCP tools for standalone documents |

### 12.2 Files to modify

| # | File | Change |
|---|------|--------|
| 1 | `components/layout/module-switcher.tsx` | Add Documents entry with `FileSignature` icon |
| 2 | `lib/contracts/audit.ts` | `project_id: string` → `string \| null` |
| 3 | `lib/contracts/completion.ts` | `projectId: string` → `string \| null`, null-safe storage paths |
| 4 | `lib/contracts/signing-token.ts` | `project_id: string` → `string \| null` in interfaces |
| 5 | `lib/contracts/notifications.ts` | Null-safe `project_id` handling |
| 6 | `lib/contracts/pdf-flatten.ts` | Null-safe `projectId` in storage paths |
| 7 | `lib/contracts/certificate.ts` | Null-safe `projectId` in storage paths |
| 8 | `lib/contracts/merge-fields.ts` | Skip CRM lookups when `projectId` is null |
| 9 | `types/contract.ts` | Update interfaces for nullable `project_id` |
| 10 | `types/database.ts` | Auto-regenerated |
| 11 | `app/api/cron/contract-reminders/route.ts` | Null-safe `project_id` in audit + completion calls |
| 12 | `lib/mcp/server.ts` | Register documents tools |
| 13 | `lib/chat/tool-registry.ts` | Add documents tool category |
| 14 | `hooks/use-chat.ts` | Add to `MUTATING_TOOLS` |
| 15 | `components/chat/chat-settings.tsx` | Add documents category |
| 16 | `components/chat/chat-message-list.tsx` | Add documents color |
| 17 | `lib/chat/system-prompt.ts` | Add documents context |
| 18 | `components/layout/mobile-sidebar.tsx` | Add Documents module sidebar case |

---

## 13. Delivery Plan

### Phase 0: Contracts subsystem audit ✅ (completed in §8)

### Phase 1: Navigation and shell

**Goal:** Documents module appears in the dropdown and renders a shell with sidebar.

Tasks:
- [ ] Add `{ id: 'documents', label: 'Documents', icon: FileSignature, href: '/documents', matchPrefix: '/documents' }` to `module-switcher.tsx`
- [ ] Create `documents-header.tsx` following `accounting-header.tsx` pattern
- [ ] Create `documents-sidebar.tsx` following `accounting-sidebar.tsx` pattern (links: All Documents, Templates, Settings)
- [ ] Create `documents-shell.tsx` following `accounting-shell.tsx` pattern
- [ ] Create `layout.tsx` with auth check
- [ ] Create placeholder `page.tsx` with "Coming soon" or skeleton
- [ ] Update `mobile-sidebar.tsx` if needed

### Phase 2: Schema and RLS

**Goal:** `project_id` is nullable across all contract tables with correct RLS.

Tasks:
- [ ] Write migration `XXXX_standalone_contracts.sql` per §9.1
- [ ] Run deallocate + `db push`
- [ ] Regenerate types
- [ ] Update `lib/contracts/audit.ts` — `project_id: string | null`
- [ ] Update `lib/contracts/completion.ts` — nullable `projectId`, use `projectId ?? 'standalone/' + userId` in paths
- [ ] Update `lib/contracts/signing-token.ts` — nullable `project_id` in interfaces
- [ ] Update `lib/contracts/notifications.ts` — null-safe handling
- [ ] Update `lib/contracts/pdf-flatten.ts` — nullable `projectId` in storage paths
- [ ] Update `lib/contracts/certificate.ts` — nullable `projectId` in storage paths
- [ ] Update `lib/contracts/merge-fields.ts` — skip CRM lookups when null
- [ ] Update `types/contract.ts` — nullable `project_id` where needed
- [ ] Update `app/api/cron/contract-reminders/route.ts` — null-safe handling
- [ ] Run `npm run typecheck` and fix all errors
- [ ] Manually verify existing project contract flows work

### Phase 3: Shared services

**Goal:** Core contract operations are callable without project context.

Tasks:
- [ ] Create `lib/contracts/access.ts` with `verifyDocumentAccess()` and `accessibleDocumentsQuery()`
- [ ] Create `lib/contracts/service.ts` with extracted operations (start with `createDocument`, `listDocuments`, `getDocument`, `uploadDocumentPdf`)
- [ ] Extract `addRecipient`, `saveFields`, `sendDocument` from existing routes
- [ ] Extract `voidDocument`, `remindRecipients`, `cloneDocument`, `getAuditTrail`
- [ ] Refactor existing project routes to call shared service functions (incremental, route-by-route)

### Phase 4: Documents API

**Goal:** Full standalone document CRUD via `/api/documents/*`.

Tasks:
- [ ] `app/api/documents/route.ts` — GET (list with filters/pagination/sorting) + POST (create)
- [ ] `app/api/documents/upload/route.ts` — POST (upload PDF to standalone storage path)
- [ ] `app/api/documents/[id]/route.ts` — GET, PATCH, DELETE
- [ ] `app/api/documents/[id]/send/route.ts` — POST
- [ ] `app/api/documents/[id]/fields/route.ts` — POST, PATCH, DELETE
- [ ] `app/api/documents/[id]/recipients/route.ts` — GET, POST
- [ ] `app/api/documents/[id]/recipients/[rid]/route.ts` — PATCH, DELETE
- [ ] `app/api/documents/[id]/audit-trail/route.ts` — GET
- [ ] `app/api/documents/[id]/remind/route.ts` — POST
- [ ] `app/api/documents/[id]/void/route.ts` — POST
- [ ] `app/api/documents/[id]/clone/route.ts` — POST
- [ ] `app/api/documents/[id]/download/route.ts` — GET
- [ ] `app/api/documents/[id]/certificate/route.ts` — GET
- [ ] `app/api/documents/templates/route.ts` — GET, POST
- [ ] `app/api/documents/templates/[tid]/route.ts` — GET, PATCH, DELETE
- [ ] `app/api/documents/templates/[tid]/create-document/route.ts` — POST

### Phase 5: Documents UI

**Goal:** Fully functional document management UI.

Tasks:
- [ ] `documents-page-client.tsx` — Summary stats cards + data table with columns, filters, search, sort, pagination
- [ ] `new-document-dialog.tsx` — Upload PDF dialog (reuse patterns from `new-contract-dialog.tsx` but call `/api/documents/*`)
- [ ] `document-detail-client.tsx` — Metadata, recipients, audit trail, actions (adapt from `contract-detail-client.tsx` calling `/api/documents/*`)
- [ ] `field-editor-client.tsx` — Visual PDF field editor (adapt from existing, calling `/api/documents/*`)
- [ ] `templates-page-client.tsx` — Template list showing standalone + project templates, create from template; show indicator on project templates that use CRM merge fields (§7.7.1)
- [ ] Wire up all server wrapper pages with Suspense + skeletons
- [ ] Implement empty states per §11.3

### Phase 6: Settings and polish

Tasks:
- [ ] `documents/settings/page.tsx` — Default notification prefs, signing order, reminder interval, expiration
- [ ] Verify audit trail works for standalone docs (create, send, view, sign, complete flow)
- [ ] Verify reminders cron handles standalone docs
- [ ] Verify completion flow (flatten PDF, certificate, receipt emails) for standalone docs
- [ ] Verify public signing flow (`/sign/[token]`) works for standalone docs
- [ ] Polish: loading states, error boundaries, responsive layout

### Phase 7: Bulk actions, MCP, and chat agent tools (Tier 2)

**Goal:** Integration features required by CLAUDE.md. Depends on Tier 1 (Phases 1–6) being stable.

Tasks:
- [ ] Implement bulk actions on the documents list: remind, void, delete (§11.6)
- [ ] Create `lib/mcp/tools/documents.ts` with tools: `documents.list`, `documents.get`, `documents.create`, `documents.send`, `documents.void`, `documents.audit_trail`, `documents.templates.list`
- [ ] Register in `lib/mcp/server.ts`
- [ ] Add chat agent tools in `lib/chat/tool-registry.ts`
- [ ] Update `MUTATING_TOOLS` in `hooks/use-chat.ts`
- [ ] Add documents category to `components/chat/chat-settings.tsx`
- [ ] Add documents color to `components/chat/chat-message-list.tsx`
- [ ] Add documents context to `lib/chat/system-prompt.ts`

### Phase 8: Automation events (Tier 2)

Tasks:
- [ ] Emit `document.created`, `document.sent`, `document.viewed`, `document.signed`, `document.completed`, `document.declined`, `document.voided` from Documents API routes via `emitAutomationEvent()`
- [ ] Verify existing project-scoped automation events still fire correctly

---

## 14. Risks And Mitigations

### 14.1 Nullability ripple risk

Risk: `project_id` is assumed to exist across 5 tables, 20+ RLS policies, 50+ route filter calls, 7 library functions, and 1 cron job.

Mitigation: Phase 0 audit is complete (§8). Phase 2 addresses every identified location. Run typecheck after migration to catch stragglers.

### 14.2 Permission leakage risk

Risk: Standalone records could become visible to the wrong users if RLS is inconsistent across tables.

Mitigation: RLS policies for child tables (`recipients`, `fields`, `audit_trail`) join through `contract_documents.created_by` rather than having independent ownership. Test all CRUD operations for both project and standalone records.

### 14.3 Scope creep risk

Risk: The module turns into a full document-authoring platform.

Mitigation: Keep v1 PDF-first. Defer HTML authoring, AI tooling, and advanced automation surfaces.

### 14.4 Data-link ambiguity risk

Risk: Standalone docs linked to project-scoped CRM records create confusing permissions.

Mitigation: Standalone docs have `organization_id`, `person_id`, `opportunity_id` all NULL. Merge fields skip CRM lookups for standalone docs.

### 14.5 Storage path collision risk

Risk: Standalone documents use a different storage path pattern than project documents.

Mitigation: Standalone path is `standalone/${userId}/documents/${documentId}/...` which is disjoint from `${projectId}/documents/...`. The `contracts` storage bucket serves both.

---

## 15. Acceptance Criteria

### Tier 1 (Phases 1–6) — ship gate

- [ ] User can open a top-level Documents module from the module switcher
- [ ] User can see a unified list of accessible project documents plus standalone documents
- [ ] User can filter by status, source (all / standalone / specific project), and search by title
- [ ] User can sort by created date, updated date, title, status
- [ ] User can create a standalone document by uploading a PDF
- [ ] User can add recipients to a standalone document
- [ ] User can place fields on a standalone document using the visual editor
- [ ] User can send a standalone document for signature via Gmail
- [ ] Recipients can sign standalone documents via `/sign/[token]`
- [ ] Signing completion generates a flattened PDF and certificate for standalone docs
- [ ] User can view audit trail for standalone documents
- [ ] User can void and remind on standalone documents
- [ ] User can clone a standalone document
- [ ] User can create and use standalone templates
- [ ] Project templates with CRM merge fields render those fields as blank editables when used in standalone docs (§7.7.1)
- [ ] Existing project-based contracts continue to work unchanged
- [ ] Standalone access is correctly restricted by RLS — only `created_by` user can see their standalone docs; `owner_id` is not used for standalone access (§6.4)
- [ ] Documents with no project are labeled clearly as "Standalone" throughout the UI
- [ ] Summary metrics show correct counts
- [ ] Empty states render with appropriate CTAs

### Tier 2 (Phases 7–8) — integration gate

- [ ] Bulk actions work (remind, void, delete)
- [ ] MCP tools work for standalone documents
- [ ] Chat agent tools work for standalone documents
- [ ] Automation events fire for standalone document mutations

---

## 16. Open Questions

- ~~Should `owner_id` grant full access to standalone docs in v1, or should standalone ownership stay creator-only?~~ **Resolved (§6.4):** Creator-only via `created_by`. `owner_id` is not used for standalone access in v1.
- Should project templates be editable from the Documents module, or only viewable and usable there?
- Do we want `/documents` to be list-first permanently, or revisit a separate overview page after usage data exists?
