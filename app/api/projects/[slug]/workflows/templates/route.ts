import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Built-in workflow templates that are always available
const BUILTIN_TEMPLATES = [
  {
    id: 'template-lead-qualification',
    name: 'Lead Qualification',
    description: 'Automatically qualify new leads based on criteria and route to the right team member',
    trigger_type: 'entity.created',
    tags: ['lead', 'qualification', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'New Lead Created', config: {} } },
        { id: 'cond-1', type: 'condition', position: { x: 250, y: 120 }, data: { label: 'Has Email?', config: { field: 'email', operator: 'is_not_empty', value: '' } } },
        { id: 'ai-1', type: 'ai_agent', position: { x: 100, y: 260 }, data: { label: 'Score Lead', config: { model: 'google/gemini-2.5-flash', prompt: 'Analyze this lead and provide a qualification score from 1-10 based on their title, company, and industry.' } } },
        { id: 'cond-2', type: 'condition', position: { x: 100, y: 400 }, data: { label: 'Score > 7?', config: { field: 'ai_result.score', operator: 'greater_than', value: 7 } } },
        { id: 'action-1', type: 'action', position: { x: -50, y: 540 }, data: { label: 'Create Task for Sales', config: { action_type: 'create_task', config: { title: 'Follow up with qualified lead' } } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 540 }, data: { label: 'Add to Nurture', config: { action_type: 'update_field', config: { field: 'status', value: 'nurture' } } } },
        { id: 'end-1', type: 'end', position: { x: 100, y: 680 }, data: { label: 'Done', config: {} } },
        { id: 'end-2', type: 'end', position: { x: 400, y: 260 }, data: { label: 'Skip (No Email)', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'cond-1' },
        { id: 'e2', source: 'cond-1', target: 'ai-1', sourceHandle: 'true', label: 'Yes' },
        { id: 'e3', source: 'cond-1', target: 'end-2', sourceHandle: 'false', label: 'No' },
        { id: 'e4', source: 'ai-1', target: 'cond-2' },
        { id: 'e5', source: 'cond-2', target: 'action-1', sourceHandle: 'true', label: 'Qualified' },
        { id: 'e6', source: 'cond-2', target: 'action-2', sourceHandle: 'false', label: 'Not Yet' },
        { id: 'e7', source: 'action-1', target: 'end-1' },
        { id: 'e8', source: 'action-2', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-deal-stage-notify',
    name: 'Deal Stage Change Notification',
    description: 'Send notifications and update records when opportunities move between stages',
    trigger_type: 'opportunity.stage_changed',
    tags: ['deals', 'notifications', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Stage Changed', config: {} } },
        { id: 'switch-1', type: 'switch', position: { x: 250, y: 120 }, data: { label: 'Which Stage?', config: { field: 'to_stage', cases: [{ value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }, { value: 'negotiation', label: 'Negotiation' }], default_label: 'Other' } } },
        { id: 'action-won', type: 'action', position: { x: -50, y: 280 }, data: { label: 'Send Won Email', config: { action_type: 'send_email', config: { template: 'deal_won' } } } },
        { id: 'action-lost', type: 'action', position: { x: 150, y: 280 }, data: { label: 'Log Lost Reason', config: { action_type: 'create_task', config: { title: 'Review lost deal' } } } },
        { id: 'action-nego', type: 'action', position: { x: 350, y: 280 }, data: { label: 'Alert Manager', config: { action_type: 'send_notification', config: { message: 'Deal entered negotiation' } } } },
        { id: 'end-1', type: 'end', position: { x: 150, y: 420 }, data: { label: 'Done', config: {} } },
        { id: 'end-2', type: 'end', position: { x: 550, y: 280 }, data: { label: 'No Action', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'switch-1' },
        { id: 'e2', source: 'switch-1', target: 'action-won', sourceHandle: 'Won', label: 'Won' },
        { id: 'e3', source: 'switch-1', target: 'action-lost', sourceHandle: 'Lost', label: 'Lost' },
        { id: 'e4', source: 'switch-1', target: 'action-nego', sourceHandle: 'Negotiation', label: 'Negotiation' },
        { id: 'e5', source: 'switch-1', target: 'end-2', sourceHandle: 'Other', label: 'Other' },
        { id: 'e6', source: 'action-won', target: 'end-1' },
        { id: 'e7', source: 'action-lost', target: 'end-1' },
        { id: 'e8', source: 'action-nego', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-onboarding-sequence',
    name: 'Customer Onboarding',
    description: 'Multi-step onboarding sequence with delays and conditional follow-ups',
    trigger_type: 'manual',
    tags: ['onboarding', 'sequence', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Start Onboarding', config: {} } },
        { id: 'action-1', type: 'action', position: { x: 250, y: 120 }, data: { label: 'Send Welcome Email', config: { action_type: 'send_email', config: { template: 'welcome' } } } },
        { id: 'delay-1', type: 'delay', position: { x: 250, y: 240 }, data: { label: 'Wait 2 Days', config: { delay_type: 'duration', duration_ms: 172800000 } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 360 }, data: { label: 'Send Setup Guide', config: { action_type: 'send_email', config: { template: 'setup_guide' } } } },
        { id: 'delay-2', type: 'delay', position: { x: 250, y: 480 }, data: { label: 'Wait 5 Days', config: { delay_type: 'duration', duration_ms: 432000000 } } },
        { id: 'cond-1', type: 'condition', position: { x: 250, y: 600 }, data: { label: 'Completed Setup?', config: { field: 'setup_complete', operator: 'equals', value: true } } },
        { id: 'action-3', type: 'action', position: { x: 100, y: 740 }, data: { label: 'Schedule Check-in', config: { action_type: 'create_task', config: { title: 'Customer check-in call' } } } },
        { id: 'action-4', type: 'action', position: { x: 400, y: 740 }, data: { label: 'Send Reminder', config: { action_type: 'send_email', config: { template: 'setup_reminder' } } } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 880 }, data: { label: 'Complete', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'delay-1' },
        { id: 'e3', source: 'delay-1', target: 'action-2' },
        { id: 'e4', source: 'action-2', target: 'delay-2' },
        { id: 'e5', source: 'delay-2', target: 'cond-1' },
        { id: 'e6', source: 'cond-1', target: 'action-3', sourceHandle: 'true', label: 'Yes' },
        { id: 'e7', source: 'cond-1', target: 'action-4', sourceHandle: 'false', label: 'No' },
        { id: 'e8', source: 'action-3', target: 'end-1' },
        { id: 'e9', source: 'action-4', target: 'end-1' },
      ],
    },
  },
];

// Community-specific workflow templates
const COMMUNITY_BUILTIN_TEMPLATES = [
  {
    id: 'template-household-intake',
    name: 'Household Intake & Enrollment',
    description: 'Welcome new households, assess needs via AI, and auto-enroll in appropriate programs',
    trigger_type: 'household.created',
    tags: ['household', 'intake', 'enrollment', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'New Household Created', config: { trigger_type: 'household.created' } } },
        { id: 'ai-1', type: 'ai_agent', position: { x: 250, y: 120 }, data: { label: 'Assess Household Needs', config: { model: 'google/gemini-2.5-flash', prompt: "Analyze this household's intake data and recommend the top 3 programs that would benefit them most. Consider household size, location, and any notes.", output_key: 'needs_assessment' } } },
        { id: 'action-1', type: 'action', position: { x: 250, y: 260 }, data: { label: 'Create Intake Task', config: { action_type: 'create_task', title: 'Complete intake assessment for {{household.name}}', priority: 'high', due_in_days: 2 } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 380 }, data: { label: 'Send Welcome Notification', config: { action_type: 'send_notification', notify_roles: ['owner', 'admin', 'staff', 'case_manager'], message: 'New household {{household.name}} has been added and needs intake review.' } } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 500 }, data: { label: 'Done', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'ai-1' },
        { id: 'e2', source: 'ai-1', target: 'action-1' },
        { id: 'e3', source: 'action-1', target: 'action-2' },
        { id: 'e4', source: 'action-2', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-high-risk-household',
    name: 'High-Risk Household Alert',
    description: 'Detect households with elevated risk scores and escalate to case managers',
    trigger_type: 'risk_score.high',
    tags: ['household', 'risk', 'alert', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'High Risk Detected', config: { trigger_type: 'risk_score.high' } } },
        { id: 'action-1', type: 'action', position: { x: 250, y: 120 }, data: { label: 'Flag Household', config: { action_type: 'flag_household_risk', household_id_field: 'household.id', risk_level: 'high', reason: 'Automated risk score threshold exceeded' } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 260 }, data: { label: 'Create Urgent Task', config: { action_type: 'create_task', title: 'URGENT: Review high-risk household {{household.name}}', priority: 'urgent', due_in_days: 1 } } },
        { id: 'action-3', type: 'action', position: { x: 250, y: 380 }, data: { label: 'Notify Case Manager', config: { action_type: 'send_notification', notify_roles: ['owner', 'admin', 'staff', 'case_manager'], message: 'High-risk household {{household.name}} needs immediate review. Risk score: {{household.risk_score}}' } } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 500 }, data: { label: 'Escalated', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'action-2' },
        { id: 'e3', source: 'action-2', target: 'action-3' },
        { id: 'e4', source: 'action-3', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-grant-deadline',
    name: 'Grant Deadline Reminder',
    description: 'Automatically send reminders and create tasks as grant deadlines approach',
    trigger_type: 'grant.deadline_approaching',
    tags: ['grants', 'deadline', 'reminder', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Grant Deadline Approaching', config: { trigger_type: 'grant.deadline_approaching', days_before: 14 } } },
        { id: 'cond-1', type: 'condition', position: { x: 250, y: 120 }, data: { label: 'Already Submitted?', config: { field: 'context.grant.status', operator: 'equals', value: 'submitted' } } },
        { id: 'action-1', type: 'action', position: { x: 100, y: 260 }, data: { label: 'Create Submission Task', config: { action_type: 'create_task', title: 'Submit grant: {{grant.name}} — due {{grant.deadline}}', priority: 'urgent', due_in_days: 1 } } },
        { id: 'action-2', type: 'action', position: { x: 100, y: 380 }, data: { label: 'Notify Grant Manager', config: { action_type: 'send_notification', notify_roles: ['owner', 'admin', 'staff', 'case_manager'], message: 'Grant {{grant.name}} deadline is approaching: {{grant.deadline}}. Amount requested: {{grant.amount_requested}}.' } } },
        { id: 'end-1', type: 'end', position: { x: 100, y: 500 }, data: { label: 'Done', config: {} } },
        { id: 'end-2', type: 'end', position: { x: 400, y: 260 }, data: { label: 'Already Submitted', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'cond-1' },
        { id: 'e2', source: 'cond-1', target: 'end-2', sourceHandle: 'true', label: 'Yes' },
        { id: 'e3', source: 'cond-1', target: 'action-1', sourceHandle: 'false', label: 'No' },
        { id: 'e4', source: 'action-1', target: 'action-2' },
        { id: 'e5', source: 'action-2', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-job-assigned-notify',
    name: 'Job Assignment Notification',
    description: 'Notify contractors and staff when jobs are assigned, and follow up if unaccepted',
    trigger_type: 'job.assigned',
    tags: ['workforce', 'jobs', 'notification', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Job Assigned', config: { trigger_type: 'job.assigned' } } },
        { id: 'action-1', type: 'action', position: { x: 250, y: 120 }, data: { label: 'Notify Staff', config: { action_type: 'send_notification', notify_roles: ['owner', 'admin', 'staff', 'case_manager'], message: 'Job "{{job.title}}" has been assigned to contractor {{job.contractor_id}}.' } } },
        { id: 'delay-1', type: 'delay', position: { x: 250, y: 240 }, data: { label: 'Wait 24h', config: { delay_type: 'duration', duration_ms: 86400000 } } },
        { id: 'cond-1', type: 'condition', position: { x: 250, y: 360 }, data: { label: 'Job Accepted?', config: { field: 'context.job.status', operator: 'equals', value: 'in_progress' } } },
        { id: 'action-2', type: 'action', position: { x: 400, y: 500 }, data: { label: 'Create Follow-up Task', config: { action_type: 'create_task', title: 'Follow up on unaccepted job: {{job.title}}', priority: 'high', due_in_days: 1 } } },
        { id: 'end-1', type: 'end', position: { x: 100, y: 500 }, data: { label: 'Accepted', config: {} } },
        { id: 'end-2', type: 'end', position: { x: 400, y: 640 }, data: { label: 'Follow-up Created', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'delay-1' },
        { id: 'e3', source: 'delay-1', target: 'cond-1' },
        { id: 'e4', source: 'cond-1', target: 'end-1', sourceHandle: 'true', label: 'Yes' },
        { id: 'e5', source: 'cond-1', target: 'action-2', sourceHandle: 'false', label: 'No' },
        { id: 'e6', source: 'action-2', target: 'end-2' },
      ],
    },
  },
  {
    id: 'template-referral-followup',
    name: 'Referral Follow-up',
    description: 'Track referral progress and escalate overdue referrals',
    trigger_type: 'referral.overdue',
    tags: ['referral', 'follow-up', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Referral Overdue', config: { trigger_type: 'referral.overdue', days: 7 } } },
        { id: 'action-1', type: 'action', position: { x: 250, y: 120 }, data: { label: 'Update Status', config: { action_type: 'update_referral_status', referral_id_field: 'referral.id', status: 'in_progress' } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 260 }, data: { label: 'Create Follow-up Task', config: { action_type: 'create_task', title: 'Follow up on overdue referral: {{referral.service_type}} for household {{referral.household_id}}', priority: 'high', due_in_days: 1 } } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 380 }, data: { label: 'Done', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'action-2' },
        { id: 'e3', source: 'action-2', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-event-registration-confirmation',
    name: 'Event Registration Confirmation',
    description: 'Send confirmation notifications when participants register for events',
    trigger_type: 'event.registration.created',
    tags: ['events', 'registration', 'confirmation', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Registration Created', config: { trigger_type: 'event.registration.created' } } },
        { id: 'action-1', type: 'action', position: { x: 250, y: 120 }, data: { label: 'Log Activity', config: { action_type: 'create_activity', type: 'note', subject: 'Registered for event', notes: 'Participant registered for event {{registration.event_id}}' } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 260 }, data: { label: 'Notify Staff', config: { action_type: 'send_notification', notify_roles: ['owner', 'admin', 'staff', 'case_manager'], message: 'New registration for event {{registration.event_id}} by person {{registration.person_id}}.' } } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 380 }, data: { label: 'Done', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'action-2' },
        { id: 'e3', source: 'action-2', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-grant-report-due',
    name: 'Grant Report Due Reminder',
    description: 'Alert team when grant reports are approaching their due date',
    trigger_type: 'grant.report_due_soon',
    tags: ['grants', 'reporting', 'reminder', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Report Due Soon', config: { trigger_type: 'grant.report_due_soon', days_before: 7 } } },
        { id: 'action-1', type: 'action', position: { x: 250, y: 120 }, data: { label: 'Create Report Task', config: { action_type: 'create_task', title: 'Submit grant report: {{grant.name}} — due {{grant.report_due_date}}', priority: 'high', due_in_days: 3 } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 260 }, data: { label: 'Update Grant Status', config: { action_type: 'update_grant_status', grant_id_field: 'grant.id', status: 'under_review' } } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 380 }, data: { label: 'Done', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'action-2' },
        { id: 'e3', source: 'action-2', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-attendance-ai-followup',
    name: 'Low Attendance AI Follow-up',
    description: 'Detect participants with low program attendance and generate personalized outreach',
    trigger_type: 'program.attendance.batch',
    tags: ['programs', 'attendance', 'ai', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Attendance Batch Recorded', config: { trigger_type: 'program.attendance.batch' } } },
        { id: 'cond-1', type: 'condition', position: { x: 250, y: 120 }, data: { label: 'Absent Count > 3?', config: { field: 'context.attendance.absent_count', operator: 'greater_than', value: 3 } } },
        { id: 'ai-1', type: 'ai_agent', position: { x: 100, y: 260 }, data: { label: 'Draft Outreach', config: { model: 'google/gemini-2.5-flash', prompt: "Draft a compassionate follow-up message for program participants who have been absent. Program: {{attendance.program_name}}. Keep it warm, non-judgmental, and encouraging.", output_key: 'outreach_draft' } } },
        { id: 'action-1', type: 'action', position: { x: 100, y: 400 }, data: { label: 'Create Outreach Task', config: { action_type: 'create_task', title: 'Outreach for low attendance — {{program.name}}', priority: 'medium', due_in_days: 2 } } },
        { id: 'end-1', type: 'end', position: { x: 100, y: 520 }, data: { label: 'Done', config: {} } },
        { id: 'end-2', type: 'end', position: { x: 400, y: 260 }, data: { label: 'Attendance OK', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'cond-1' },
        { id: 'e2', source: 'cond-1', target: 'ai-1', sourceHandle: 'true', label: 'Low Attendance' },
        { id: 'e3', source: 'cond-1', target: 'end-2', sourceHandle: 'false', label: 'OK' },
        { id: 'e4', source: 'ai-1', target: 'action-1' },
        { id: 'e5', source: 'action-1', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-asset-booking-confirm',
    name: 'Asset Access Confirmation',
    description: 'Confirm asset access requests and notify approvers',
    trigger_type: 'asset_access.submitted',
    tags: ['assets', 'booking', 'confirmation', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Access Request Submitted', config: { trigger_type: 'asset_access.submitted' } } },
        { id: 'action-1', type: 'action', position: { x: 250, y: 120 }, data: { label: 'Create Review Task', config: { action_type: 'create_task', title: 'Review asset access request: {{access.asset_id}} by {{access.person_id}}', priority: 'medium', due_in_days: 1 } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 260 }, data: { label: 'Notify Approver', config: { action_type: 'send_notification', notify_roles: ['owner', 'admin', 'staff', 'case_manager'], message: 'New asset access request: {{access.asset_id}} from {{access.start_time}} to {{access.end_time}}. Purpose: {{access.purpose}}.' } } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 380 }, data: { label: 'Pending Review', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'action-2' },
        { id: 'e3', source: 'action-2', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-contribution-recognition',
    name: 'Volunteer Contribution Recognition',
    description: 'Recognize and log volunteer contributions automatically',
    trigger_type: 'contribution.created',
    tags: ['contributions', 'volunteer', 'recognition', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Contribution Created', config: { trigger_type: 'contribution.created' } } },
        { id: 'cond-1', type: 'condition', position: { x: 250, y: 120 }, data: { label: 'Volunteer Hours?', config: { field: 'context.contribution.type', operator: 'equals', value: 'volunteer_hours' } } },
        { id: 'ai-1', type: 'ai_agent', position: { x: 100, y: 260 }, data: { label: 'Draft Thank-you', config: { model: 'google/gemini-2.5-flash', prompt: "Draft a warm thank-you note for a volunteer who contributed {{contribution.hours}} hours. Make it personal and specific to their contribution type.", output_key: 'thankyou_draft' } } },
        { id: 'action-1', type: 'action', position: { x: 100, y: 400 }, data: { label: 'Log Activity', config: { action_type: 'create_activity', type: 'note', subject: 'Volunteer contribution recognized', notes: 'Volunteer contributed {{contribution.hours}} hours on {{contribution.date}}' } } },
        { id: 'end-1', type: 'end', position: { x: 100, y: 520 }, data: { label: 'Done', config: {} } },
        { id: 'end-2', type: 'end', position: { x: 400, y: 260 }, data: { label: 'Non-volunteer', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'cond-1' },
        { id: 'e2', source: 'cond-1', target: 'ai-1', sourceHandle: 'true', label: 'Volunteer Hours' },
        { id: 'e3', source: 'cond-1', target: 'end-2', sourceHandle: 'false', label: 'Other' },
        { id: 'e4', source: 'ai-1', target: 'action-1' },
        { id: 'e5', source: 'action-1', target: 'end-1' },
      ],
    },
  },
];

// GET /api/projects/[slug]/workflows/templates - List template workflows
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'view');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Fetch user-created templates
    const { data: userTemplates } = await supabaseAny
      .from('workflows')
      .select('id, name, description, trigger_type, tags, definition, created_at')
      .eq('project_id', project.id)
      .eq('is_template', true)
      .order('name', { ascending: true });

    // Select built-in templates based on project type
    const builtinTemplates = (project as { project_type?: string }).project_type === 'community'
      ? COMMUNITY_BUILTIN_TEMPLATES
      : BUILTIN_TEMPLATES;

    const templates = [...builtinTemplates, ...(userTemplates ?? [])];

    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /workflows/templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
