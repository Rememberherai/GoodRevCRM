/**
 * Asset access query helpers — centralized reads for asset-linked
 * bookings, approvals, approvers, and active allocations.
 *
 * All functions accept a pre-built Supabase client so callers control
 * whether to use the user client (RLS-scoped) or the service client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

type Supabase = SupabaseClient<Database>;

// ── Types ──────────────────────────────────────────────────────

export interface AssetAccessContext {
  asset: {
    id: string;
    project_id: string;
    name: string;
    access_mode: string;
    access_enabled: boolean;
    approval_policy: string;
    concurrent_capacity: number;
    booking_owner_user_id: string | null;
    return_required: boolean;
    resource_slug: string | null;
    public_name: string | null;
    public_description: string | null;
    public_visibility: string;
    access_instructions: string | null;
  };
  approvers: { user_id: string }[];
  hubSettings: {
    slug: string;
    is_enabled: boolean;
  } | null;
}

export interface AssetBookingRow {
  id: string;
  event_type_id: string;
  host_user_id: string;
  project_id: string;
  start_at: string;
  end_at: string;
  status: string;
  invitee_name: string;
  invitee_email: string;
  invitee_phone: string | null;
  invitee_timezone: string | null;
  invitee_notes: string | null;
  effective_block_start: string;
  effective_block_end: string;
  created_at: string;
  cancel_token: string | null;
  reschedule_token: string | null;
}

export interface PersonApprovalRow {
  id: string;
  asset_id: string;
  person_id: string;
  status: string;
  notes: string | null;
  expires_at: string | null;
  created_by: string | null;
}

// ── Asset context loader ───────────────────────────────────────

/**
 * Load the full context needed to process an asset access request:
 * the asset's access settings, its approvers, and the project hub settings.
 */
export async function getAssetAccessContext(
  supabase: Supabase,
  assetId: string
): Promise<AssetAccessContext | null> {
  const { data: asset, error: assetError } = await supabase
    .from('community_assets')
    .select(`
      id, project_id, name,
      access_mode, access_enabled, approval_policy,
      concurrent_capacity, booking_owner_user_id,
      return_required, resource_slug,
      public_name, public_description, public_visibility,
      access_instructions
    `)
    .eq('id', assetId)
    .single();

  if (assetError || !asset) return null;

  const [approversResult, hubResult] = await Promise.all([
    supabase
      .from('community_asset_approvers')
      .select('user_id')
      .eq('asset_id', assetId),
    supabase
      .from('asset_access_settings')
      .select('slug, is_enabled')
      .eq('project_id', asset.project_id)
      .maybeSingle(),
  ]);

  return {
    asset: asset as AssetAccessContext['asset'],
    approvers: approversResult.data || [],
    hubSettings: hubResult.data,
  };
}

// ── Asset-scoped booking queries ───────────────────────────────

/**
 * List bookings for a specific asset (across all event types linked to it).
 * Supports optional status filter and cursor-based pagination.
 */
export async function listAssetBookings(
  supabase: Supabase,
  assetId: string,
  opts: {
    status?: string;
    cursor?: string;
    limit?: number;
  } = {}
): Promise<{ bookings: AssetBookingRow[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 50;

  let query = supabase
    .from('bookings')
    .select(`
      id, event_type_id, host_user_id, project_id,
      start_at, end_at, status,
      invitee_name, invitee_email, invitee_phone,
      invitee_timezone, invitee_notes,
      effective_block_start, effective_block_end,
      created_at, cancel_token, reschedule_token,
      event_types!inner(asset_id)
    `)
    .eq('event_types.asset_id', assetId)
    .order('start_at', { ascending: false })
    .limit(limit + 1);

  if (opts.status) {
    query = query.eq('status', opts.status);
  }

  if (opts.cursor) {
    query = query.lt('start_at', opts.cursor);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { bookings: [], nextCursor: null };
  }

  const hasMore = data.length > limit;
  const rows = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? rows[rows.length - 1]?.start_at ?? null : null;

  return {
    bookings: rows as unknown as AssetBookingRow[],
    nextCursor,
  };
}

/**
 * Count active (non-terminal) bookings overlapping a time range for an asset.
 * Used for availability checks in the service layer.
 */
export async function countOverlappingAssetBookings(
  supabase: Supabase,
  assetId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id, event_types!inner(asset_id)', { count: 'exact', head: true })
    .eq('event_types.asset_id', assetId)
    .not('status', 'in', '("cancelled","rescheduled","completed")')
    .lte('effective_block_start', rangeEnd)
    .gte('effective_block_end', rangeStart);

  if (error) {
    console.error('countOverlappingAssetBookings error:', error.message);
    return 0;
  }

  return count ?? 0;
}

// ── Person approval queries ────────────────────────────────────

/**
 * Check if a person has an active, non-expired approval for an asset.
 */
export async function hasActiveApproval(
  supabase: Supabase,
  assetId: string,
  personId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('community_asset_person_approvals')
    .select('id, expires_at')
    .eq('asset_id', assetId)
    .eq('person_id', personId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) return false;

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return false;
  }

  return true;
}

/**
 * List all person approvals for an asset.
 */
export async function listPersonApprovals(
  supabase: Supabase,
  assetId: string
): Promise<PersonApprovalRow[]> {
  const { data, error } = await supabase
    .from('community_asset_person_approvals')
    .select('id, asset_id, person_id, status, notes, expires_at, created_by')
    .eq('asset_id', assetId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data;
}

// ── Approver queries ───────────────────────────────────────────

/**
 * Check if a user is an assigned approver for an asset.
 */
export async function isAssetApprover(
  supabase: Supabase,
  assetId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('community_asset_approvers')
    .select('id')
    .eq('asset_id', assetId)
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}

// ── Audit event helpers ────────────────────────────────────────

/**
 * List audit events for a booking or verification.
 */
export async function listAccessEvents(
  supabase: Supabase,
  opts: { bookingId?: string; verificationId?: string }
): Promise<Database['public']['Tables']['asset_access_events']['Row'][]> {
  let query = supabase
    .from('asset_access_events')
    .select('*')
    .order('created_at', { ascending: true });

  if (opts.bookingId) {
    query = query.eq('booking_id', opts.bookingId);
  } else if (opts.verificationId) {
    query = query.eq('verification_id', opts.verificationId);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
}

/**
 * Insert an audit event. Uses the service client (bypasses RLS).
 */
export async function insertAccessEvent(
  supabase: Supabase,
  event: {
    project_id: string;
    booking_id?: string | null;
    verification_id?: string | null;
    action: string;
    actor_type: string;
    actor_id?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase
    .from('asset_access_events')
    .insert({
      project_id: event.project_id,
      booking_id: event.booking_id ?? null,
      verification_id: event.verification_id ?? null,
      action: event.action,
      actor_type: event.actor_type,
      actor_id: event.actor_id ?? null,
      notes: event.notes ?? null,
      metadata: (event.metadata ?? {}) as Json,
    });

  if (error) {
    console.error('insertAccessEvent error:', error.message);
  }
}
