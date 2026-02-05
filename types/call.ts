// Telnyx VoIP call types

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'answered'
  | 'hangup'
  | 'failed'
  | 'busy'
  | 'no_answer'
  | 'machine_detected';

export type CallDisposition =
  | 'no_answer'
  | 'left_voicemail'
  | 'busy'
  | 'wrong_number'
  | 'quality_conversation'
  | 'meeting_booked'
  | 'not_interested'
  | 'call_back_later'
  | 'do_not_call'
  | 'other';

export type AmdResult = 'human' | 'machine' | 'not_sure' | 'fax';

export interface Call {
  id: string;
  project_id: string;
  telnyx_connection_id: string;
  telnyx_call_control_id: string | null;
  telnyx_call_leg_id: string | null;
  telnyx_call_session_id: string | null;
  direction: CallDirection;
  status: CallStatus;
  from_number: string;
  to_number: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  talk_time_seconds: number | null;
  amd_result: AmdResult | null;
  recording_enabled: boolean;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  disposition: CallDisposition | null;
  disposition_notes: string | null;
  person_id: string | null;
  organization_id: string | null;
  opportunity_id: string | null;
  rfp_id: string | null;
  user_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CallWithRelations extends Call {
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
  user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface TelnyxConnection {
  id: string;
  project_id: string;
  created_by: string;
  api_key: string;
  call_control_app_id: string | null;
  sip_connection_id: string | null;
  sip_username: string | null;
  sip_password: string | null;
  phone_number: string;
  phone_number_id: string | null;
  record_calls: boolean;
  amd_enabled: boolean;
  caller_id_name: string | null;
  status: 'active' | 'inactive' | 'error';
  error_message: string | null;
  last_call_at: string | null;
  created_at: string;
  updated_at: string;
}

// Omit sensitive fields for client-side usage
export type TelnyxConnectionPublic = Omit<
  TelnyxConnection,
  'api_key' | 'sip_password'
>;

export interface CallMetrics {
  total_calls: number;
  outbound_calls: number;
  inbound_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_talk_time_seconds: number;
  avg_talk_time_seconds: number;
  meetings_booked: number;
  quality_conversations: number;
  voicemails_left: number;
  connect_rate: number;
  calls_by_disposition: Array<{ disposition: string; count: number }>;
  calls_by_day: Array<{ date: string; count: number }>;
}

export const DISPOSITION_LABELS: Record<CallDisposition, string> = {
  no_answer: 'No Answer',
  left_voicemail: 'Left Voicemail',
  busy: 'Busy',
  wrong_number: 'Wrong Number',
  quality_conversation: 'Quality Conversation',
  meeting_booked: 'Meeting Booked',
  not_interested: 'Not Interested',
  call_back_later: 'Call Back Later',
  do_not_call: 'Do Not Call',
  other: 'Other',
};

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  initiated: 'Dialing',
  ringing: 'Ringing',
  answered: 'In Progress',
  hangup: 'Completed',
  failed: 'Failed',
  busy: 'Busy',
  no_answer: 'No Answer',
  machine_detected: 'Voicemail',
};

// Map call dispositions to existing activity outcome values
export const DISPOSITION_TO_ACTIVITY_OUTCOME: Partial<Record<CallDisposition, string>> = {
  no_answer: 'call_no_answer',
  left_voicemail: 'call_left_message',
  quality_conversation: 'quality_conversation',
  meeting_booked: 'meeting_booked',
  not_interested: 'not_interested',
  call_back_later: 'follow_up_scheduled',
};
