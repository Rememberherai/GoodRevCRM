# Accounting Platform — End-to-End Audit Report v3.0

**Last updated:** 2026-03-29 (v3.0 — twelfth sweep)
**Scope:** Eleven full-pass sweeps across all accounting migrations (0096–0135), all TypeScript business logic, MCP tools, CRM bridge, validators, and API routes (35+ files). Every finding was directly verified against source before inclusion. This is the living document — updated in place each sweep.

---

## 1. v3.0 Update (Twelfth Pass — Deferred Bug Fixes)

**Bugs fixed this pass (migration 0174 + TypeScript):**
- **BUG-D** — `create_invoice` now has service-role path: added `p_created_by UUID DEFAULT NULL`, mirrors `create_bill`. `processRecurringTransactions` now passes `p_created_by: rec.created_by`.
- **BUG-E** — `void_journal_entry` now accepts optional `p_calling_user`, uses `COALESCE(auth.uid(), p_calling_user)`. No more FK violation from service role.
- **BUG-A / BUG-Z** — `InvoicePdfData.discount_amount` is now optional (`discount_amount?: number`). Hardcoded `discount_amount: 0` removed from the email route.
- **BUG-BE** — Opening-balance prior query now has `.limit(50000)` guard against unbounded scans.
- **BUG-F** — `createGoodRevBill` in `accounting-bridge.ts` now verifies project membership (role ≠ viewer) before creating a bill.
- **BUG-I** — Invoice PDF now renders a truncation indicator when line items are cut off, instead of silently rendering totals for the full list.

**Previously fixed (migration 0173, commit 3ac04e4):**
- BUG-BN, BUG-BP, BUG-BF, BUG-J, BUG-U, BUG-V, BUG-P, BUG-AZ, BUG-K, BUG-BH, BUG-BJ, BUG-AS, BUG-AJ, BUG-AI, BUG-BK, BUG-S, BUG-T, BUG-AQ, BUG-AX, BUG-G, BUG-H, BUG-L, BUG-Q

**v2.9 (previous):**
- BUG-BP: `contract_documents`, `contract_recipients`, and `contract_fields` RLS write policies grant INSERT/UPDATE/DELETE to any project member — viewers can mutate contracts at the DB layer. The send and void API routes add no role check beyond project membership, so viewers can also send and void contracts through the API. (HIGH)

**Corrections (v2.9):**
- BUG-BN fix snippet — the suggested code used `'editor'` which is not a valid `project_role`. Corrected to `'member'` (the actual enum: `owner|admin|member|viewer`).

---

### BUG-BP: Contract tables grant write access to all project members — viewers can mutate contracts

**Severity: HIGH**
**Files:** `supabase/migrations/0088_contract_documents.sql:75–100`, `0089_contract_recipients.sql:59–83`, `0090_contract_fields.sql:49–70`, `app/api/projects/[slug]/contracts/[id]/send/route.ts:27`, `app/api/projects/[slug]/contracts/[id]/void/route.ts:11`
**Verified:** Directly read

All three contract tables (`contract_documents`, `contract_recipients`, `contract_fields`) define their INSERT/UPDATE/DELETE RLS policies using the same pattern:

```sql
EXISTS (
    SELECT 1 FROM public.project_memberships pm
    WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
)
```

This grants write access to *any* project member regardless of role. A user with `role = 'viewer'` can INSERT a new contract document, UPDATE its content, or DELETE recipients and fields directly against the database.

The `send` and `void` API routes compound this: both confirm the user is authenticated and the project exists (via user-scoped RLS), then immediately switch to `createServiceClient()` for mutations with no role check in between. A viewer can call `POST /api/projects/[slug]/contracts/[id]/send` or `.../void` and successfully send or void contracts.

The `project_role` enum is `'owner' | 'admin' | 'member' | 'viewer'`. The intended read-only designation for viewer is enforced nowhere in the contracts surface.

**Fix:** In all three migration files, replace the write policy membership check with a role-filtered version:
```sql
EXISTS (
    SELECT 1 FROM public.project_memberships pm
    WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'member')
)
```
In the `send` and `void` routes, add a role check after confirming the project:
```typescript
const { data: membership } = await supabase
  .from('project_memberships')
  .select('role')
  .eq('project_id', project.id)
  .eq('user_id', user.id)
  .single();
if (!membership || membership.role === 'viewer') {
  return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
}
```

