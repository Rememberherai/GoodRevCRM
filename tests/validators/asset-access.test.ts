import { describe, expect, it } from 'vitest';
import {
  upsertHubSettingsSchema,
  updateAssetAccessSettingsSchema,
  addApproverSchema,
  grantPersonApprovalSchema,
  updatePersonApprovalSchema,
  reviewRequestSchema,
  markReturnedSchema,
  publicBookRequestSchema,
  requestListQuerySchema,
} from '@/lib/validators/asset-access';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('upsertHubSettingsSchema', () => {
  it('accepts valid hub settings with slug, title, and is_enabled', () => {
    const result = upsertHubSettingsSchema.safeParse({
      slug: 'my-community-hub',
      title: 'Community Hub',
      is_enabled: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a minimal payload with just slug', () => {
    const result = upsertHubSettingsSchema.safeParse({ slug: 'hub1' });
    expect(result.success).toBe(true);
  });

  it('rejects slug with spaces', () => {
    const result = upsertHubSettingsSchema.safeParse({ slug: 'my hub' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with uppercase letters', () => {
    const result = upsertHubSettingsSchema.safeParse({ slug: 'MyHub' });
    expect(result.success).toBe(false);
  });

  it('rejects empty slug', () => {
    const result = upsertHubSettingsSchema.safeParse({ slug: '' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with trailing hyphen', () => {
    const result = upsertHubSettingsSchema.safeParse({ slug: 'my-hub-' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with consecutive hyphens', () => {
    const result = upsertHubSettingsSchema.safeParse({ slug: 'my--hub' });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields (description, logo_url, accent_color)', () => {
    const result = upsertHubSettingsSchema.safeParse({
      slug: 'hub1',
      description: 'A description of the hub',
      logo_url: 'https://example.com/logo.png',
      accent_color: '#ff5500',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null for nullable optional fields', () => {
    const result = upsertHubSettingsSchema.safeParse({
      slug: 'hub1',
      description: null,
      logo_url: null,
      accent_color: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects description over 2000 chars', () => {
    const result = upsertHubSettingsSchema.safeParse({
      slug: 'hub1',
      description: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts description at exactly 2000 chars', () => {
    const result = upsertHubSettingsSchema.safeParse({
      slug: 'hub1',
      description: 'x'.repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid logo_url', () => {
    const result = upsertHubSettingsSchema.safeParse({
      slug: 'hub1',
      logo_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateAssetAccessSettingsSchema', () => {
  it('accepts valid partial update with just access_mode', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      access_mode: 'reservable',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all fields together', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      access_mode: 'hybrid',
      access_enabled: true,
      resource_slug: 'my-resource',
      public_name: 'Public Resource',
      public_description: 'Description here',
      approval_policy: 'open_review',
      public_visibility: 'listed',
      access_instructions: 'Come to the front desk',
      booking_owner_user_id: VALID_UUID,
      concurrent_capacity: 5,
      return_required: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid access_mode value', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      access_mode: 'invalid_mode',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid approval_policy value', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      approval_policy: 'invalid_policy',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid public_visibility value', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      public_visibility: 'hidden',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID booking_owner_user_id', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      booking_owner_user_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects concurrent_capacity below 1', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      concurrent_capacity: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative concurrent_capacity', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      concurrent_capacity: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects resource_slug with spaces', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      resource_slug: 'my resource',
    });
    expect(result.success).toBe(false);
  });

  it('rejects resource_slug with uppercase', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      resource_slug: 'MyResource',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null for nullable fields', () => {
    const result = updateAssetAccessSettingsSchema.safeParse({
      resource_slug: null,
      public_name: null,
      public_description: null,
      access_instructions: null,
      booking_owner_user_id: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid access_mode values', () => {
    for (const mode of ['tracked_only', 'reservable', 'loanable', 'hybrid']) {
      const result = updateAssetAccessSettingsSchema.safeParse({ access_mode: mode });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid approval_policy values', () => {
    for (const policy of ['open_auto', 'open_review', 'approved_only']) {
      const result = updateAssetAccessSettingsSchema.safeParse({ approval_policy: policy });
      expect(result.success).toBe(true);
    }
  });
});

describe('addApproverSchema', () => {
  it('accepts valid UUID user_id', () => {
    const result = addApproverSchema.safeParse({ user_id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID string', () => {
    const result = addApproverSchema.safeParse({ user_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing user_id', () => {
    const result = addApproverSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty string user_id', () => {
    const result = addApproverSchema.safeParse({ user_id: '' });
    expect(result.success).toBe(false);
  });
});

describe('grantPersonApprovalSchema', () => {
  it('accepts valid person_id UUID', () => {
    const result = grantPersonApprovalSchema.safeParse({ person_id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('accepts with optional notes and expires_at', () => {
    const result = grantPersonApprovalSchema.safeParse({
      person_id: VALID_UUID,
      notes: 'Approved for regular access',
      expires_at: '2026-12-31T23:59:59Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID person_id', () => {
    const result = grantPersonApprovalSchema.safeParse({ person_id: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing person_id', () => {
    const result = grantPersonApprovalSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects notes over 2000 chars', () => {
    const result = grantPersonApprovalSchema.safeParse({
      person_id: VALID_UUID,
      notes: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime for expires_at', () => {
    const result = grantPersonApprovalSchema.safeParse({
      person_id: VALID_UUID,
      expires_at: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null for expires_at', () => {
    const result = grantPersonApprovalSchema.safeParse({
      person_id: VALID_UUID,
      expires_at: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null for notes', () => {
    const result = grantPersonApprovalSchema.safeParse({
      person_id: VALID_UUID,
      notes: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('updatePersonApprovalSchema', () => {
  it('accepts valid update with notes', () => {
    const result = updatePersonApprovalSchema.safeParse({
      notes: 'Updated access notes',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid update with expires_at', () => {
    const result = updatePersonApprovalSchema.safeParse({
      expires_at: '2026-06-30T12:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all optional)', () => {
    const result = updatePersonApprovalSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects notes over 2000 chars', () => {
    const result = updatePersonApprovalSchema.safeParse({
      notes: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts null for nullable fields', () => {
    const result = updatePersonApprovalSchema.safeParse({
      notes: null,
      expires_at: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('reviewRequestSchema', () => {
  it('accepts approve action', () => {
    const result = reviewRequestSchema.safeParse({ action: 'approve' });
    expect(result.success).toBe(true);
  });

  it('accepts deny action', () => {
    const result = reviewRequestSchema.safeParse({ action: 'deny' });
    expect(result.success).toBe(true);
  });

  it('accepts grant_access_and_approve action', () => {
    const result = reviewRequestSchema.safeParse({ action: 'grant_access_and_approve' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const result = reviewRequestSchema.safeParse({ action: 'reject' });
    expect(result.success).toBe(false);
  });

  it('rejects missing action', () => {
    const result = reviewRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts optional notes and expires_at', () => {
    const result = reviewRequestSchema.safeParse({
      action: 'approve',
      notes: 'Looks good',
      expires_at: '2026-12-31T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects notes over 2000 chars', () => {
    const result = reviewRequestSchema.safeParse({
      action: 'approve',
      notes: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts null for expires_at', () => {
    const result = reviewRequestSchema.safeParse({
      action: 'deny',
      expires_at: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('markReturnedSchema', () => {
  it('accepts empty object', () => {
    const result = markReturnedSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts with notes', () => {
    const result = markReturnedSchema.safeParse({ notes: 'Returned in good condition' });
    expect(result.success).toBe(true);
  });

  it('rejects notes over 2000 chars', () => {
    const result = markReturnedSchema.safeParse({ notes: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe('publicBookRequestSchema', () => {
  const validBooking = {
    event_type_id: VALID_UUID,
    start_at: '2026-04-15T10:00:00Z',
    guest_name: 'Jane Doe',
    guest_email: 'Jane@Example.com',
  };

  it('accepts valid booking request', () => {
    const result = publicBookRequestSchema.safeParse(validBooking);
    expect(result.success).toBe(true);
  });

  it('rejects missing event_type_id', () => {
    const { event_type_id, ...rest } = validBooking;
    const result = publicBookRequestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = publicBookRequestSchema.safeParse({
      ...validBooking,
      guest_email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing guest_name', () => {
    const { guest_name, ...rest } = validBooking;
    const result = publicBookRequestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('lowercases and trims email after validation', () => {
    const result = publicBookRequestSchema.safeParse({
      ...validBooking,
      guest_email: 'Jane@Example.COM',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guest_email).toBe('jane@example.com');
    }
  });

  it('rejects email with leading/trailing spaces (spaces fail email validation)', () => {
    const result = publicBookRequestSchema.safeParse({
      ...validBooking,
      guest_email: '  Jane@Example.COM  ',
    });
    expect(result.success).toBe(false);
  });

  it('trims guest_name', () => {
    const result = publicBookRequestSchema.safeParse({
      ...validBooking,
      guest_name: '  Jane Doe  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guest_name).toBe('Jane Doe');
    }
  });

  it('rejects missing start_at', () => {
    const { start_at, ...rest } = validBooking;
    const result = publicBookRequestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid start_at datetime', () => {
    const result = publicBookRequestSchema.safeParse({
      ...validBooking,
      start_at: 'next tuesday',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional responses', () => {
    const result = publicBookRequestSchema.safeParse({
      ...validBooking,
      responses: { question1: 'answer1', question2: 42 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID event_type_id', () => {
    const result = publicBookRequestSchema.safeParse({
      ...validBooking,
      event_type_id: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('requestListQuerySchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = requestListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid status filter', () => {
    for (const status of ['pending', 'confirmed', 'cancelled', 'completed']) {
      const result = requestListQuerySchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('accepts valid asset_id UUID', () => {
    const result = requestListQuerySchema.safeParse({ asset_id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('accepts valid approver_scope', () => {
    for (const scope of ['mine', 'all']) {
      const result = requestListQuerySchema.safeParse({ approver_scope: scope });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid status value', () => {
    const result = requestListQuerySchema.safeParse({ status: 'archived' });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID asset_id', () => {
    const result = requestListQuerySchema.safeParse({ asset_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('accepts cursor string', () => {
    const result = requestListQuerySchema.safeParse({ cursor: 'abc123' });
    expect(result.success).toBe(true);
  });

  it('accepts all fields together', () => {
    const result = requestListQuerySchema.safeParse({
      status: 'pending',
      asset_id: VALID_UUID,
      approver_scope: 'mine',
      cursor: 'next-page',
    });
    expect(result.success).toBe(true);
  });
});
