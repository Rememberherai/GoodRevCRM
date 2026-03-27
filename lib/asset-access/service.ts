/**
 * Asset access service — booking business logic for asset-linked bookings.
 *
 * Handles:
 * - Asset booking creation via the asset-scoped RPC
 * - Approval policy evaluation
 * - Review actions (approve / deny / grant_access_and_approve)
 * - Return tracking for loanable assets
 * - Audit event logging
 *
 * All mutations use the service client (bypasses RLS).
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { emitAutomationEvent } from '@/lib/automations/engine';
import {
  getAssetAccessContext,
  hasActiveApproval,
  insertAccessEvent,
  type AssetAccessContext,
} from './queries';

// ── Types ──────────────────────────────────────────────────────

interface CreateAssetBookingInput {
  assetId: string;
  eventTypeId: string;
  startAt: string;       // ISO datetime
  inviteeName: string;
  inviteeEmail: string;
  inviteePhone?: string | null;
  inviteeTimezone?: string | null;
  inviteeNotes?: string | null;
  personId?: string | null;
  responses?: Record<string, unknown>;
}

interface CreateAssetBookingResult {
  success: boolean;
  bookingId?: string;
  status?: 'confirmed' | 'pending';
  error?: string;
  errorCode?: 'ASSET_NOT_FOUND' | 'ACCESS_DISABLED' | 'CAPACITY_EXHAUSTED' | 'EVENT_TYPE_NOT_FOUND' | 'NO_BOOKING_OWNER';
}

interface ReviewRequestInput {
  bookingId: string;
  action: 'approve' | 'deny' | 'grant_access_and_approve';
  reviewerUserId: string;
  notes?: string;
  /** For grant_access_and_approve: the person_id to grant ongoing access */
  personId?: string;
  expires_at?: string | null;
}

interface ReviewResult {
  success: boolean;
  error?: string;
}

// ── Asset booking creation ─────────────────────────────────────

/**
 * Create a booking for an asset-linked event type.
 *
 * Uses the `create_asset_booking_if_available` RPC for atomic
 * capacity checking with advisory lock.
 */
export async function createAssetBooking(
  input: CreateAssetBookingInput
): Promise<CreateAssetBookingResult> {
  const supabase = createServiceClient();

  // Load asset context
  const ctx = await getAssetAccessContext(supabase, input.assetId);
  if (!ctx) {
    return { success: false, error: 'Asset not found', errorCode: 'ASSET_NOT_FOUND' };
  }

  if (!ctx.asset.access_enabled) {
    return { success: false, error: 'Access is not enabled for this asset', errorCode: 'ACCESS_DISABLED' };
  }

  if (!ctx.asset.booking_owner_user_id) {
    return { success: false, error: 'Asset has no booking owner configured', errorCode: 'NO_BOOKING_OWNER' };
  }

  // Load event type for duration and buffer settings
  const { data: eventType, error: etError } = await supabase
    .from('event_types')
    .select('id, duration_minutes, buffer_before_minutes, buffer_after_minutes, asset_id, is_active')
    .eq('id', input.eventTypeId)
    .eq('is_active', true)
    .single();

  if (etError || !eventType) {
    return { success: false, error: 'Event type not found', errorCode: 'EVENT_TYPE_NOT_FOUND' };
  }

  // Verify event type is linked to this asset
  if (eventType.asset_id !== input.assetId) {
    return { success: false, error: 'Event type is not linked to this asset', errorCode: 'EVENT_TYPE_NOT_FOUND' };
  }

  // Calculate end time and buffers
  const startAt = new Date(input.startAt);
  const endAt = new Date(startAt.getTime() + eventType.duration_minutes * 60 * 1000);
  const bufferBefore = `${eventType.buffer_before_minutes || 0} minutes`;
  const bufferAfter = `${eventType.buffer_after_minutes || 0} minutes`;

  // Determine if this booking requires confirmation (review)
  const requiresConfirmation = await evaluateApprovalPolicy(supabase, ctx, input.personId ?? null);

  // Call the asset-scoped RPC
  const { data: bookingId, error: rpcError } = await supabase.rpc(
    'create_asset_booking_if_available',
    {
      p_asset_id: input.assetId,
      p_event_type_id: input.eventTypeId,
      p_booking_owner_user_id: ctx.asset.booking_owner_user_id,
      p_project_id: ctx.asset.project_id,
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
      p_buffer_before: bufferBefore,
      p_buffer_after: bufferAfter,
      p_invitee_name: input.inviteeName,
      p_invitee_email: input.inviteeEmail,
      p_invitee_phone: input.inviteePhone ?? null,
      p_invitee_timezone: input.inviteeTimezone ?? null,
      p_invitee_notes: input.inviteeNotes ?? null,
      p_location: null,
      p_meeting_url: null,
      p_responses: input.responses ?? {},
      p_requires_confirmation: requiresConfirmation,
    } as unknown as Database['public']['Functions']['create_asset_booking_if_available']['Args']
  );

  if (rpcError) {
    const msg = rpcError.message || '';
    if (msg.includes('CAPACITY_EXHAUSTED')) {
      return { success: false, error: 'No available capacity for this time slot', errorCode: 'CAPACITY_EXHAUSTED' };
    }
    if (msg.includes('ASSET_NOT_FOUND')) {
      return { success: false, error: 'Asset not found', errorCode: 'ASSET_NOT_FOUND' };
    }
    if (msg.includes('ACCESS_DISABLED')) {
      return { success: false, error: 'Access is not enabled for this asset', errorCode: 'ACCESS_DISABLED' };
    }
    if (msg.includes('NO_BOOKING_OWNER')) {
      return { success: false, error: 'Asset has no valid booking owner configured', errorCode: 'NO_BOOKING_OWNER' };
    }
    if (msg.includes('EVENT_TYPE_NOT_FOUND')) {
      return { success: false, error: 'Event type not found', errorCode: 'EVENT_TYPE_NOT_FOUND' };
    }
    return { success: false, error: msg };
  }

  if (!bookingId) {
    return { success: false, error: 'Booking creation returned no ID' };
  }

  const newBookingId = bookingId as string;
  const bookingStatus = requiresConfirmation ? 'pending' : 'confirmed';

  // Log audit event
  const auditAction = requiresConfirmation ? 'queued_for_review' : 'auto_confirmed';
  insertAccessEvent(supabase, {
    project_id: ctx.asset.project_id,
    booking_id: newBookingId,
    action: auditAction,
    actor_type: 'system',
    metadata: { asset_id: input.assetId, approval_policy: ctx.asset.approval_policy },
  }).catch((e) => console.error('Failed to log access event:', e));

  // Emit automation event
  const triggerType = requiresConfirmation ? 'asset_access.submitted' : 'asset_access.confirmed';
  emitAutomationEvent({
    projectId: ctx.asset.project_id,
    triggerType,
    entityType: 'asset_access_booking',
    entityId: newBookingId,
    data: {
      booking_id: newBookingId,
      asset_id: input.assetId,
      asset_name: ctx.asset.name,
      status: bookingStatus,
    },
  }).catch((e) => console.error('Failed to emit asset_access event:', e));

  return { success: true, bookingId: newBookingId, status: bookingStatus };
}

