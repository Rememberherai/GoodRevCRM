// Webhook types

export type WebhookEventType =
  | 'person.created'
  | 'person.updated'
  | 'person.deleted'
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'opportunity.created'
  | 'opportunity.updated'
  | 'opportunity.deleted'
  | 'opportunity.stage_changed'
  | 'opportunity.won'
  | 'opportunity.lost'
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.completed'
  | 'rfp.created'
  | 'rfp.updated'
  | 'rfp.deleted'
  | 'rfp.status_changed'
  | 'email.sent'
  | 'email.opened'
  | 'email.clicked'
  | 'email.replied';

export type WebhookDeliveryStatus =
  | 'pending'
  | 'delivered'
  | 'failed'
  | 'retrying';

export interface Webhook {
  id: string;
  project_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: WebhookEventType[];
  headers: Record<string, string>;
  is_active: boolean;
  retry_count: number;
  timeout_ms: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: WebhookEventType;
  payload: WebhookPayload;
  request_headers: Record<string, string> | null;
  response_status: number | null;
  response_body: string | null;
  response_headers: Record<string, string> | null;
  duration_ms: number | null;
  attempt_number: number;
  status: WebhookDeliveryStatus;
  error_message: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
  previous_data?: Record<string, unknown>;
}

export interface WebhookWithStats extends Webhook {
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  last_delivery_at: string | null;
}

// Event groups for UI
export const webhookEventGroups = {
  people: [
    'person.created',
    'person.updated',
    'person.deleted',
  ] as WebhookEventType[],
  organizations: [
    'organization.created',
    'organization.updated',
    'organization.deleted',
  ] as WebhookEventType[],
  opportunities: [
    'opportunity.created',
    'opportunity.updated',
    'opportunity.deleted',
    'opportunity.stage_changed',
    'opportunity.won',
    'opportunity.lost',
  ] as WebhookEventType[],
  tasks: [
    'task.created',
    'task.updated',
    'task.deleted',
    'task.completed',
  ] as WebhookEventType[],
  rfps: [
    'rfp.created',
    'rfp.updated',
    'rfp.deleted',
    'rfp.status_changed',
  ] as WebhookEventType[],
  emails: [
    'email.sent',
    'email.opened',
    'email.clicked',
    'email.replied',
  ] as WebhookEventType[],
};

export const allWebhookEvents = Object.values(webhookEventGroups).flat();
