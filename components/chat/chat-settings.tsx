'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast and capable — default' },
  { value: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', description: 'Anthropic balanced' },
  { value: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6', description: 'Anthropic flagship' },
  { value: 'openai/gpt-4o', label: 'GPT-4o', description: 'OpenAI flagship' },
  { value: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2', description: 'Open-source powerhouse' },
  { value: 'x-ai/grok-4.1-fast', label: 'Grok 4.1 Fast', description: 'xAI fast reasoning' },
];

interface ChatSettingsProps {
  onBack: () => void;
  projectType?: string | null;
}

export function ChatSettings({ onBack, projectType }: ChatSettingsProps) {
  // For now, model selection is informational — stored per-conversation in the DB
  // Future: persist model preference and pass to API route

  const isCommunity = projectType === 'community';
  const isGrants = projectType === 'grants';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-sm">Chat Settings</h2>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Model selection */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">AI Model</Label>
          <Select defaultValue="google/gemini-2.5-flash">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  <div>
                    <div className="text-sm">{model.label}</div>
                    <div className="text-xs text-muted-foreground">{model.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            All models are accessed via OpenRouter. Usage is billed to your OpenRouter API key.
          </p>
        </div>

        {/* Available tools info */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Available Tools</Label>
          <div className="rounded-md border p-3 space-y-2">
            {isGrants ? (
              <>
                <ToolGroup name="Grants" tools={['list', 'get', 'create', 'update', 'draft_narrative', 'draft_budget', 'list_documents', 'update_document', 'list_reports', 'create_report', 'update_report', 'search_federal', 'import_federal']} />
                <ToolGroup name="Organizations" tools={['list', 'get', 'create', 'update', 'delete', 'get_people']} />
                <ToolGroup name="People" tools={['list', 'get', 'create', 'update', 'delete', 'link_organization']} />
                <ToolGroup name="Tasks" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Notes" tools={['list', 'create', 'update', 'delete']} />
                <ToolGroup name="Search" tools={['global']} />
                <ToolGroup name="Tags" tools={['list', 'create', 'assign', 'get_entity_tags']} />
                <ToolGroup name="Comments" tools={['list', 'create']} />
                <ToolGroup name="Content Library" tools={['list', 'search', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Calendar Sync" tools={['sync_grant']} />
                <ToolGroup name="Bug Reports" tools={['list', 'update_status']} />
              </>
            ) : isCommunity ? (
              <>
                <ToolGroup name="Households" tools={['list', 'get', 'create', 'update']} />
                <ToolGroup name="Cases" tools={['list', 'get', 'create', 'update', 'close', 'timeline', 'goals.list', 'goals.create', 'goals.update', 'goals.delete', 'notes.list', 'notes.create']} />
                <ToolGroup name="Incidents" tools={['list', 'get', 'create', 'update', 'resolve', 'people.add', 'people.remove', 'notes.list', 'notes.create']} />
                <ToolGroup name="Programs" tools={['list', 'get', 'create', 'update', 'enroll', 'record_attendance', 'list_waivers', 'add_waiver', 'remove_waiver']} />
                <ToolGroup name="Contributions" tools={['list', 'get', 'create', 'update']} />
                <ToolGroup name="Assets" tools={['list', 'get', 'create', 'update']} />
                <ToolGroup name="Asset Access" tools={['list_requests', 'review_request', 'mark_returned', 'list_approvers', 'add_approver', 'remove_approver', 'list_approved_people', 'grant_person_approval', 'revoke_person_approval', 'get_settings', 'update_settings']} />
                <ToolGroup name="Referrals" tools={['list', 'get', 'create', 'update']} />
                <ToolGroup name="Relationships" tools={['list', 'create']} />
                <ToolGroup name="Broadcasts" tools={['list', 'create', 'send']} />
                <ToolGroup name="Receipt Processing" tools={['process_image', 'confirm']} />
                <ToolGroup name="Contractors" tools={['create_scope', 'send_documents', 'onboard']} />
                <ToolGroup name="Jobs" tools={['assign', 'pull', 'list_for_contractor', 'my_jobs', 'my_calendar', 'work_plan']} />
                <ToolGroup name="Time Entries" tools={['list', 'create', 'update', 'delete']} />
                <ToolGroup name="Grants" tools={['list', 'get', 'create', 'update', 'draft_narrative', 'draft_budget', 'list_documents', 'update_document', 'list_reports', 'create_report', 'update_report', 'search_federal', 'import_federal']} />
                <ToolGroup name="Census" tools={['lookup_households']} />
                <ToolGroup name="Calendar Sync" tools={['sync_program', 'sync_job', 'sync_grant']} />
                <ToolGroup name="Service Types" tools={['list', 'create', 'update', 'delete']} />
                <ToolGroup name="Events" tools={['list', 'get', 'create', 'update', 'delete', 'publish', 'list_registrations', 'check_in', 'cancel_registration', 'create_ticket_type', 'list_series', 'create_series', 'update_series', 'match_attendance', 'confirm_attendance', 'scan_sign_in_sheet']} />
                <ToolGroup name="Workflows" tools={['list', 'get', 'activate', 'executions', 'execute', 'summary']} />
                <ToolGroup name="Bug Reports" tools={['list', 'update_status']} />
              </>
            ) : (
              <>
                <ToolGroup name="Organizations" tools={['list', 'get', 'create', 'update', 'delete', 'get_people']} />
                <ToolGroup name="People" tools={['list', 'get', 'create', 'update', 'delete', 'link_organization']} />
                <ToolGroup name="Opportunities" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Tasks" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Notes" tools={['list', 'create', 'update', 'delete']} />
                <ToolGroup name="RFPs" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="RFP Questions" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Sequences" tools={['list', 'get', 'create', 'update', 'enroll', 'unenroll']} />
                <ToolGroup name="Meetings" tools={['list', 'create', 'update', 'delete']} />
                <ToolGroup name="Calls" tools={['list', 'get']} />
                <ToolGroup name="Email" tools={['send', 'history', 'inbox', 'unknown_senders', 'create_contact_from_sender']} />
                <ToolGroup name="Drafts" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Templates" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Tags" tools={['list', 'create', 'assign', 'get_entity_tags']} />
                <ToolGroup name="Comments" tools={['list', 'create']} />
                <ToolGroup name="Dashboard" tools={['stats']} />
                <ToolGroup name="Search" tools={['global']} />
                <ToolGroup name="Automations" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Content Library" tools={['list', 'search', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="News" tools={['list_keywords', 'create_keyword', 'delete_keyword', 'list_articles', 'update_article']} />
                <ToolGroup name="Custom Fields" tools={['list', 'create', 'update', 'delete']} />
                <ToolGroup name="Webhooks" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Reports" tools={['list', 'get', 'create', 'create_custom', 'update_custom', 'delete', 'run', 'get_schema', 'preview', 'forecasting', 'activity_conversions']} />
                <ToolGroup name="Activity" tools={['list', 'follow_ups']} />
                <ToolGroup name="Research" tools={['list', 'get']} />
                <ToolGroup name="Widgets" tools={['list', 'create', 'update', 'delete']} />
                <ToolGroup name="Members" tools={['list', 'update_role']} />
                <ToolGroup name="Invitations" tools={['list']} />
                <ToolGroup name="Settings" tools={['get']} />
                <ToolGroup name="Duplicates" tools={['list', 'resolve']} />
                <ToolGroup name="Merge" tools={['execute']} />
                <ToolGroup name="Enrichment" tools={['list', 'start']} />
                <ToolGroup name="Contacts" tools={['discover', 'add_to_org']} />
                <ToolGroup name="SMS" tools={['list', 'send']} />
                <ToolGroup name="Signatures" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="LinkedIn" tools={['generate_message']} />
                <ToolGroup name="Bulk" tools={['execute']} />
                <ToolGroup name="Sequence Steps" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Call Metrics" tools={['metrics']} />
                <ToolGroup name="RFP Stats" tools={['stats']} />
                <ToolGroup name="Workflows" tools={['list', 'get', 'create', 'update', 'delete', 'activate', 'execute', 'executions', 'validate']} />
                <ToolGroup name="Contracts" tools={['list', 'get', 'create', 'void', 'add_recipient', 'add_field', 'audit_trail', 'templates_list']} />
                <ToolGroup name="Documents" tools={['list', 'get', 'create', 'void', 'audit_trail', 'templates_list']} />
                <ToolGroup name="Products" tools={['list', 'get', 'create', 'update', 'delete']} />
                <ToolGroup name="Quotes" tools={['list', 'get', 'create', 'update', 'delete', 'accept', 'reject', 'set_primary', 'add_line_item', 'update_line_item', 'remove_line_item']} />
                <ToolGroup name="Accounting" tools={['list_invoices', 'get_invoice', 'list_bills', 'list_accounts', 'list_journal_entries', 'list_recurring', 'record_payment']} />
                <ToolGroup name="Calendar" tools={['list_event_types', 'get_event_type', 'create_event_type', 'update_event_type', 'delete_event_type', 'list_bookings', 'get_booking', 'cancel_booking', 'update_profile', 'get_booking_link', 'list_availability_schedules', 'update_availability', 'list_event_type_members', 'add_event_type_member', 'remove_event_type_member', 'get_round_robin_stats']} />
                <ToolGroup name="Dispositions" tools={['list', 'create', 'update', 'delete']} />
                <ToolGroup name="Bug Reports" tools={['list', 'update_status']} />
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isGrants
              ? 'The assistant can manage your grant pipeline, discover funding opportunities, draft narratives and budgets, manage documents and reports, and track compliance.'
              : isCommunity
              ? 'The assistant can manage households, cases, incidents, community records, receipts, contractors, jobs, broadcasts, and calendar-linked community workflows in this phase.'
              : 'The AI can use these tools to read and modify your CRM data across all entity types.'}
          </p>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">How it works</Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When you send a message, the AI assistant analyzes your request and decides which CRM tools to use.
            It can chain multiple tool calls together to gather information before responding.
            All actions are performed with your project permissions.
          </p>
        </div>
      </div>
    </div>
  );
}

function ToolGroup({ name, tools }: { name: string; tools: string[] }) {
  return (
    <div>
      <span className="text-xs font-medium">{name}</span>
      <div className="flex flex-wrap gap-1 mt-1">
        {tools.map((tool) => (
          <span key={tool} className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}