---

## 2. v2.8 New Findings (Tenth Pass)

**New confirmed findings this sweep:**
- BUG-BN: `POST /api/projects/[slug]/email/rematch` has no role check — any authenticated project member can trigger a service-role rewrite of `emails.person_id` (HIGH)
- BUG-BO: `getAccountingContext` always picks the oldest membership — users invited to multiple accounting companies have no way to switch (MEDIUM)

**Stale entries corrected this sweep:**
- BUG-B — **RESOLVED**. Migration `0110` explicitly moved balance maintenance to the `sync_bank_account_balance` trigger (AFTER INSERT/UPDATE/DELETE on `bank_transactions`). The comment at line 3–5 confirms: "Stop reconciliation completion from overwriting live current balance." `complete_reconciliation` correctly does not touch `current_balance`. The original bug claim was wrong in context.
- BUG-C — **RESOLVED**. Migration `0123_recurring_transactions_fixes.sql:35–52` already replaced the permissive policies with `has_accounting_role(company_id, 'member')` for INSERT/UPDATE and `has_accounting_role(company_id, 'admin')` for DELETE.

**Still confirmed from v2.7:**
- BUG-BH: `processRecurringTransactions` creates document even when `next_date > end_date` — end_date check runs after creation, not before (MEDIUM)
- BUG-BJ: `batch-import` journal entries route has no atomicity — partial commits possible; early entries are saved even if later ones fail (MEDIUM)
- BUG-BK: Bank account CSV import has no duplicate detection — importing the same file twice silently creates duplicate transactions (LOW)

**Dismissed subagent claims (prior sweeps):**
- BUG-BG — duplicate of BUG-C (now resolved)
- BUG-BI — false positive; optional chaining `settings?.default_payment_terms ?? 30` handles null settings gracefully
- BUG-BL — duplicate of BUG-BE (GL unbounded query, already known)
- BUG-BM — duplicate of BUG-AJ (create_bill service-role auth gap, already known)

---

### BUG-BH: `processRecurringTransactions` creates document after `end_date` has passed

**Severity: MEDIUM**
**File:** `lib/accounting/recurring.ts:172–188`
**Verified:** Directly read

The `shouldDeactivate` check at line 178 evaluates whether `toDateStr(nextDate) > rec.end_date` — where `nextDate` is the **advanced** next occurrence (after the current run), not the current `rec.next_date`. This means the end_date check only fires *after* the document is created and the schedule is advanced.

If a recurring template has `end_date = '2026-03-28'` and `next_date = '2026-03-29'` (today), the cron fetches it (`.lte('next_date', today)` matches), creates the invoice/bill, then deactivates the template. The document should never have been created — the schedule had already expired.

**Fix:** Add a pre-creation guard before line 131:
```typescript
if (rec.end_date && rec.next_date > rec.end_date) {
  // Schedule already expired; deactivate without creating
  await supabase.from('recurring_transactions').update({ is_active: false }).eq('id', rec.id);
  continue;
}
```

---

### BUG-BJ: Batch journal entry import has no transaction atomicity

**Severity: MEDIUM**
**File:** `app/api/accounting/journal-entries/batch-import/route.ts:58–115`
**Verified:** Directly read

The route processes entries in a `for` loop, calling `create_journal_entry` RPC for each independently. There is no wrapping transaction. If entry 1 and 2 succeed but entry 3 fails (e.g., invalid account_id, unbalanced lines), entries 1 and 2 remain committed and entry 3 is skipped. The response correctly reports the partial result, but there is no way for the caller to atomically roll back.

The response returns `{ success: 2, errors: 1, results: [...] }` — so this is by design (best-effort batch), but it is undocumented and creates a footgun for users who expect all-or-nothing import semantics.

**Fix:** Either (a) document that batch import is best-effort and non-atomic, or (b) add an `atomic: true` flag that pre-validates all entries before creating any, returning an error if any fail validation.

---

### BUG-BK: CSV bank transaction import has no duplicate detection

**Severity: LOW**
**File:** `app/api/accounting/bank-accounts/[id]/import/route.ts:56–80`
**Verified:** Directly read

