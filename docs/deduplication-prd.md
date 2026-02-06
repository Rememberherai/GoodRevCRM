# Deduplication System - Product Requirements Document

## Overview
Add duplicate detection when records enter the system (manual creation, import, contact discovery) with the ability for users to merge or allow (ignore) potential duplicates. Supports both People and Organizations.

---

## Database Schema

### New Migration: `supabase/migrations/0067_duplicate_detection.sql`

**Tables:**

1. **`duplicate_candidates`** - Stores potential duplicate pairs
   - `id`: UUID primary key
   - `project_id`: FK to projects (multi-tenant scoping)
   - `entity_type`: 'person' | 'organization'
   - `source_id`: The incoming/newer record
   - `target_id`: The existing/older record (potential match)
   - `match_score`: DECIMAL(5,4) - 0 to 1 confidence score
   - `match_reasons`: JSONB array explaining why matched
   - `detection_source`: 'manual_creation' | 'csv_import' | 'epa_import' | 'contact_discovery' | 'bulk_scan'
   - `status`: ENUM('pending', 'allowed', 'merged')
   - `status_changed_at`, `status_changed_by`: Audit fields
   - `merged_at`, `merged_by`, `survivor_id`, `merge_audit`: Merge tracking
   - Unique constraint on (project_id, entity_type, source_id, target_id)

2. **`merge_history`** - Audit log of all merges
   - `id`: UUID primary key
   - `project_id`: FK to projects
   - `entity_type`: 'person' | 'organization'
   - `survivor_id`: Which record survived the merge
   - `merged_ids`: UUID[] of records that were merged into survivor
   - `field_selections`: JSONB - which fields came from which record
   - `related_records_moved`: JSONB - count of reassigned related records
   - `merged_by`, `merged_at`: Who/when
   - `merged_records_snapshot`: JSONB - full snapshot for potential undo

---

## Core Detection Library

### `lib/deduplication/detector.ts`

**Matching Logic for People:**

| Field | Weight | Match Type | Notes |
|-------|--------|------------|-------|
| email | 0.50 | Exact | Normalized to lowercase, trimmed |
| linkedin_url | 0.45 | Normalized | Extract profile ID, compare |
| phone | 0.30 | Normalized | Strip formatting, compare last 10 digits |
| name | 0.25 | Fuzzy | Jaro-Winkler similarity >= 0.85 |
| domain + name | 0.35 | Combined | Same company email domain + similar name |

**Matching Logic for Organizations:**

| Field | Weight | Match Type | Notes |
|-------|--------|------------|-------|
| domain | 0.60 | Exact | Normalized, extracted from website if needed |
| linkedin_url | 0.50 | Normalized | Company profile ID |
| name | 0.40 | Fuzzy | Strip Inc/LLC/Corp suffixes, fuzzy match |
| website | 0.35 | Domain | Extract domain and compare |

**Thresholds:**
- **Minimum match**: 0.60 - Below this, no duplicate detected
- **Auto-merge on import**: 0.95+ - High confidence auto-handling (configurable)

**Helper Functions:**
- `normalizeEmail(email)` - lowercase, trim whitespace
- `normalizePhone(phone)` - strip formatting, return last 10 digits
- `normalizeOrgName(name)` - remove Inc/LLC/Corp/Company suffixes
- `extractLinkedInId(url)` - parse profile ID from LinkedIn URL
- Reuse `FREE_EMAIL_PROVIDERS` list from `lib/gmail/contact-matcher.ts`

### `lib/deduplication/merge.ts`

**Merge Operation Steps:**
1. Snapshot records being merged (for audit trail / potential undo)
2. Build survivor record from user's field selections
3. Reassign all related records to survivor ID
4. Update survivor with merged field values
5. Soft-delete merged records (set deleted_at)
6. Update any duplicate_candidates involving merged records
7. Create merge_history record
8. Emit automation event ('entity.merged' or 'entity.updated')

**Related Records to Reassign (People):**

| Table | Column | Notes |
|-------|--------|-------|
| person_organizations | person_id | Handle unique constraint conflicts |
| activity_log | person_id | SET NULL safe |
| meetings | person_id | |
| meeting_attendees | person_id | Handle unique conflicts |
| notes | person_id | |
| tasks | person_id | |
| sent_emails | person_id | |
| sms_messages | person_id | |
| entity_comments | entity_id (where type='person') | |
| opportunities | primary_contact_id | |
| sequence_enrollments | person_id | Cancel duplicate active enrollments |
| enrichment_jobs | person_id | |
| calls | person_id | |

