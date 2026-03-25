export type CommunityGeocodedStatus = 'pending' | 'success' | 'failed' | 'manual';

export type HouseholdMemberRelationship =
  | 'head_of_household'
  | 'spouse_partner'
  | 'child'
  | 'dependent'
  | 'extended_family'
  | 'other';

export type HouseholdIntakeStatus = 'draft' | 'active' | 'closed';

export type ProgramStatus = 'planning' | 'active' | 'completed' | 'suspended';
export type ProgramEnrollmentStatus = 'active' | 'completed' | 'withdrawn' | 'waitlisted';
export type WaiverStatus = 'not_required' | 'pending' | 'signed';
export type AttendanceStatus = 'present' | 'absent' | 'excused';

export type ContributionType = 'monetary' | 'in_kind' | 'volunteer_hours' | 'grant' | 'service';
export type ContributionStatus = 'pledged' | 'received' | 'completed' | 'cancelled';

export type CommunityAssetCategory = 'facility' | 'land' | 'equipment' | 'vehicle' | 'technology' | 'other';
export type CommunityAssetCondition = 'excellent' | 'good' | 'fair' | 'poor';

export type ContractorScopeStatus = 'draft' | 'pending_signature' | 'active' | 'expired' | 'cancelled';
export type JobStatus =
  | 'draft'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'declined'
  | 'pulled'
  | 'cancelled';
export type JobPriority = 'high' | 'medium' | 'low';

export type ReceiptConfirmationStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'executed'
  | 'failed';

export type GrantStatus =
  | 'researching'
  | 'preparing'
  | 'submitted'
  | 'under_review'
  | 'awarded'
  | 'declined';

export type ReferralStatus = 'submitted' | 'acknowledged' | 'in_progress' | 'completed' | 'closed';

export type RelationshipType =
  | 'neighbor'
  | 'family'
  | 'mentor_mentee'
  | 'friend'
  | 'caregiver'
  | 'colleague'
  | 'service_provider_client'
  | 'other';

export type BroadcastChannel = 'email' | 'sms' | 'both';
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

export type PublicDashboardStatus = 'draft' | 'preview' | 'published' | 'archived';
export type PublicDashboardAccessType = 'public' | 'password' | 'signed_link';
export type PublicDashboardDataFreshness = 'live' | 'snapshot';
export type PublicDashboardDateRangeType = 'rolling' | 'fixed';
export type PublicDashboardGeoGranularity = 'zip' | 'neighborhood';
export type PublicDashboardWidgetType =
  | 'metric_card'
  | 'bar_chart'
  | 'radar_chart'
  | 'map_heatmap'
  | 'program_summary'
  | 'contribution_summary'
  | 'text_block';