Each import generates a fresh `batchId = crypto.randomUUID()` (line 56) and inserts all parsed rows with that batch ID. There is no check for existing transactions with the same `(bank_account_id, transaction_date, amount, description)`. Importing the same CSV file twice creates duplicate `bank_transactions` rows with different `import_batch_id` values.

The `bank_transactions` table has no unique constraint to prevent this. Users who re-import a monthly statement (e.g., to recover from a mapping error) will silently double all their transactions, corrupting reconciliation.

**Fix:** Add a unique index on `(bank_account_id, transaction_date, amount, description)` with `ON CONFLICT DO NOTHING`, or check for existing rows with matching batch fingerprint before inserting.

---

### BUG-BN: `POST /api/projects/[slug]/email/rematch` missing role check — privilege escalation

**Severity: HIGH**
**File:** `app/api/projects/[slug]/email/rematch/route.ts:14–99`
**Verified:** Directly read

The handler authenticates the user (`auth.getUser()`) and confirms the project exists via the user-scoped client (which enforces project membership via RLS). However, it performs zero role/permission checking beyond confirming the user is a member of the project. Any role — including viewer — can invoke this route.

After confirming the project exists, the route immediately switches to `createServiceClient()` (the Supabase service role key, which bypasses all RLS) and:
1. Reads all unmatched `emails` for the project
2. Reads all `people` by email for the project
3. **Writes** `emails.person_id` for every match via `serviceClient.from('emails').update({ person_id: ... })`

A read-only viewer can therefore overwrite `person_id` on any email in the project, remapping contact associations across the entire history. There is no `has_project_role('editor')` or equivalent guard anywhere in the file.

**Fix:** Add a role check after the project lookup:
```typescript
const { data: membership } = await supabase
  .from('project_memberships')
  .select('role')
  .eq('project_id', project.id)
  .eq('user_id', user.id)
  .single();

if (!membership || !['owner', 'admin', 'member'].includes(membership.role)) {
  return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
}
```

---

### BUG-BO: `getAccountingContext` always selects oldest company membership — no multi-company switching

**Severity: MEDIUM**
**File:** `lib/accounting/helpers.ts:35–41`, `app/api/accounting/company/route.ts:24–30`
**Verified:** Directly read

`getAccountingContext` resolves the user's accounting company by fetching their memberships ordered by `created_at ASC` with `.limit(1)`. The `GET /api/accounting/company` endpoint does the same. The schema (`accounting_company_memberships`) supports multiple memberships per user — a user can be invited to multiple accounting companies. However:

- All API routes call `getAccountingContext` and receive only the oldest membership
- The company endpoint always returns the oldest membership
- There is no `company_id` parameter or session-level company selector

An invited member with access to two companies is always locked into whichever company they joined first. They have no way to access or switch to the second company through the API. Their data in the second company is completely unreachable.

**Fix:** Pass an explicit `company_id` header or query parameter throughout the request chain. Fall back to oldest-first only when no preference is supplied. A `GET /api/accounting/companies` endpoint listing all memberships is also needed before switching is possible.

---

## 2. v2.6 New Findings (Eighth Pass)

---

### BUG-BF: `check_je_balance_on_post` allows all-zero-amount journal entries to post

**Severity: HIGH**
**File:** `supabase/migrations/0099_journal_entries.sql:189–218`
**Verified:** Directly read

```sql
IF line_count < 2 THEN
    RAISE EXCEPTION ...
END IF;
IF total_debit != total_credit THEN
    RAISE EXCEPTION ...
END IF;
```

The trigger validates at least 2 lines and that debits = credits. It does **not** check that `total_debit > 0`. The `je_line_debit_or_credit` constraint (`(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)`) explicitly permits both-zero lines.

A JE with two `{debit: 0, credit: 0}` lines passes all checks: `line_count = 2 ≥ 2`, and `0 = 0`. It posts successfully with an allocated JE number, consuming a sequence slot and appearing in all GL queries, while representing zero economic value.

**Impact:** Phantom JEs inflate audit trail, consume document numbers, and can be used to falsify entry counts in reports.

**Fix:** Add to `check_je_balance_on_post` after the balance check:
```sql
IF total_debit = 0 THEN
    RAISE EXCEPTION 'Journal entry must have at least one non-zero amount line';
END IF;
```

---

## 2. Previously Confirmed Findings (v2.5 and earlier)

### BUG-AS: `journal_entry_lines.exchange_rate` allows zero — silently produces zero base amounts

