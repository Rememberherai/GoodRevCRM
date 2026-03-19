// Calendar module types

export type LocationType = 'video' | 'phone' | 'in_person' | 'custom' | 'ask_invitee';
export type SchedulingType = 'one_on_one' | 'group' | 'round_robin' | 'collective';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'no_show';
export type CancelledBy = 'host' | 'invitee' | 'system';
export type QuestionType = 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'phone' | 'email';

export interface CustomQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
}

// Calendar profile — one per user, scheduling identity
export interface CalendarProfile {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  bio: string | null;
  timezone: string;
  avatar_url: string | null;
  welcome_message: string | null;
  booking_page_theme: Record<string, unknown>;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

// Availability schedule — named schedule per user
export interface AvailabilitySchedule {
  id: string;
  user_id: string;
  name: string;
  timezone: string;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

// Availability rule — weekly recurring window
export interface AvailabilityRule {
  id: string;
  schedule_id: string;
  day_of_week: number; // 0=Sunday
  start_time: string;  // HH:MM:SS
  end_time: string;    // HH:MM:SS
}

// Availability override — date-specific block or extra hours
export interface AvailabilityOverride {
  id: string;
  user_id: string;
  date: string;        // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  reason: string | null;
  created_at: string;
}

// Schedule with rules
export interface AvailabilityScheduleWithRules extends AvailabilitySchedule {
  rules: AvailabilityRule[];
}

// Event type — project-scoped
export interface EventType {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string | null;
  is_active: boolean | null;
  location_type: LocationType;
  location_value: string | null;
  buffer_before_minutes: number | null;
  buffer_after_minutes: number | null;
  min_notice_hours: number | null;
  max_days_in_advance: number | null;
  slot_interval_minutes: number | null;
  daily_limit: number | null;
  weekly_limit: number | null;
  schedule_id: string | null;
  requires_confirmation: boolean | null;
  custom_questions: CustomQuestion[];
  confirmation_message: string | null;
  cancellation_policy: string | null;
  scheduling_type: SchedulingType | null;
  max_attendees: number | null;
  default_meeting_type: string;
  redirect_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Booking — project-scoped
export interface Booking {
  id: string;
  event_type_id: string;
  host_user_id: string;
  project_id: string;
  invitee_name: string;
  invitee_email: string;
  invitee_phone: string | null;
  invitee_timezone: string | null;
  invitee_notes: string | null;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  cancellation_reason: string | null;
  cancelled_by: CancelledBy | null;
  rescheduled_from_id: string | null;
  location: string | null;
  meeting_url: string | null;
  responses: Record<string, unknown>;
  meeting_id: string | null;
  person_id: string | null;
  organization_id: string | null;
  cancel_token: string | null;
  reschedule_token: string | null;
  ics_token: string | null;
  token_expires_at: string | null;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  effective_block_start: string;
  effective_block_end: string;
  reminder_sent_24h: boolean | null;
  reminder_sent_1h: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

// Booking with relations for dashboard views
export interface BookingWithRelations extends Booking {
  event_type: Pick<EventType, 'id' | 'title' | 'slug' | 'color' | 'duration_minutes' | 'location_type'>;
  host?: {
    display_name: string;
    email: string;
    avatar_url: string | null;
  };
}

// Slot types for the booking flow
export interface TimeSlot {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export interface AvailableDay {
  date: string;        // YYYY-MM-DD
  slots: TimeSlot[];
}

// Public profile data (safe subset from RPC)
export interface PublicCalendarProfile {
  display_name: string;
  bio: string | null;
  timezone: string;
  avatar_url: string | null;
  welcome_message: string | null;
  booking_page_theme: Record<string, unknown>;
}

// Public event type data (safe subset from RPC)
export interface PublicEventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  location_type: LocationType;
  location_value: string | null;
  custom_questions: CustomQuestion[];
  confirmation_message: string | null;
  cancellation_policy: string | null;
  scheduling_type?: 'one_on_one' | 'group' | 'round_robin' | 'collective';
}

// Labels and constants
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  no_show: 'No Show',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  rescheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-indigo-100 text-indigo-800',
  no_show: 'bg-red-100 text-red-800',
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  video: 'Video Call',
  phone: 'Phone Call',
  in_person: 'In Person',
  custom: 'Custom Location',
  ask_invitee: 'Ask Invitee',
};

// Calendar integration — Google Calendar OAuth connection
export type CalendarIntegrationStatus = 'connected' | 'disconnected' | 'expired' | 'error';
export type SyncedEventStatus = 'busy' | 'free' | 'tentative' | 'out_of_office';

export interface CalendarIntegration {
  id: string;
  user_id: string;
  provider: string;
  email: string;
  gmail_connection_id: string | null;
  calendar_id: string | null;
  is_primary: boolean | null;
  sync_enabled: boolean | null;
  push_enabled: boolean | null;
  last_synced_at: string | null;
  sync_token: string | null;
  initial_sync_done: boolean | null;
  sync_errors_count: number | null;
  last_sync_error: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface SyncedEvent {
  id: string;
  integration_id: string;
  user_id: string;
  external_id: string;
  title: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean | null;
  status: string | null;
  source_calendar: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Team scheduling — event type members and round-robin state
export interface EventTypeMember {
  id: string;
  event_type_id: string;
  user_id: string;
  is_active: boolean | null;
  priority: number | null;
  created_at: string | null;
}

export interface EventTypeMemberWithUser extends EventTypeMember {
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export interface RoundRobinState {
  id: string;
  event_type_id: string;
  last_assigned_user_id: string | null;
  assignment_count: Record<string, number>;
  updated_at: string | null;
}

export const SCHEDULING_TYPE_LABELS: Record<SchedulingType, string> = {
  one_on_one: 'One-on-One',
  group: 'Group',
  round_robin: 'Round Robin',
  collective: 'Collective',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Short Text',
  textarea: 'Long Text',
  select: 'Dropdown',
  radio: 'Radio Buttons',
  checkbox: 'Checkboxes',
  phone: 'Phone Number',
  email: 'Email Address',
};