**Related Records to Reassign (Organizations):**

| Table | Column | Notes |
|-------|--------|-------|
| person_organizations | organization_id | Handle unique constraint conflicts |
| activity_log | organization_id | |
| meetings | organization_id | |
| notes | organization_id | |
| tasks | organization_id | |
| sent_emails | organization_id | |
| sms_messages | organization_id | |
| entity_comments | entity_id (where type='organization') | |
| opportunities | organization_id | |
| rfps | organization_id | |
| sequences | organization_id | |
| news_subscriptions | organization_id | |
| news_articles | organization_id | |
| calls | organization_id | |

### `types/deduplication.ts`

```typescript
interface MatchReason {
  field: string;           // e.g., 'email', 'domain', 'name'
  match_type: 'exact' | 'fuzzy' | 'domain' | 'normalized';
  source_value: string;
  target_value: string;
  contribution: number;    // How much this contributed to score (0-1)
}

interface DuplicateCandidate {
  id: string;
  project_id: string;
  entity_type: 'person' | 'organization';
  source_id: string;
  target_id: string;
  match_score: number;
  match_reasons: MatchReason[];
  detection_source: string;
  status: 'pending' | 'allowed' | 'merged';
  created_at: string;
}

interface MergeConfig {
  entityType: 'person' | 'organization';
  survivorId: string;
  mergeIds: string[];
  fieldSelections: Record<string, string>; // fieldName -> sourceRecordId
  projectId: string;
  userId: string;
}

interface MergeResult {
  survivor: Record<string, unknown>;
  relatedRecordsMoved: Record<string, number>;
  mergeHistoryId: string;
}
```

---

## API Endpoints

### Detection & Management

**1. POST `/api/projects/[slug]/duplicates/detect`**
Check for duplicates before creation.

```typescript
// Request
{
  entity_type: 'person' | 'organization';
  record: PersonRecord | OrganizationRecord;
  source: 'manual_creation' | 'csv_import' | 'epa_import' | 'contact_discovery';
}

// Response
{
  has_duplicates: boolean;
  matches: Array<{
    id: string;
    record: PersonRecord | OrganizationRecord;
    score: number;
    reasons: MatchReason[];
  }>;
}
```

**2. GET `/api/projects/[slug]/duplicates`**
List pending duplicate candidates.

```typescript
// Query params: entity_type, status, page, limit
// Response
{
  candidates: DuplicateCandidate[];
  pagination: { page, limit, total, totalPages };
}
```

**3. POST `/api/projects/[slug]/duplicates/scan`**
Bulk scan existing records for duplicates.

```typescript
// Request
{
  entity_type: 'person' | 'organization';
  max_results?: number;  // Default 100
}

// Response
{
  found: number;
  candidates_created: number;
}
```

### Resolution

**4. POST `/api/projects/[slug]/duplicates/[id]/resolve`**
Resolve a duplicate candidate.

```typescript
// Request
{
  action: 'allow' | 'merge';
  // If merge:
  survivor_id?: string;
  field_selections?: Record<string, 'source' | 'target'>;
}

// Response
{
  success: boolean;
  survivor?: PersonRecord | OrganizationRecord;
  related_records_moved?: Record<string, number>;
}
```

**5. POST `/api/projects/[slug]/merge`**
Direct merge without going through duplicate_candidates.

```typescript
// Request
{
  entity_type: 'person' | 'organization';
  survivor_id: string;
  merge_ids: string[];
  field_selections: Record<string, string>; // field -> source_id
}

// Response
{
  survivor: PersonRecord | OrganizationRecord;
  merged_count: number;
  related_records_moved: Record<string, number>;
}
```

---

## UI Components

### `components/deduplication/duplicate-review-modal.tsx`

Side-by-side comparison modal (similar to existing `EnrichmentReviewModal`):