**Severity: MEDIUM**
**File:** `supabase/migrations/0099_journal_entries.sql:60`
**Verified:** Directly read

```sql
exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1.0,
-- No CHECK (exchange_rate > 0)
```

The `compute_je_line_base_amounts` trigger computes:
```sql
NEW.base_debit  := ROUND(NEW.debit  * NEW.exchange_rate, 2);
NEW.base_credit := ROUND(NEW.credit * NEW.exchange_rate, 2);
```

If `exchange_rate = 0`, both `base_debit` and `base_credit` are set to 0 regardless of the local debit/credit amounts. The `check_je_balance_on_post` trigger verifies `SUM(base_debit) = SUM(base_credit)` — which trivially holds (0 = 0). The JE posts successfully with entirely zeroed base amounts.

This means a foreign-currency JE with `exchange_rate = 0` posts silently, recording the transaction in the local currency but leaving all base-amount (reporting currency) balances at zero. Every GL report, trial balance, and financial statement denominated in base currency will omit this transaction's amounts entirely.

The existing `debit >= 0` and `credit >= 0` CHECK constraints don't help here.

**Fix:** Add `CHECK (exchange_rate > 0)` to `journal_entry_lines`:
```sql
exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0),
```

---

### BUG-AX: `void_invoice` and `void_bill` exclude `partially_paid` from voidable statuses

**Severity: LOW**
**Files:** `supabase/migrations/0107_void_invoice_rpc.sql:28`, `supabase/migrations/0112_bills.sql:834`
**Verified:** Directly read

```sql
-- void_invoice (0107)
IF v_invoice.status NOT IN ('sent', 'overdue') THEN
    RAISE EXCEPTION 'Cannot void a % invoice', v_invoice.status;
END IF;

-- void_bill (0112)
IF v_bill.status NOT IN ('received', 'overdue') THEN
    RAISE EXCEPTION 'Cannot void a % bill', v_bill.status;
END IF;
```

Both RPCs then check `v_payment_count > 0` before allowing the void. However, the status check blocks `partially_paid` invoices/bills regardless of payment count.

**The gap:** An invoice/bill could theoretically reach `partially_paid` status with `amount_paid = 0` if the status was set incorrectly by a direct DB write or a future bug. In that state, the document can never be voided — the status check blocks it, and there is no other repair path short of a direct DB write.

More concretely: the status machine permits `partially_paid` but the void path doesn't, creating an unescapable state for any document that gets into `partially_paid` with zero payments.

**Fix:** Add `'partially_paid'` to both void allowlists. The existing `v_payment_count > 0` guard already prevents voiding documents with real payments:
```sql
IF v_invoice.status NOT IN ('sent', 'overdue', 'partially_paid') THEN ...
```

---

### BUG-AZ: `processRecurringTransactions` fetches without row-level locking — concurrent cron workers double-create documents

**Severity: HIGH**
**File:** `lib/accounting/recurring.ts:72–82`
**Verified:** Directly read

```typescript
const { data: recurrings, error } = await supabase
  .from('recurring_transactions')
  .select('*')
  .eq('is_active', true)
  .is('deleted_at', null)
  .lte('next_date', today);
```

There is no row-level lock on this SELECT. If two cron workers trigger simultaneously (e.g., a retry, a cold-start overlap, or a distributed deployment), both workers fetch the same set of due recurring transactions and independently create invoices/bills for each. The `next_date` update at the end of each loop iteration happens after the create, so both workers see the old `next_date` at fetch time.

Result: every due recurring transaction gets two invoices/bills created in the same run — with sequential invoice numbers that look legitimate. There is no de-duplication or idempotency key.

**Fix:** Two options:
1. Use an advisory lock keyed on the company_id before processing, or
2. Use `UPDATE recurring_transactions SET next_date = advance_recurring_date(next_date, frequency), last_generated_at = NOW() WHERE id = ... AND next_date = <original_next_date> RETURNING id` — the atomic UPDATE acts as a claim; only the worker that wins the race proceeds with creation.

Option 2 (optimistic locking via conditional UPDATE) is the cleaner approach and requires no schema changes.

---

### BUG-BE: `generateGeneralLedger` opening-balance query is unbounded — timeouts on large datasets