// ── Approval policy evaluation ─────────────────────────────────

/**
 * Determine whether a booking requires confirmation (manual review)
 * based on the asset's approval policy and any known person approval.
 */
export async function evaluateApprovalPolicy(
  supabase: ReturnType<typeof createServiceClient>,
  ctx: AssetAccessContext,
  personId?: string | null
): Promise<boolean> {
  switch (ctx.asset.approval_policy) {
    case 'open_auto':
      return false;
    case 'open_review':
      return true;
    case 'approved_only':
      if (!personId) return true;
      return !(await hasActiveApproval(supabase, ctx.asset.id, personId));
    default:
      return true;
  }
}

// ── Review actions ─────────────────────────────────────────────

/**
 * Process an approve/deny/grant_access_and_approve action on a pending booking.
 */
export async function reviewAssetBooking(
  input: ReviewRequestInput
): Promise<ReviewResult> {
  const supabase = createServiceClient();

  // Load booking
  const { data: booking, error: loadError } = await supabase
    .from('bookings')
    .select('id, status, project_id, event_type_id, invitee_email, invitee_name')
    .eq('id', input.bookingId)
    .single();

  if (loadError || !booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.status !== 'pending') {
    return { success: false, error: `Booking cannot be reviewed from status "${booking.status}"` };
  }

  if (input.action === 'grant_access_and_approve' && !input.personId) {
    return { success: false, error: 'personId is required for grant_access_and_approve' };
  }

  if (input.action === 'deny') {
    // Deny → cancel the booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_by: 'host', cancellation_reason: input.notes || 'Denied by reviewer' })
      .eq('id', input.bookingId);

    if (updateError) {
      return { success: false, error: 'Failed to deny booking' };
    }

    insertAccessEvent(supabase, {
      project_id: booking.project_id,
      booking_id: input.bookingId,
      action: 'denied',
      actor_type: 'user',
      actor_id: input.reviewerUserId,
      notes: input.notes,
    }).catch((e) => console.error('Failed to log deny event:', e));

    emitAutomationEvent({
      projectId: booking.project_id,
      triggerType: 'asset_access.denied',
      entityType: 'asset_access_booking',
      entityId: input.bookingId,
      data: { booking_id: input.bookingId, reviewer_id: input.reviewerUserId },
    }).catch((e) => console.error('Failed to emit asset_access.denied:', e));

    return { success: true };
  }

  // Approve or grant_access_and_approve
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', input.bookingId);

  if (updateError) {
    return { success: false, error: 'Failed to confirm booking' };
  }

  insertAccessEvent(supabase, {
    project_id: booking.project_id,
    booking_id: input.bookingId,
    action: 'approved',
    actor_type: 'user',
    actor_id: input.reviewerUserId,
    notes: input.notes,
  }).catch((e) => console.error('Failed to log approve event:', e));

  emitAutomationEvent({
    projectId: booking.project_id,
    triggerType: 'asset_access.confirmed',
    entityType: 'asset_access_booking',
    entityId: input.bookingId,
    data: { booking_id: input.bookingId, reviewer_id: input.reviewerUserId },
  }).catch((e) => console.error('Failed to emit asset_access.confirmed:', e));

  // If grant_access_and_approve, also create a person approval
  if (input.action === 'grant_access_and_approve' && input.personId) {
    // Load event type to get asset_id
    const { data: et } = await supabase
      .from('event_types')
      .select('asset_id')
      .eq('id', booking.event_type_id)
      .single();

    if (et?.asset_id) {
      await supabase
        .from('community_asset_person_approvals')
        .upsert(
          {
            project_id: booking.project_id,
            asset_id: et.asset_id,
            person_id: input.personId,
            status: 'active',
            notes: input.notes ?? null,
            expires_at: input.expires_at ?? null,
            created_by: input.reviewerUserId,
          },
          { onConflict: 'asset_id,person_id' }
        );

      insertAccessEvent(supabase, {
        project_id: booking.project_id,
        booking_id: input.bookingId,
        action: 'access_granted',
        actor_type: 'user',
        actor_id: input.reviewerUserId,
        metadata: { person_id: input.personId },
      }).catch((e) => console.error('Failed to log access_granted event:', e));
    }
  }

  return { success: true };
}

