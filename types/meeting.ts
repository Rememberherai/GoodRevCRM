// Meeting types
export type MeetingType =
  | 'discovery'
  | 'demo'
  | 'proposal_review'
  | 'negotiation'
  | 'onboarding'
  | 'check_in'
  | 'qbr'
  | 'general';

export type MeetingStatus =
  | 'scheduled'
  | 'confirmed'
  | 'attended'
  | 'no_show'
  | 'rescheduled'
  | 'cancelled';

export type MeetingOutcome =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'follow_up_needed'
  | 'deal_advanced'
  | 'no_outcome';

export type AttendanceStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'tentative'
  | 'attended'
  | 'no_show';

// Meeting record
export interface Meeting {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  meeting_type: MeetingType;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  status: MeetingStatus;
  status_changed_at: string | null;
  rescheduled_from: string | null;
  reschedule_count: number;
  cancellation_reason: string | null;
  outcome: MeetingOutcome | null;
  outcome_notes: string | null;
  next_steps: string | null;
  person_id: string | null;
  organization_id: string | null;
  opportunity_id: string | null;
  rfp_id: string | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

// Meeting attendee
export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  person_id: string | null;
  user_id: string | null;
  attendance_status: AttendanceStatus;
  created_at: string;
  person?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

// Meeting with resolved relations
export interface MeetingWithRelations extends Meeting {
  person?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  organization?: {
    id: string;
    name: string;
  } | null;
  opportunity?: {
    id: string;
    name: string;
  } | null;
  attendees?: MeetingAttendee[];
  created_by_user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  assigned_to_user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

// Constants

export const meetingTypes: MeetingType[] = [
  'discovery', 'demo', 'proposal_review', 'negotiation',
  'onboarding', 'check_in', 'qbr', 'general',
];

export const meetingStatuses: MeetingStatus[] = [
  'scheduled', 'confirmed', 'attended', 'no_show', 'rescheduled', 'cancelled',
];

export const meetingOutcomes: MeetingOutcome[] = [
  'positive', 'neutral', 'negative', 'follow_up_needed', 'deal_advanced', 'no_outcome',
];

export const attendanceStatuses: AttendanceStatus[] = [
  'pending', 'accepted', 'declined', 'tentative', 'attended', 'no_show',
];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  discovery: 'Discovery',
  demo: 'Demo',
  proposal_review: 'Proposal Review',
  negotiation: 'Negotiation',
  onboarding: 'Onboarding',
  check_in: 'Check-in',
  qbr: 'QBR',
  general: 'General',
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  attended: 'Attended',
  no_show: 'No Show',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
};

export const MEETING_STATUS_COLORS: Record<MeetingStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  attended: 'bg-green-100 text-green-800',
  no_show: 'bg-red-100 text-red-800',
  rescheduled: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export const MEETING_OUTCOME_LABELS: Record<MeetingOutcome, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  follow_up_needed: 'Follow-up Needed',
  deal_advanced: 'Deal Advanced',
  no_outcome: 'No Outcome',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  tentative: 'Tentative',
  attended: 'Attended',
  no_show: 'No Show',
};