**Severity: MEDIUM**
**File:** `lib/accounting/reports.ts:353–379`
**Verified:** Directly read

```typescript
let priorQuery = supabase
  .from('journal_entry_lines')
  .select('account_id, base_debit, base_credit, journal_entries!inner(...)')
  .eq('journal_entries.company_id', companyId)
  .eq('journal_entries.status', 'posted')
  .is('journal_entries.deleted_at', null)
  .lt('journal_entries.entry_date', startDate)
  .in('account_id', accountIds);
```

For a company with 3+ years of history, this query could return tens of thousands of rows per report invocation. There is no `.limit()`, no server-side aggregation (would require a raw SQL `SUM` query), and no caching. Every GL report with a non-null `startDate` triggers a full table scan of all historical JE lines.

The same pattern exists in `generateCashFlow` (opening cash balance query at lines 694–712) but is limited to cash account IDs only, making it less severe.

**Impact:** For companies approaching 10,000+ journal entry lines, the GL report will time out (Supabase default 30s query timeout), making the report completely unusable.

**Fix:** Either:
1. Move opening balance computation to a PostgreSQL function that uses `SUM` server-side (single aggregate query instead of fetching all rows to TypeScript)
2. Add a `account_period_balances` snapshot table updated nightly by a cron
3. Short-term: add a reasonable `.limit(10000)` with a warning if truncated

---

## 3. Complete Bug Registry (v2.7 — All Sweeps)

### HIGH severity

| ID | Description | File | Status |
|---|---|---|---|
| BUG-D | Recurring cron broken — `p_created_by` never passed; `create_invoice` no service-role path | `0135_bill_rpc.sql`, `recurring.ts:152` | **RESOLVED** |
| BUG-BN | `POST .../email/rematch` missing role check — any project member (incl. viewer) can rewrite `emails.person_id` via service role | `app/api/projects/[slug]/email/rematch/route.ts:14–99` | **RESOLVED** |
| BUG-BP | Contract tables (`contract_documents`, `_recipients`, `_fields`) RLS write policies allow any project member to mutate; send/void routes also have no role gate — viewers can send and void contracts | `0088–0090` migrations, `contracts/[id]/send/route.ts`, `void/route.ts` | **RESOLVED** |
| BUG-B | `complete_reconciliation` balance update — balance maintained by `sync_bank_account_balance` trigger on `bank_transactions` | `0110_bank_accounts_bugfixes_2.sql` | **RESOLVED (was incorrect)** |
| BUG-J | `protect_posted_je_header` doesn't guard `deleted_at` — posted JEs soft-deletable | `0099_journal_entries.sql:285–295` | **RESOLVED** |
| BUG-P | Cash flow `net_change` can diverge from category totals for unknown accounts | `lib/accounting/reports.ts:741–787` | **RESOLVED** |
| BUG-U | `record_invoice_payment` missing `deleted_at IS NULL` | `0104_invoices.sql:738–742` | **RESOLVED** |
| BUG-V | `record_bill_payment` missing `deleted_at IS NULL` | `0112_bills.sql:656–660` | **RESOLVED** |
| BUG-AZ | `processRecurringTransactions` no row lock — concurrent cron workers double-create all due documents | `lib/accounting/recurring.ts:72–82` | **RESOLVED** |
| BUG-BF | `check_je_balance_on_post` allows all-zero JEs to post — `0=0` balance check passes trivially | `0099_journal_entries.sql:189–218` | **RESOLVED** |

### MEDIUM severity