// ── Return tracking ────────────────────────────────────────────

/**
 * Mark a loanable asset booking as returned (completed).
 */
export async function markAssetReturned(
  bookingId: string,
  userId: string,
  notes?: string
): Promise<ReviewResult> {
  const supabase = createServiceClient();

  const { data: booking, error: loadError } = await supabase
    .from('bookings')
    .select('id, status, project_id, event_type_id')
    .eq('id', bookingId)
    .single();

  if (loadError || !booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.status !== 'confirmed') {
    return { success: false, error: `Cannot mark return from status "${booking.status}"` };
  }

  const { data: eventType, error: eventTypeError } = await supabase
    .from('event_types')
    .select('asset_id')
    .eq('id', booking.event_type_id)
    .maybeSingle();

  if (eventTypeError || !eventType?.asset_id) {
    return { success: false, error: 'Booking is not linked to an asset' };
  }

  const ctx = await getAssetAccessContext(supabase, eventType.asset_id);
  if (!ctx) {
    return { success: false, error: 'Asset not found' };
  }

  const returnableMode = ctx.asset.access_mode === 'loanable' || ctx.asset.access_mode === 'hybrid';
  if (!ctx.asset.return_required && !returnableMode) {
    return { success: false, error: 'Asset does not support return tracking' };
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId);

  if (updateError) {
    return { success: false, error: 'Failed to update booking status' };
  }

  insertAccessEvent(supabase, {
    project_id: booking.project_id,
    booking_id: bookingId,
    action: 'returned',
    actor_type: 'user',
    actor_id: userId,
    notes,
  }).catch((e) => console.error('Failed to log returned event:', e));

  emitAutomationEvent({
    projectId: booking.project_id,
    triggerType: 'asset_access.returned',
    entityType: 'asset_access_booking',
    entityId: bookingId,
    data: { booking_id: bookingId, returned_by: userId },
  }).catch((e) => console.error('Failed to emit asset_access.returned:', e));

  return { success: true };
}

// ── Cancel asset booking ───────────────────────────────────────

/**
 * Cancel an asset-linked booking with audit logging.
 */
export async function cancelAssetBooking(
  bookingId: string,
  cancelledBy: 'host' | 'invitee',
  actorId: string | null,
  reason?: string
): Promise<ReviewResult> {
  const supabase = createServiceClient();

  const { data: booking, error: loadError } = await supabase
    .from('bookings')
    .select('id, status, project_id')
    .eq('id', bookingId)
    .single();

  if (loadError || !booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (['cancelled', 'completed', 'no_show', 'rescheduled'].includes(booking.status)) {
    return { success: false, error: 'Booking cannot be cancelled in its current status' };
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: cancelledBy,
      cancellation_reason: reason || null,
    })
    .eq('id', bookingId);

  if (updateError) {
    return { success: false, error: 'Failed to cancel booking' };
  }

  insertAccessEvent(supabase, {
    project_id: booking.project_id,
    booking_id: bookingId,
    action: 'cancelled',
    actor_type: cancelledBy === 'host' ? 'user' : 'guest',
    actor_id: actorId,
    notes: reason,
  }).catch((e) => console.error('Failed to log cancel event:', e));

  emitAutomationEvent({
    projectId: booking.project_id,
    triggerType: 'asset_access.cancelled',
    entityType: 'asset_access_booking',
    entityId: bookingId,
    data: { booking_id: bookingId, cancelled_by: cancelledBy },
  }).catch((e) => console.error('Failed to emit asset_access.cancelled:', e));

  return { success: true };
}