```
┌─────────────────────────────────────────────────────────────┐
│  Review Potential Duplicate                                  │
│  These records may be the same person/organization           │
├─────────────────────────────────────────────────────────────┤
│  Match Score: 85% ████████████░░░                            │
│  Matched on: Email (exact), Name (fuzzy 92%)                │
├──────────────────────┬──────────────────────────────────────┤
│   INCOMING RECORD    │      EXISTING RECORD                 │
├──────────────────────┼──────────────────────────────────────┤
│ ○ First Name         │ ● First Name                         │
│   John               │   Johnathan                          │
├──────────────────────┼──────────────────────────────────────┤
│ ● Email              │ ○ Email                              │
│   john@acme.com      │   —                                  │
├──────────────────────┴──────────────────────────────────────┤
│  Related Records:                                            │
│  • 5 activities will be merged                               │
│  • 2 notes will be combined                                  │
├─────────────────────────────────────────────────────────────┤
│  [ Not a Duplicate ]              [ Merge Records ]          │
└─────────────────────────────────────────────────────────────┘
```

Features:
- Radio buttons to select which value to keep per field
- Shows match score with visual progress bar
- Lists match reasons (which fields matched and how)
- Shows count of related records that will be merged
- "Not a Duplicate" marks as 'allowed'
- "Merge Records" performs the merge

### `components/deduplication/duplicate-intercept-modal.tsx`

Shown when creating a record that matches existing records:

```
┌─────────────────────────────────────────────────────────────┐
│  Potential Duplicates Found                                  │
│  We found existing records that may match                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │ John Smith (john@acme.com)           85% match      │    │
│  │ Acme Corp • VP Sales                 [View] [Merge] │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ J. Smith (jsmith@acme.com)           72% match      │    │
│  │ Acme Corp • Director                 [View] [Merge] │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  [ Cancel ]                         [ Create Anyway ]        │
└─────────────────────────────────────────────────────────────┘
```

Options:
- **Create Anyway**: Creates record, adds to duplicate_candidates for later review
- **Merge with [Record]**: Opens DuplicateReviewModal for that pair
- **Cancel**: Aborts creation

### `components/deduplication/duplicates-badge.tsx`

Shows pending duplicate count in navigation or settings header.

```tsx
// Usage
<DuplicatesBadge entityType="person" projectSlug={slug} />

// Renders: Badge with "3 duplicates" if pending > 0
```

### Settings Page: `app/(dashboard)/projects/[slug]/settings/duplicates/page.tsx`

Dedicated page for managing duplicates:
- Lists all pending duplicate candidates
- Filters: Entity type, Score range, Detection source
- Table columns: Records, Score, Detected, Source, Actions
- Bulk actions: "Review Selected", "Allow All"
- Click row to open DuplicateReviewModal

---

## Integration Points

### 1. Manual Person Creation

**File:** `app/api/projects/[slug]/people/route.ts`

```typescript
// In POST handler, after validation, before insert:
const duplicates = await detectDuplicates(personData, {
  entityType: 'person',
  projectId: project.id,
}, supabase);

if (duplicates.length > 0) {
  return NextResponse.json({
    duplicates_detected: true,
    matches: duplicates,
    pending_record: personData
  }, { status: 409 }); // Conflict
}

// Proceed with normal insert...
```

**File:** `app/(dashboard)/projects/[slug]/people/add-person-modal.tsx`

```typescript
const onSubmit = async (data) => {
  const response = await fetch(...);

  if (response.status === 409) {
    const { matches, pending_record } = await response.json();
    setDuplicateMatches(matches);
    setPendingRecord(pending_record);
    setShowDuplicateInterceptModal(true);
    return;
  }

  // Normal success handling...
};
```

### 2. Manual Organization Creation

Same pattern as people in:
- `app/api/projects/[slug]/organizations/route.ts`
- `app/(dashboard)/projects/[slug]/organizations/add-organization-modal.tsx`

### 3. CSV Import

**File:** Import processing logic

During row processing:
```typescript
for (const row of rows) {
  const record = mapRowToRecord(row, mapping);

  if (options.skip_duplicates) {
    const duplicates = await detectDuplicates(record, config, supabase);
    if (duplicates.some(d => d.score >= 0.8)) {
      results.skipped++;
      continue;
    }
  }

  // Create record
  const newRecord = await createRecord(record, supabase);

  // Check for lower-confidence duplicates to review later
  const duplicates = await detectDuplicates(record, config, supabase);
  if (duplicates.length > 0 && !options.skip_duplicates) {
    await createDuplicateCandidates(newRecord.id, duplicates, 'csv_import', supabase);
  }

  results.created++;
}
```

### 4. EPA Import

**File:** `app/api/projects/[slug]/epa-import/route.ts`