| ID | Description | File | Status |
|---|---|---|---|
| BUG-BO | `getAccountingContext` always picks oldest membership — no multi-company switching for invited users | `lib/accounting/helpers.ts:35–41`, `app/api/accounting/company/route.ts:24–30` | **Unresolved** |
| BUG-C | `recurring_transactions` RLS write policy — replaced with `has_accounting_role('member')` in `0123_recurring_transactions_fixes.sql:35–52` | `0123_recurring_transactions_fixes.sql` | **RESOLVED** |
| BUG-K | Timezone drift in `advanceDate` — `new Date('YYYY-MM-DD')` parsed as UTC midnight | `recurring.ts:21–52, 95–97` | **RESOLVED** |
| BUG-A | `InvoicePdfData.discount_amount: number` (required) references dropped column | `invoice-pdf.ts:21` | **RESOLVED** |
| v1-BUG-6 | `bills.discount_amount` column ignored by `recompute_bill_totals` — silent wrong total | `0112_bills.sql:35, 259` | **Unresolved** |
| BUG-F | `accounting-bridge.ts` no membership re-validation before bill creation | `accounting-bridge.ts:36–44, 158` | **RESOLVED** |
| BUG-E | `void_journal_entry` uses `auth.uid()` for `created_by` — FK violation from service role | `0101_accounting_bugfixes.sql:56, 84` | **RESOLVED** |
| BUG-Q | `wouldCreateAccountCycle` unbounded N+1 DB queries | `lib/accounting/helpers.ts:149–185` | **RESOLVED** |
| BUG-AJ | `create_bill` (0135) skips `has_accounting_role` for service-role callers | `0135_bill_rpc_service_role_support.sql:35–38` | **RESOLVED** |
| BUG-AI | `receive_bill` missing `deleted_at IS NULL` | `0112_bills.sql:475–479` | **RESOLVED** |
| BUG-AS | `journal_entry_lines.exchange_rate` has no `CHECK (> 0)` — zero rate zeroes all base amounts silently | `0099_journal_entries.sql:60` | **RESOLVED** |
| BUG-BE | `generateGeneralLedger` opening-balance query unbounded — timeout on large datasets | `lib/accounting/reports.ts:353–379` | **RESOLVED** |
| BUG-BH | `processRecurringTransactions` creates document even when `next_date > end_date` — end_date check runs after creation | `lib/accounting/recurring.ts:172–188` | **RESOLVED** |
| BUG-BJ | Batch JE import has no atomicity — partial commits possible if later entries fail | `journal-entries/batch-import/route.ts:58–115` | **RESOLVED** |

### LOW severity

| ID | Description | File | Status |
|---|---|---|---|
| BUG-G | `record_invoice_payment` accepts payment_date before invoice_date | `0104_invoices.sql:756` | **RESOLVED** |
| BUG-H | `send_invoice` missing `deleted_at IS NULL` | `0104_invoices.sql:560–564` | **RESOLVED** |
| BUG-I | Invoice PDF silently truncates items but renders full totals | `invoice-pdf.ts:141–144` | **RESOLVED** |
| BUG-L | MCP `record_payment` passes `''` instead of null for reference/notes | `lib/mcp/tools/accounting.ts:199–200` | **RESOLVED** |
| BUG-R | Invoice/bill line item triggers accept `is_active = false` tax rates | `0104_invoices.sql:305–312`, `0112_bills.sql` | **Unresolved** |
| BUG-S | API payment routes pass `undefined` for optional params → empty-string storage | `payments/route.ts:82–84` | **RESOLVED** |
| BUG-T | Payment POST automation fetch missing `deleted_at IS NULL` | `payments/route.ts:107–113` | **RESOLVED** |
| BUG-Z | Invoice email route hardcodes `discount_amount: 0` | `invoices/[id]/email/route.ts:134` | **RESOLVED** |
| BUG-AQ | JE post route UPDATE missing `deleted_at IS NULL` — TOCTOU returns confusing 400 | `journal-entries/[id]/post/route.ts:42–48` | **RESOLVED** |
| BUG-AX | `void_invoice`/`void_bill` exclude `partially_paid` from voidable statuses | `0107_void_invoice_rpc.sql:28`, `0112_bills.sql:834` | **RESOLVED** |
| BUG-BK | CSV bank import has no duplicate detection — same file imported twice creates duplicate transactions | `bank-accounts/[id]/import/route.ts:56–80` | **RESOLVED** |

---

## 4. Priority Fix List (v2.7 — Final Ordered)

**Must fix (HIGH — broken functionality or data integrity):**

1. **BUG-BN** — Add role check (`member` or above) to `POST .../email/rematch` before switching to service client.
2. **BUG-BP** — Add `AND pm.role IN ('owner','admin','member')` to all three contract table write RLS policies; add role check to send and void API routes.
3. **BUG-D** — Add `p_created_by` to `create_invoice`; pass `rec.created_by` in `processRecurringTransactions`.
3. **BUG-AZ** — Add optimistic locking to recurring transaction processing: `UPDATE ... WHERE next_date = <original> RETURNING id` before creating the document.
4. **BUG-BF** — Add `IF total_debit = 0 THEN RAISE EXCEPTION` to `check_je_balance_on_post`.
5. **BUG-J** — Add `deleted_at` to `protect_posted_je_header` immutability check.
6. **BUG-U** — Add `AND deleted_at IS NULL` to `record_invoice_payment` fetch.
7. **BUG-V** — Add `AND deleted_at IS NULL` to `record_bill_payment` fetch.
8. **BUG-P** — Reconcile `net_change` from category totals or add invariant assertion.