export interface ImpactDimensionTemplate {
  key: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface ImpactFrameworkTemplate {
  type: 'ccf' | 'vital_conditions' | 'custom';
  name: string;
  description: string;
  dimensions: ImpactDimensionTemplate[];
}

type JsonObject = Record<string, unknown>;
type CommunityInsert<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;
type CommunityUpdate<T> = Partial<Omit<T, 'id' | 'created_at'>>;

interface CommunityTimestamps {
  created_at: string;
  updated_at: string;
}

interface CommunitySoftDelete {
  deleted_at: string | null;
}

// These interfaces are the pre-migration application-facing source of truth.
// After the SQL is applied, `types/database.ts` should be regenerated and kept in sync.
export interface ImpactFramework extends CommunityTimestamps {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  type: 'ccf' | 'vital_conditions' | 'custom';
  is_active: boolean;
}
export type ImpactFrameworkInsert = CommunityInsert<ImpactFramework>;
export type ImpactFrameworkUpdate = CommunityUpdate<ImpactFramework>;

export interface ImpactDimension extends CommunityTimestamps {
  id: string;
  framework_id: string;
  key: string;
  label: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}
export type ImpactDimensionInsert = CommunityInsert<ImpactDimension>;
export type ImpactDimensionUpdate = CommunityUpdate<ImpactDimension>;

export interface Household extends CommunityTimestamps, CommunitySoftDelete {
  id: string;
  project_id: string;
  name: string;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoded_status: CommunityGeocodedStatus;
  household_size: number | null;
  primary_contact_person_id: string | null;
  notes: string | null;
  custom_fields: JsonObject;
  created_by: string | null;
}
export type HouseholdInsert = CommunityInsert<Household>;
export type HouseholdUpdate = CommunityUpdate<Household>;

export interface HouseholdMember extends CommunityTimestamps {
  id: string;
  household_id: string;
  person_id: string;
  relationship: HouseholdMemberRelationship;
  is_primary_contact: boolean;
  start_date: string;
  end_date: string | null;
}
export type HouseholdMemberInsert = CommunityInsert<HouseholdMember>;
export type HouseholdMemberUpdate = CommunityUpdate<HouseholdMember>;

export interface HouseholdIntake extends CommunityTimestamps {
  id: string;
  household_id: string;
  assessed_by: string | null;
  assessed_at: string;
  needs: JsonObject;
  notes: string | null;
  status: HouseholdIntakeStatus;
}
export type HouseholdIntakeInsert = CommunityInsert<HouseholdIntake>;
export type HouseholdIntakeUpdate = CommunityUpdate<HouseholdIntake>;

export interface Program extends CommunityTimestamps {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  target_dimensions: string[];
  status: ProgramStatus;
  capacity: number | null;
  schedule: JsonObject | null;
  location_name: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  requires_waiver: boolean;
}
export type ProgramInsert = CommunityInsert<Program>;
export type ProgramUpdate = CommunityUpdate<Program>;

export interface ProgramEnrollment extends CommunityTimestamps {
  id: string;
  program_id: string;
  person_id: string | null;
  household_id: string | null;
  status: ProgramEnrollmentStatus;
  waiver_status: WaiverStatus;
  enrolled_at: string;
  completed_at: string | null;
  notes: string | null;
}
export type ProgramEnrollmentInsert = CommunityInsert<ProgramEnrollment>;
export type ProgramEnrollmentUpdate = CommunityUpdate<ProgramEnrollment>;

export interface ProgramWaiver extends CommunityTimestamps {
  id: string;
  program_id: string;
  template_id: string;
}
export type ProgramWaiverInsert = CommunityInsert<ProgramWaiver>;

export interface EnrollmentWaiver extends CommunityTimestamps {
  id: string;
  enrollment_id: string;
  program_waiver_id: string;
  contract_document_id: string | null;
  signed_at: string | null;
}
export type EnrollmentWaiverInsert = CommunityInsert<EnrollmentWaiver>;

export interface ProgramAttendance extends CommunityTimestamps {
  id: string;
  program_id: string;
  person_id: string;
  date: string;
  status: AttendanceStatus;
  hours: number;
}
export type ProgramAttendanceInsert = CommunityInsert<ProgramAttendance>;
export type ProgramAttendanceUpdate = CommunityUpdate<ProgramAttendance>;

export interface Contribution extends CommunityTimestamps {
  id: string;
  project_id: string;
  type: ContributionType;
  status: ContributionStatus;
  dimension_id: string | null;
  grant_id: string | null;
  program_id: string | null;
  donor_person_id: string | null;
  donor_organization_id: string | null;
  donor_household_id: string | null;
  recipient_person_id: string | null;
  recipient_household_id: string | null;
  value: number | null;
  currency: string;
  hours: number | null;
  description: string | null;
  date: string;
}
export type ContributionInsert = CommunityInsert<Contribution>;
export type ContributionUpdate = CommunityUpdate<Contribution>;

export interface CommunityAsset extends CommunityTimestamps {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  category: CommunityAssetCategory;
  dimension_id: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoded_status: CommunityGeocodedStatus;
  condition: CommunityAssetCondition;
  value_estimate: number | null;
  steward_person_id: string | null;
  steward_organization_id: string | null;
  notes: string | null;
}
export type CommunityAssetInsert = CommunityInsert<CommunityAsset>;
export type CommunityAssetUpdate = CommunityUpdate<CommunityAsset>;

export interface ContractorScope extends CommunityTimestamps {
  id: string;
  project_id: string;
  contractor_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  compensation_terms: string | null;
  status: ContractorScopeStatus;
  document_url: string | null;
  service_categories: string[];
  certifications: string[];
  service_area_radius_miles: number | null;
  home_base_latitude: number | null;
  home_base_longitude: number | null;
}
export type ContractorScopeInsert = CommunityInsert<ContractorScope>;
export type ContractorScopeUpdate = CommunityUpdate<ContractorScope>;

export interface Job extends CommunityTimestamps {
  id: string;
  project_id: string;
  contractor_id: string | null;
  assigned_by: string | null;
  scope_id: string | null;
  title: string;
  description: string | null;
  status: JobStatus;
  priority: JobPriority;
  desired_start: string | null;
  deadline: string | null;
  service_address: string | null;
  service_latitude: number | null;
  service_longitude: number | null;
  service_category: string | null;
  required_certifications: string[];
  is_out_of_scope: boolean;
  notes: string | null;
  pulled_at: string | null;
  completed_at: string | null;
}
export type JobInsert = CommunityInsert<Job>;
export type JobUpdate = CommunityUpdate<Job>;

export interface JobTimeEntry extends CommunityTimestamps {
  id: string;
  job_id: string;
  started_at: string;
  ended_at: string | null;
  is_break: boolean;
  duration_minutes: number | null;
  notes: string | null;
}
export type JobTimeEntryInsert = CommunityInsert<JobTimeEntry>;
export type JobTimeEntryUpdate = CommunityUpdate<JobTimeEntry>;

export interface ReceiptConfirmation extends CommunityTimestamps {
  id: string;
  project_id: string;
  submitted_by: string | null;
  vendor: string;
  amount: number;
  receipt_date: string;
  description: string | null;
  account_code: string | null;
  class_name: string | null;
  ocr_raw: JsonObject;
  accounting_target: 'goodrev' | 'quickbooks';
  external_bill_id: string | null;
  status: ReceiptConfirmationStatus;
  image_url: string;
  error_message: string | null;
}
export type ReceiptConfirmationInsert = CommunityInsert<ReceiptConfirmation>;
export type ReceiptConfirmationUpdate = CommunityUpdate<ReceiptConfirmation>;

export interface Grant extends CommunityTimestamps {
  id: string;
  project_id: string;
  name: string;
  funder_organization_id: string | null;
  amount_requested: number | null;
  amount_awarded: number | null;
  status: GrantStatus;
  loi_due_at: string | null;
  application_due_at: string | null;
  report_due_at: string | null;
  assigned_to: string | null;
  contact_person_id: string | null;
  notes: string | null;
}
export type GrantInsert = CommunityInsert<Grant>;
export type GrantUpdate = CommunityUpdate<Grant>;

export interface Referral extends CommunityTimestamps {
  id: string;
  project_id: string;
  person_id: string | null;
  household_id: string | null;
  partner_organization_id: string | null;
  service_type: string;
  status: ReferralStatus;
  outcome: string | null;
  notes: string | null;
}
export type ReferralInsert = CommunityInsert<Referral>;
export type ReferralUpdate = CommunityUpdate<Referral>;

export interface Relationship extends CommunityTimestamps {
  id: string;
  project_id: string;
  person_a_id: string;
  person_b_id: string;
  type: RelationshipType;
  notes: string | null;
}
export type RelationshipInsert = CommunityInsert<Relationship>;
export type RelationshipUpdate = CommunityUpdate<Relationship>;

export interface Broadcast extends CommunityTimestamps {
  id: string;
  project_id: string;
  created_by: string | null;
  subject: string;
  body: string;
  channel: BroadcastChannel;
  filter_criteria: JsonObject;
  status: BroadcastStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  failure_reason: string | null;
}
export type BroadcastInsert = CommunityInsert<Broadcast>;
export type BroadcastUpdate = CommunityUpdate<Broadcast>;

export interface PublicDashboardConfig extends CommunityTimestamps {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  slug: string;
  status: PublicDashboardStatus;
  theme: JsonObject;
  widget_order: string[];
  widgets: JsonObject[];
  hero_image_url: string | null;
  min_count_threshold: number;
  excluded_categories: string[];
  access_type: PublicDashboardAccessType;
  password_hash: string | null;
  data_freshness: PublicDashboardDataFreshness;
  snapshot_data: JsonObject | null;
  date_range_type: PublicDashboardDateRangeType;
  date_range_start: string | null;
  date_range_end: string | null;
  geo_granularity: PublicDashboardGeoGranularity;
  published_at: string | null;
  published_by: string | null;
  archived_at: string | null;
}
export type PublicDashboardConfigInsert = CommunityInsert<PublicDashboardConfig>;
export type PublicDashboardConfigUpdate = CommunityUpdate<PublicDashboardConfig>;

export interface PublicDashboardShareLink extends CommunityTimestamps {
  id: string;
  config_id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  is_active: boolean;
  last_accessed_at: string | null;
  access_count: number;
  created_by: string | null;
}
export type PublicDashboardShareLinkInsert = CommunityInsert<PublicDashboardShareLink>;
export type PublicDashboardShareLinkUpdate = CommunityUpdate<PublicDashboardShareLink>;

// ── Event Calendar ──────────────────────────────────────────

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'postponed' | 'completed';
export type EventVisibility = 'public' | 'unlisted' | 'private';
export type EventLocationType = 'in_person' | 'virtual' | 'hybrid';
export type EventRegistrationStatus = 'pending_approval' | 'pending_waiver' | 'confirmed' | 'waitlisted' | 'cancelled';
export type EventSeriesStatus = 'draft' | 'active' | 'paused' | 'completed';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type EventWaiverStatus = 'not_required' | 'pending' | 'signed';
export type EventRegistrationSource = 'web' | 'embed' | 'api' | 'manual' | 'import';

export interface EventCalendarSettings extends CommunityTimestamps {
  id: string;
  project_id: string;
  is_enabled: boolean;
  slug: string;
  title: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string | null;
  timezone: string;
}
export type EventCalendarSettingsInsert = CommunityInsert<EventCalendarSettings>;
export type EventCalendarSettingsUpdate = CommunityUpdate<EventCalendarSettings>;

export interface EventSeries extends CommunityTimestamps {
  id: string;
  project_id: string;
  program_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  description_html: string | null;
  recurrence_frequency: RecurrenceFrequency;
  recurrence_days_of_week: string[];
  recurrence_interval: number;
  recurrence_until: string | null;
  recurrence_count: number | null;
  recurrence_day_position: number | null;
  template_start_time: string;
  template_end_time: string;
  timezone: string;
  location_type: EventLocationType;
  venue_name: string | null;
  venue_address: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  virtual_url: string | null;
  registration_enabled: boolean;
  total_capacity: number | null;
  waitlist_enabled: boolean;
  max_tickets_per_registration: number;
  require_approval: boolean;
  custom_questions: JsonObject[];
  cover_image_url: string | null;
  category: string | null;
  tags: string[];
  visibility: EventVisibility;
  confirmation_message: string | null;
  cancellation_policy: string | null;
  requires_waiver: boolean;
  organizer_name: string | null;
  organizer_email: string | null;
  last_generated_date: string | null;
  generation_horizon_days: number;
  status: EventSeriesStatus;
}
export type EventSeriesInsert = CommunityInsert<EventSeries>;
export type EventSeriesUpdate = CommunityUpdate<EventSeries>;

export interface EventSeriesRegistration extends CommunityTimestamps {
  id: string;
  series_id: string;
  person_id: string | null;
  registrant_name: string;
  registrant_email: string;
  registrant_phone: string | null;
  status: 'active' | 'cancelled';
  responses: JsonObject;
  cancel_token: string | null;
  source: EventRegistrationSource;
}
export type EventSeriesRegistrationInsert = CommunityInsert<EventSeriesRegistration>;

export interface Event extends CommunityTimestamps {
  id: string;
  project_id: string;
  program_id: string | null;
  series_id: string | null;
  series_index: number | null;
  series_instance_modified: boolean;
  created_by: string | null;
  title: string;
  slug: string;
  description: string | null;
  description_html: string | null;
  cover_image_url: string | null;
  category: string | null;
  tags: string[];
  starts_at: string;
  ends_at: string;
  timezone: string;
  is_all_day: boolean;
  location_type: EventLocationType;
  venue_name: string | null;
  venue_address: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  virtual_url: string | null;
  registration_enabled: boolean;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  total_capacity: number | null;
  waitlist_enabled: boolean;
  max_tickets_per_registration: number;
  require_approval: boolean;
  add_to_crm: boolean;
  custom_questions: JsonObject[];
  status: EventStatus;
  visibility: EventVisibility;
  published_at: string | null;
  organizer_name: string | null;
  organizer_email: string | null;
  confirmation_message: string | null;
  cancellation_policy: string | null;
  requires_waiver: boolean;
}
export type EventInsert = CommunityInsert<Event>;
export type EventUpdate = CommunityUpdate<Event>;

export interface EventTicketType extends CommunityTimestamps {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  quantity_available: number | null;
  max_per_order: number;
  sort_order: number;
  sales_start_at: string | null;
  sales_end_at: string | null;
  is_active: boolean;
  is_hidden: boolean;
}
export type EventTicketTypeInsert = CommunityInsert<EventTicketType>;
export type EventTicketTypeUpdate = CommunityUpdate<EventTicketType>;

export interface EventRegistration extends CommunityTimestamps {
  id: string;
  event_id: string;
  series_registration_id: string | null;
  person_id: string | null;
  registrant_name: string;
  registrant_email: string;
  registrant_phone: string | null;
  status: EventRegistrationStatus;
  responses: JsonObject;
  confirmation_token: string | null;
  cancel_token: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  waiver_status: EventWaiverStatus;
  waiver_signed_at: string | null;
  reminder_sent_24h: boolean;
  reminder_sent_1h: boolean;
  source: EventRegistrationSource;
  ip_address: string | null;
  user_agent: string | null;
}
export type EventRegistrationInsert = CommunityInsert<EventRegistration>;
export type EventRegistrationUpdate = CommunityUpdate<EventRegistration>;

export interface EventRegistrationTicket {
  id: string;
  registration_id: string;
  ticket_type_id: string;
  attendee_name: string | null;
  attendee_email: string | null;
  qr_code: string | null;
  checked_in_at: string | null;
  created_at: string;
}

export interface EventWaiver extends CommunityTimestamps {
  id: string;
  event_id: string;
  template_id: string;
}
export type EventWaiverInsert = CommunityInsert<EventWaiver>;

export interface RegistrationWaiver extends CommunityTimestamps {
  id: string;
  registration_id: string;
  event_waiver_id: string;
  contract_document_id: string | null;
  signed_at: string | null;
}
export type RegistrationWaiverInsert = CommunityInsert<RegistrationWaiver>;