```typescript
for (const facility of facilities) {
  const orgData = mapFacilityToOrg(facility);

  // Check for existing by permit_id first (stored in custom_fields)
  const existing = await findByPermitId(facility.permit_id, projectId, supabase);
  if (existing) continue;

  // Check for domain/name duplicates
  const duplicates = await detectDuplicates(orgData, {
    entityType: 'organization',
    projectId,
  }, supabase);

  if (duplicates.some(d => d.score >= 0.85)) {
    // High confidence - link to existing instead of creating
    await linkFacilityToExisting(facility, duplicates[0].targetId, supabase);
    continue;
  }

  // Create new org, add lower-confidence duplicates for review
  const newOrg = await createOrganization(orgData, supabase);
  if (duplicates.length > 0) {
    await createDuplicateCandidates(newOrg.id, duplicates, 'epa_import', supabase);
  }
}
```

### 5. Contact Discovery

**File:** `app/api/projects/[slug]/organizations/[id]/add-contacts/route.ts`

```typescript
for (const contact of discoveredContacts) {
  const personData = {
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    linkedin_url: contact.linkedin_url,
  };

  const duplicates = await detectDuplicates(personData, {
    entityType: 'person',
    projectId: project.id,
  }, supabase);

  if (duplicates.some(d => d.score >= 0.9)) {
    // High confidence - just link existing person to org
    await linkPersonToOrg(duplicates[0].targetId, organizationId, supabase);
    continue;
  }

  // Create new person and link to org
  const newPerson = await createPerson(personData, supabase);
  await linkPersonToOrg(newPerson.id, organizationId, supabase);

  if (duplicates.length > 0) {
    await createDuplicateCandidates(newPerson.id, duplicates, 'contact_discovery', supabase);
  }
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/0067_duplicate_detection.sql` | Database schema |
| `lib/deduplication/detector.ts` | Detection algorithm |
| `lib/deduplication/merge.ts` | Merge service |
| `types/deduplication.ts` | TypeScript types |
| `components/deduplication/duplicate-review-modal.tsx` | Merge comparison UI |
| `components/deduplication/duplicate-intercept-modal.tsx` | Creation intercept UI |
| `components/deduplication/duplicates-badge.tsx` | Pending count badge |
| `app/api/projects/[slug]/duplicates/route.ts` | List duplicates API |
| `app/api/projects/[slug]/duplicates/detect/route.ts` | Detect API |
| `app/api/projects/[slug]/duplicates/scan/route.ts` | Bulk scan API |
| `app/api/projects/[slug]/duplicates/[id]/resolve/route.ts` | Resolve API |
| `app/api/projects/[slug]/merge/route.ts` | Direct merge API |
| `app/(dashboard)/projects/[slug]/settings/duplicates/page.tsx` | Management page |

## Files to Modify

| File | Changes |
|------|---------|
| `app/api/projects/[slug]/people/route.ts` | Add duplicate detection to POST |
| `app/api/projects/[slug]/organizations/route.ts` | Add duplicate detection to POST |
| `app/(dashboard)/projects/[slug]/people/add-person-modal.tsx` | Handle 409, show intercept modal |
| `app/(dashboard)/projects/[slug]/organizations/add-organization-modal.tsx` | Handle 409, show intercept modal |
| `types/automation.ts` | Add 'entity.merged' trigger type (optional) |

---

## Verification Plan

### Unit Tests
- Detection algorithm with edge cases:
  - Same email, different case (john@ACME.com vs john@acme.com)
  - Phone format variations ((555) 123-4567 vs 555.123.4567)
  - Org names with/without Inc/LLC (Acme Inc vs Acme)
  - Free email provider handling
  - Fuzzy name matching edge cases

### Manual Testing
1. **Create person with duplicate email** -> Intercept modal appears with match
2. **Create person with similar name + same domain** -> Shows as potential match
3. **Import CSV with duplicates** -> Candidates created for review
4. **Merge two people** -> All related records reassigned correctly
5. **Mark as "Not a Duplicate"** -> Pair doesn't appear again
6. **Merge with opportunities linked** -> primary_contact_id updated
7. **Bulk scan existing data** -> Finds historical duplicates

### Build Verification
```bash
npm run build  # Verify no TypeScript errors
```

### Database Migration
```bash
# Deallocate prepared statements first
node -e "const { Client } = require('pg'); ..."

# Push migration
npx supabase db push --db-url '...'
```