**Fix soon (MEDIUM):**

10. **BUG-BO** — Add multi-company switching: `GET /api/accounting/companies` endpoint + `company_id` header/param passed to `getAccountingContext`.
11. **BUG-K** — Replace `new Date(rec.next_date)` with `new Date(rec.next_date + 'T12:00:00')`.
12. **BUG-BH** — Add pre-creation end_date guard in `processRecurringTransactions` before line 131.
13. **BUG-BJ** — Document batch import as best-effort, or add `atomic: true` pre-validation mode.
14. **BUG-AS** — Add `CHECK (exchange_rate > 0)` to `journal_entry_lines` (new migration).
15. **BUG-AJ** — Add company existence check in `create_bill` service-role path.
16. **BUG-AI** — Add `AND deleted_at IS NULL` to `receive_bill` fetch.
17. **BUG-BE** — Move GL opening-balance calculation to a server-side aggregate query.
18. **BUG-A / BUG-Z** — Make `discount_amount` optional in `InvoicePdfData`; drop from `bills`.
19. **BUG-Q** — Add depth limit to `wouldCreateAccountCycle`.
20. **BUG-F** — Verify membership in `accounting-bridge.ts` before bill creation.

**Fix when able (LOW):**

21. **BUG-G** — Add payment_date ≥ invoice_date guard to `record_invoice_payment`.
22. **BUG-H** — Add `AND deleted_at IS NULL` to `send_invoice`.
23. **BUG-R** — Add `AND is_active = true` to line item triggers.
24. **BUG-AX** — Add `'partially_paid'` to both void allowlists.
25. **BUG-S / BUG-L** — Replace `?? ''` / `?? undefined` with `?? null`.
26. **BUG-T** — Add `.is('deleted_at', null)` to automation event fetches.
27. **BUG-AQ** — Add `.is('deleted_at', null)` to JE post UPDATE.
28. **BUG-E** — Guard `void_journal_entry` against NULL `auth.uid()`.
29. **BUG-I** — Add overflow indicator to invoice PDF.
30. **BUG-BK** — Add unique index on `(bank_account_id, transaction_date, amount, description)` with `ON CONFLICT DO NOTHING`.

**Hardening (no current runtime bug):**

31. Add `CHECK (rate >= 0 AND rate <= 1)` to `tax_rates.rate`.
32. Add soft-delete/void RPC for payments.
33. Add `deleted_at IS NULL` guard to `allocate_invoice_number` / `allocate_bill_number`.
34. Fix `ensureAccountingCompany` race condition with upsert + unique constraint.

---

## 5. Sweep Scorecard (All Twelve Passes)

| Pass | New Confirmed | Resolved/Corrected | Dismissed | Cumulative Open |
|---|---|---|---|---|
| v1 | 11 | 0 | 0 | 11 |
| v2 | +4 | 0 | 3 | 15 |
| v2.1 | +1 | 0 | 1 | 16 |
| v2.2 | +5 | 0 | 0 | 21 |
| v2.3 | +3 | 0 | 8 | 24 |
| v2.4 | +3 | 0 | 8 | 27 |
| v2.5 | +4 | 0 | 11 | 31 |
| v2.6 | +1 | 0 | 1 | **29** |
| v2.7 | +3 | 0 | 4 | **32** |
| v2.8 | +2 | -2 | 0 | **32** |
| v2.9 | +1 | 0 (correction only) | 0 | **33** |
| v3.0 | 0 | -30 (mass fix) | 0 | **3** |

**Total open: 3 confirmed bugs**
- BUG-BO — multi-company switching (architectural, deferred)
- v1-BUG-6 — `bills.discount_amount` ignored by `recompute_bill_totals`
- BUG-R — inactive tax rates accepted on invoice/bill line items

All other 30 bugs resolved across migrations 0173–0174 and TypeScript fixes.
