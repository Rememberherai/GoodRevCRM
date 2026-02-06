export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          activity_type: string | null
          changes: Json | null
          created_at: string | null
          direction: string | null
          duration_minutes: number | null
          entity_id: string
          entity_type: string
          follow_up_date: string | null
          follow_up_task_id: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          notes: string | null
          opportunity_id: string | null
          organization_id: string | null
          outcome: string | null
          person_id: string | null
          project_id: string
          rfp_id: string | null
          subject: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          activity_type?: string | null
          changes?: Json | null
          created_at?: string | null
          direction?: string | null
          duration_minutes?: number | null
          entity_id: string
          entity_type: string
          follow_up_date?: string | null
          follow_up_task_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          notes?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          outcome?: string | null
          person_id?: string | null
          project_id: string
          rfp_id?: string | null
          subject?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          activity_type?: string | null
          changes?: Json | null
          created_at?: string | null
          direction?: string | null
          duration_minutes?: number | null
          entity_id?: string
          entity_type?: string
          follow_up_date?: string | null
          follow_up_task_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          notes?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          outcome?: string | null
          person_id?: string | null
          project_id?: string
          rfp_id?: string | null
          subject?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_follow_up_task_id_fkey"
            columns: ["follow_up_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          completion_tokens: number | null
          created_at: string | null
          feature: string
          id: string
          metadata: Json | null
          model: string
          project_id: string
          prompt_tokens: number | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string | null
          feature: string
          id?: string
          metadata?: Json | null
          model: string
          project_id: string
          prompt_tokens?: number | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string | null
          feature?: string
          id?: string
          metadata?: Json | null
          model?: string
          project_id?: string
          prompt_tokens?: number | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_usage_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          actions_results: Json
          automation_id: string
          conditions_met: boolean
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          executed_at: string
          id: string
          status: string
          trigger_event: Json
        }
        Insert: {
          actions_results?: Json
          automation_id: string
          conditions_met?: boolean
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          executed_at?: string
          id?: string
          status?: string
          trigger_event: Json
        }
        Update: {
          actions_results?: Json
          automation_id?: string
          conditions_met?: boolean
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          executed_at?: string
          id?: string
          status?: string
          trigger_event?: Json
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_time_checks: {
        Row: {
          automation_id: string
          id: string
          last_checked_at: string
          last_matched_entity_ids: Json
        }
        Insert: {
          automation_id: string
          id?: string
          last_checked_at?: string
          last_matched_entity_ids?: Json
        }
        Update: {
          automation_id?: string
          id?: string
          last_checked_at?: string
          last_matched_entity_ids?: Json
        }
        Relationships: [
          {
            foreignKeyName: "automation_time_checks_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: true
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string
          description: string | null
          execution_count: number
          id: string
          is_active: boolean
          last_executed_at: string | null
          name: string
          project_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by: string
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name: string
          project_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name?: string
          project_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "automations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          amd_result: string | null
          answered_at: string | null
          created_at: string | null
          direction: string
          disposition: string | null
          disposition_notes: string | null
          duration_seconds: number | null
          ended_at: string | null
          from_number: string
          id: string
          metadata: Json | null
          opportunity_id: string | null
          organization_id: string | null
          person_id: string | null
          project_id: string
          recording_duration_seconds: number | null
          recording_enabled: boolean | null
          recording_url: string | null
          rfp_id: string | null
          started_at: string
          status: string
          talk_time_seconds: number | null
          telnyx_call_control_id: string | null
          telnyx_call_leg_id: string | null
          telnyx_call_session_id: string | null
          telnyx_connection_id: string | null
          telnyx_recording_id: string | null
          to_number: string
          transcription: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amd_result?: string | null
          answered_at?: string | null
          created_at?: string | null
          direction: string
          disposition?: string | null
          disposition_notes?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          from_number: string
          id?: string
          metadata?: Json | null
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id: string
          recording_duration_seconds?: number | null
          recording_enabled?: boolean | null
          recording_url?: string | null
          rfp_id?: string | null
          started_at?: string
          status?: string
          talk_time_seconds?: number | null
          telnyx_call_control_id?: string | null
          telnyx_call_leg_id?: string | null
          telnyx_call_session_id?: string | null
          telnyx_connection_id?: string | null
          telnyx_recording_id?: string | null
          to_number: string
          transcription?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amd_result?: string | null
          answered_at?: string | null
          created_at?: string | null
          direction?: string
          disposition?: string | null
          disposition_notes?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string
          id?: string
          metadata?: Json | null
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id?: string
          recording_duration_seconds?: number | null
          recording_enabled?: boolean | null
          recording_url?: string | null
          rfp_id?: string | null
          started_at?: string
          status?: string
          talk_time_seconds?: number | null
          telnyx_call_control_id?: string | null
          telnyx_call_leg_id?: string | null
          telnyx_call_session_id?: string | null
          telnyx_connection_id?: string | null
          telnyx_recording_id?: string | null
          to_number?: string
          transcription?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "calls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_telnyx_connection_id_fkey"
            columns: ["telnyx_connection_id"]
            isOneToOne: false
            referencedRelation: "telnyx_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          ai_confidence_threshold: number | null
          ai_extraction_hint: string | null
          created_at: string
          created_by: string | null
          default_value: Json | null
          description: string | null
          display_order: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          field_type: Database["public"]["Enums"]["field_type"]
          group_name: string | null
          id: string
          is_ai_extractable: boolean
          is_filterable: boolean
          is_required: boolean
          is_searchable: boolean
          is_unique: boolean
          is_visible_in_list: boolean
          label: string
          name: string
          options: Json
          project_id: string
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          ai_confidence_threshold?: number | null
          ai_extraction_hint?: string | null
          created_at?: string
          created_by?: string | null
          default_value?: Json | null
          description?: string | null
          display_order?: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          field_type: Database["public"]["Enums"]["field_type"]
          group_name?: string | null
          id?: string
          is_ai_extractable?: boolean
          is_filterable?: boolean
          is_required?: boolean
          is_searchable?: boolean
          is_unique?: boolean
          is_visible_in_list?: boolean
          label: string
          name: string
          options?: Json
          project_id: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          ai_confidence_threshold?: number | null
          ai_extraction_hint?: string | null
          created_at?: string
          created_by?: string | null
          default_value?: Json | null
          description?: string | null
          display_order?: number
          entity_type?: Database["public"]["Enums"]["entity_type"]
          field_type?: Database["public"]["Enums"]["field_type"]
          group_name?: string | null
          id?: string
          is_ai_extractable?: boolean
          is_filterable?: boolean
          is_required?: boolean
          is_searchable?: boolean
          is_unique?: boolean
          is_visible_in_list?: boolean
          label?: string
          name?: string
          options?: Json
          project_id?: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_definitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "custom_field_definitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_visible: boolean
          position: number
          project_id: string
          size: string
          updated_at: string
          user_id: string
          widget_type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_visible?: boolean
          position?: number
          project_id: string
          size?: string
          updated_at?: string
          user_id: string
          widget_type: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_visible?: boolean
          position?: number
          project_id?: string
          size?: string
          updated_at?: string
          user_id?: string
          widget_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "dashboard_widgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          bcc_addresses: Json
          body_html: string
          body_text: string | null
          cc_addresses: Json
          created_at: string
          error_message: string | null
          id: string
          person_id: string | null
          project_id: string
          reply_to: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          to_addresses: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          bcc_addresses?: Json
          body_html: string
          body_text?: string | null
          cc_addresses?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          person_id?: string | null
          project_id: string
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          to_addresses?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          bcc_addresses?: Json
          body_html?: string
          body_text?: string | null
          cc_addresses?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          person_id?: string | null
          project_id?: string
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          to_addresses?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "email_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          event_type: string
          id: string
          ip_address: unknown
          link_url: string | null
          metadata: Json | null
          occurred_at: string
          sent_email_id: string
          user_agent: string | null
        }
        Insert: {
          event_type: string
          id?: string
          ip_address?: unknown
          link_url?: string | null
          metadata?: Json | null
          occurred_at?: string
          sent_email_id: string
          user_agent?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          ip_address?: unknown
          link_url?: string | null
          metadata?: Json | null
          occurred_at?: string
          sent_email_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_sent_email_id_fkey"
            columns: ["sent_email_id"]
            isOneToOne: false
            referencedRelation: "email_tracking_stats"
            referencedColumns: ["sent_email_id"]
          },
          {
            foreignKeyName: "email_events_sent_email_id_fkey"
            columns: ["sent_email_id"]
            isOneToOne: false
            referencedRelation: "sent_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_signatures: {
        Row: {
          content_html: string
          created_at: string | null
          id: string
          is_default: boolean
          name: string
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_html: string
          created_at?: string | null
          id?: string
          is_default?: boolean
          name: string
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_html?: string
          created_at?: string | null
          id?: string
          is_default?: boolean
          name?: string
          project_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_signatures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "email_signatures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_signatures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_log: {
        Row: {
          completed_at: string | null
          contacts_matched: number | null
          error_message: string | null
          gmail_connection_id: string
          id: string
          messages_fetched: number | null
          messages_stored: number | null
          metadata: Json | null
          started_at: string | null
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          contacts_matched?: number | null
          error_message?: string | null
          gmail_connection_id: string
          id?: string
          messages_fetched?: number | null
          messages_stored?: number | null
          metadata?: Json | null
          started_at?: string | null
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          contacts_matched?: number | null
          error_message?: string | null
          gmail_connection_id?: string
          id?: string
          messages_fetched?: number | null
          messages_stored?: number | null
          metadata?: Json | null
          started_at?: string | null
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sync_log_gmail_connection_id_fkey"
            columns: ["gmail_connection_id"]
            isOneToOne: false
            referencedRelation: "gmail_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          template_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_attachments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_versions: {
        Row: {
          body_html: string
          body_text: string | null
          change_note: string | null
          changed_by: string | null
          created_at: string
          id: string
          subject: string
          template_id: string
          version: number
        }
        Insert: {
          body_html: string
          body_text?: string | null
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          subject: string
          template_id: string
          version: number
        }
        Update: {
          body_html?: string
          body_text?: string | null
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          subject?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_shared: boolean
          last_used_at: string | null
          name: string
          project_id: string
          subject: string
          updated_at: string
          usage_count: number
          variables: Json
        }
        Insert: {
          body_html: string
          body_text?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_shared?: boolean
          last_used_at?: string | null
          name: string
          project_id: string
          subject: string
          updated_at?: string
          usage_count?: number
          variables?: Json
        }
        Update: {
          body_html?: string
          body_text?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_shared?: boolean
          last_used_at?: string | null
          name?: string
          project_id?: string
          subject?: string
          updated_at?: string
          usage_count?: number
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "email_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          attachments: Json | null
          bcc_emails: string[] | null
          body_html: string | null
          body_text: string | null
          cc_emails: string[] | null
          created_at: string | null
          direction: string
          email_date: string
          from_email: string
          from_name: string | null
          gmail_connection_id: string
          gmail_message_id: string
          gmail_thread_id: string
          id: string
          label_ids: string[] | null
          opportunity_id: string | null
          organization_id: string | null
          person_id: string | null
          project_id: string | null
          rfp_id: string | null
          sent_email_id: string | null
          snippet: string | null
          subject: string | null
          synced_at: string | null
          to_emails: string[]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          bcc_emails?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string | null
          direction: string
          email_date: string
          from_email: string
          from_name?: string | null
          gmail_connection_id: string
          gmail_message_id: string
          gmail_thread_id: string
          id?: string
          label_ids?: string[] | null
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id?: string | null
          rfp_id?: string | null
          sent_email_id?: string | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string | null
          to_emails?: string[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          bcc_emails?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string | null
          direction?: string
          email_date?: string
          from_email?: string
          from_name?: string | null
          gmail_connection_id?: string
          gmail_message_id?: string
          gmail_thread_id?: string
          id?: string
          label_ids?: string[] | null
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id?: string | null
          rfp_id?: string | null
          sent_email_id?: string | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string | null
          to_emails?: string[]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_gmail_connection_id_fkey"
            columns: ["gmail_connection_id"]
            isOneToOne: false
            referencedRelation: "gmail_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_sent_email_id_fkey"
            columns: ["sent_email_id"]
            isOneToOne: false
            referencedRelation: "email_tracking_stats"
            referencedColumns: ["sent_email_id"]
          },
          {
            foreignKeyName: "emails_sent_email_id_fkey"
            columns: ["sent_email_id"]
            isOneToOne: false
            referencedRelation: "sent_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string
          credits_used: number | null
          error: string | null
          external_job_id: string | null
          id: string
          input_data: Json
          person_id: string
          project_id: string
          result: Json | null
          reviewed_at: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          credits_used?: number | null
          error?: string | null
          external_job_id?: string | null
          id?: string
          input_data?: Json
          person_id: string
          project_id: string
          result?: Json | null
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          credits_used?: number | null
          error?: string | null
          external_job_id?: string | null
          id?: string
          input_data?: Json
          person_id?: string
          project_id?: string
          result?: Json | null
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_jobs_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "enrichment_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string
          deleted_at: string | null
          entity_id: string
          entity_type: string
          id: string
          mentions: Json
          project_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          mentions?: Json
          project_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          mentions?: Json
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "entity_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tag_assignments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "entity_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "entity_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          columns: Json | null
          completed_at: string | null
          created_at: string
          entity_type: string
          expires_at: string | null
          file_name: string | null
          file_url: string | null
          filters: Json | null
          format: string
          id: string
          project_id: string
          started_at: string | null
          status: string
          total_rows: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          columns?: Json | null
          completed_at?: string | null
          created_at?: string
          entity_type: string
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          filters?: Json | null
          format?: string
          id?: string
          project_id: string
          started_at?: string | null
          status?: string
          total_rows?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          columns?: Json | null
          completed_at?: string | null
          created_at?: string
          entity_type?: string
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          filters?: Json | null
          format?: string
          id?: string
          project_id?: string
          started_at?: string | null
          status?: string
          total_rows?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "export_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string | null
          email: string
          error_message: string | null
          history_id: string | null
          id: string
          initial_sync_done: boolean | null
          last_sync_at: string | null
          last_sync_error: string | null
          project_id: string | null
          refresh_token: string
          status: string
          sync_enabled: boolean | null
          sync_errors_count: number | null
          token_expires_at: string
          updated_at: string | null
          user_id: string
          watch_expiration: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          email: string
          error_message?: string | null
          history_id?: string | null
          id?: string
          initial_sync_done?: boolean | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          project_id?: string | null
          refresh_token: string
          status?: string
          sync_enabled?: boolean | null
          sync_errors_count?: number | null
          token_expires_at: string
          updated_at?: string | null
          user_id: string
          watch_expiration?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          email?: string
          error_message?: string | null
          history_id?: string | null
          id?: string
          initial_sync_done?: boolean | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          project_id?: string | null
          refresh_token?: string
          status?: string
          sync_enabled?: boolean | null
          sync_errors_count?: number | null
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
          watch_expiration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gmail_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "gmail_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          entity_type: string
          error_log: Json | null
          failed_rows: number | null
          file_name: string
          file_url: string | null
          id: string
          mapping: Json | null
          options: Json | null
          processed_rows: number | null
          project_id: string
          started_at: string | null
          status: string
          successful_rows: number | null
          total_rows: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entity_type: string
          error_log?: Json | null
          failed_rows?: number | null
          file_name: string
          file_url?: string | null
          id?: string
          mapping?: Json | null
          options?: Json | null
          processed_rows?: number | null
          project_id: string
          started_at?: string | null
          status?: string
          successful_rows?: number | null
          total_rows?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entity_type?: string
          error_log?: Json | null
          failed_rows?: number | null
          file_name?: string
          file_url?: string | null
          id?: string
          mapping?: Json | null
          options?: Json | null
          processed_rows?: number | null
          project_id?: string
          started_at?: string | null
          status?: string
          successful_rows?: number | null
          total_rows?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "import_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          attendance_status: string | null
          created_at: string | null
          id: string
          meeting_id: string
          person_id: string | null
          user_id: string | null
        }
        Insert: {
          attendance_status?: string | null
          created_at?: string | null
          id?: string
          meeting_id: string
          person_id?: string | null
          user_id?: string | null
        }
        Update: {
          attendance_status?: string | null
          created_at?: string | null
          id?: string
          meeting_id?: string
          person_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          assigned_to: string | null
          cancellation_reason: string | null
          created_at: string | null
          created_by: string
          description: string | null
          duration_minutes: number
          id: string
          location: string | null
          meeting_type: string
          meeting_url: string | null
          next_steps: string | null
          opportunity_id: string | null
          organization_id: string | null
          outcome: string | null
          outcome_notes: string | null
          person_id: string | null
          project_id: string
          reschedule_count: number | null
          rescheduled_from: string | null
          rfp_id: string | null
          scheduled_at: string
          status: string
          status_changed_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_type?: string
          meeting_url?: string | null
          next_steps?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          person_id?: string | null
          project_id: string
          reschedule_count?: number | null
          rescheduled_from?: string | null
          rfp_id?: string | null
          scheduled_at: string
          status?: string
          status_changed_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_type?: string
          meeting_url?: string | null
          next_steps?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          person_id?: string | null
          project_id?: string
          reschedule_count?: number | null
          rescheduled_from?: string | null
          rfp_id?: string | null
          scheduled_at?: string
          status?: string
          status_changed_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      news_article_entities: {
        Row: {
          article_id: string
          created_at: string
          id: string
          match_type: string
          organization_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          match_type?: string
          organization_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          match_type?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_article_entities_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_article_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author: string | null
          body: string | null
          created_at: string
          description: string | null
          fetched_at: string
          id: string
          image_url: string | null
          is_read: boolean
          is_starred: boolean
          matched_keywords: string[]
          project_id: string
          published_at: string | null
          sentiment: number | null
          source_name: string | null
          title: string
          url: string
        }
        Insert: {
          author?: string | null
          body?: string | null
          created_at?: string
          description?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          is_starred?: boolean
          matched_keywords?: string[]
          project_id: string
          published_at?: string | null
          sentiment?: number | null
          source_name?: string | null
          title: string
          url: string
        }
        Update: {
          author?: string | null
          body?: string | null
          created_at?: string
          description?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          is_starred?: boolean
          matched_keywords?: string[]
          project_id?: string
          published_at?: string | null
          sentiment?: number | null
          source_name?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "news_articles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      news_fetch_log: {
        Row: {
          articles_fetched: number
          error_message: string | null
          fetched_at: string
          id: string
          keywords_searched: string[]
          project_id: string
          tokens_used: number
        }
        Insert: {
          articles_fetched?: number
          error_message?: string | null
          fetched_at?: string
          id?: string
          keywords_searched?: string[]
          project_id: string
          tokens_used?: number
        }
        Update: {
          articles_fetched?: number
          error_message?: string | null
          fetched_at?: string
          id?: string
          keywords_searched?: string[]
          project_id?: string
          tokens_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "news_fetch_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "news_fetch_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      news_keywords: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          keyword: string
          organization_id: string | null
          project_id: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          keyword: string
          organization_id?: string | null
          project_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          keyword?: string
          organization_id?: string | null
          project_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_keywords_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_keywords_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_keywords_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "news_keywords_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          content_html: string | null
          created_at: string | null
          created_by: string
          id: string
          is_pinned: boolean
          opportunity_id: string | null
          organization_id: string | null
          person_id: string | null
          project_id: string
          rfp_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          content_html?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          is_pinned?: boolean
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id: string
          rfp_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_html?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          is_pinned?: boolean
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id?: string
          rfp_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_batches: {
        Row: {
          batch_type: string
          created_at: string
          id: string
          notification_count: number
          notifications: Json
          scheduled_for: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          batch_type: string
          created_at?: string
          id?: string
          notification_count?: number
          notifications?: Json
          scheduled_for: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          batch_type?: string
          created_at?: string
          id?: string
          notification_count?: number
          notifications?: Json
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          notification_type: string
          project_id: string | null
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          notification_type: string
          project_id?: string | null
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          notification_type?: string
          project_id?: string | null
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notification_preferences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          archived_at: string | null
          created_at: string
          data: Json
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          is_archived: boolean
          is_read: boolean
          message: string
          priority: string
          project_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          archived_at?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          message: string
          priority?: string
          project_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          archived_at?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          message?: string
          priority?: string
          project_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          actual_close_date: string | null
          amount: number | null
          campaign: string | null
          competitor: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          custom_fields: Json
          days_in_stage: number | null
          deleted_at: string | null
          description: string | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          name: string
          organization_id: string | null
          owner_id: string | null
          primary_contact_id: string | null
          probability: number | null
          project_id: string
          source: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"]
          stage_changed_at: string | null
          updated_at: string
          won_reason: string | null
        }
        Insert: {
          actual_close_date?: string | null
          amount?: number | null
          campaign?: string | null
          competitor?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json
          days_in_stage?: number | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          name: string
          organization_id?: string | null
          owner_id?: string | null
          primary_contact_id?: string | null
          probability?: number | null
          project_id: string
          source?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          stage_changed_at?: string | null
          updated_at?: string
          won_reason?: string | null
        }
        Update: {
          actual_close_date?: string | null
          amount?: number | null
          campaign?: string | null
          competitor?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json
          days_in_stage?: number | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          primary_contact_id?: string | null
          probability?: number | null
          project_id?: string
          source?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          stage_changed_at?: string | null
          updated_at?: string
          won_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          annual_revenue: number | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          deleted_at: string | null
          description: string | null
          domain: string | null
          employee_count: number | null
          id: string
          industry: string | null
          linkedin_url: string | null
          logo_url: string | null
          name: string
          phone: string | null
          project_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          annual_revenue?: number | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          project_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          annual_revenue?: number | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          project_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "organizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          avatar_url: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          deleted_at: string | null
          department: string | null
          email: string | null
          enriched_at: string | null
          enrichment_data: Json | null
          enrichment_status: string | null
          first_name: string
          id: string
          job_title: string | null
          last_name: string
          linkedin_outreach_status: string | null
          linkedin_url: string | null
          mobile_phone: string | null
          notes: string | null
          phone: string | null
          preferred_contact_method: string | null
          project_id: string
          timezone: string | null
          twitter_handle: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enrichment_status?: string | null
          first_name: string
          id?: string
          job_title?: string | null
          last_name: string
          linkedin_outreach_status?: string | null
          linkedin_url?: string | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          project_id: string
          timezone?: string | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enrichment_status?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          last_name?: string
          linkedin_outreach_status?: string | null
          linkedin_url?: string | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          project_id?: string
          timezone?: string | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      person_organizations: {
        Row: {
          created_at: string
          department: string | null
          end_date: string | null
          id: string
          is_current: boolean
          is_primary: boolean
          job_title: string | null
          organization_id: string
          person_id: string
          project_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          is_primary?: boolean
          job_title?: string | null
          organization_id: string
          person_id: string
          project_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          is_primary?: boolean
          job_title?: string | null
          organization_id?: string
          person_id?: string
          project_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_organizations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_organizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "person_organizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          project_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          project_id: string
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_memberships: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_memberships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_memberships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      report_definitions: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json
          id: string
          is_public: boolean
          last_run_at: string | null
          name: string
          project_id: string
          report_type: string
          schedule: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          is_public?: boolean
          last_run_at?: string | null
          name: string
          project_id: string
          report_type: string
          schedule?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          is_public?: boolean
          last_run_at?: string | null
          name?: string
          project_id?: string
          report_type?: string
          schedule?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_definitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "report_definitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          project_id: string
          report_id: string
          result: Json | null
          run_duration_ms: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          project_id: string
          report_id: string
          result?: Json | null
          run_duration_ms?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          project_id?: string
          report_id?: string
          result?: Json | null
          run_duration_ms?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "report_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      research_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string
          entity_id: string
          entity_type: string
          error: string | null
          id: string
          model_used: string | null
          project_id: string
          prompt: string
          result: Json | null
          started_at: string | null
          status: string
          tokens_used: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          entity_id: string
          entity_type: string
          error?: string | null
          id?: string
          model_used?: string | null
          project_id: string
          prompt: string
          result?: Json | null
          started_at?: string | null
          status?: string
          tokens_used?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          entity_id?: string
          entity_type?: string
          error?: string | null
          id?: string
          model_used?: string | null
          project_id?: string
          prompt?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "research_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "research_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_settings: {
        Row: {
          auto_apply_high_confidence: boolean | null
          created_at: string
          created_by: string | null
          default_confidence_threshold: number | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          high_confidence_threshold: number | null
          id: string
          max_tokens: number | null
          model_id: string | null
          project_id: string
          system_prompt: string | null
          temperature: number | null
          updated_at: string
          user_prompt_template: string | null
        }
        Insert: {
          auto_apply_high_confidence?: boolean | null
          created_at?: string
          created_by?: string | null
          default_confidence_threshold?: number | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          high_confidence_threshold?: number | null
          id?: string
          max_tokens?: number | null
          model_id?: string | null
          project_id: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          user_prompt_template?: string | null
        }
        Update: {
          auto_apply_high_confidence?: boolean | null
          created_at?: string
          created_by?: string | null
          default_confidence_threshold?: number | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          high_confidence_threshold?: number | null
          id?: string
          max_tokens?: number | null
          model_id?: string | null
          project_id?: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          user_prompt_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "research_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_content_library: {
        Row: {
          answer_html: string | null
          answer_text: string
          category: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          last_used_at: string | null
          project_id: string
          question_text: string | null
          source_document_name: string | null
          source_question_id: string | null
          source_rfp_id: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          answer_html?: string | null
          answer_text: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          last_used_at?: string | null
          project_id: string
          question_text?: string | null
          source_document_name?: string | null
          source_question_id?: string | null
          source_rfp_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          answer_html?: string | null
          answer_text?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          last_used_at?: string | null
          project_id?: string
          question_text?: string | null
          source_document_name?: string | null
          source_question_id?: string | null
          source_rfp_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rfp_content_library_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "rfp_content_library_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_content_library_source_question_id_fkey"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "rfp_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_content_library_source_rfp_id_fkey"
            columns: ["source_rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_question_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          project_id: string
          question_id: string
          rfp_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          project_id: string
          question_id: string
          rfp_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          project_id?: string
          question_id?: string
          rfp_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfp_question_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_question_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "rfp_question_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_question_comments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "rfp_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_question_comments_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_questions: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean
          answer_html: string | null
          answer_text: string | null
          assigned_to: string | null
          content_library_source_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          priority: string | null
          project_id: string
          question_number: string | null
          question_text: string
          rfp_id: string
          section_name: string | null
          sort_order: number
          status: Database["public"]["Enums"]["rfp_question_status"]
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean
          answer_html?: string | null
          answer_text?: string | null
          assigned_to?: string | null
          content_library_source_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          project_id: string
          question_number?: string | null
          question_text: string
          rfp_id: string
          section_name?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["rfp_question_status"]
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean
          answer_html?: string | null
          answer_text?: string | null
          assigned_to?: string | null
          content_library_source_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          project_id?: string
          question_number?: string | null
          question_text?: string
          rfp_id?: string
          section_name?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["rfp_question_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfp_questions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "rfp_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_questions_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_research_results: {
        Row: {
          competitor_analysis: Json | null
          completed_at: string | null
          compliance_context: Json | null
          created_at: string | null
          created_by: string | null
          error: string | null
          executive_summary: string | null
          id: string
          industry_context: Json | null
          key_decision_makers: Json | null
          key_insights: Json | null
          market_intelligence: Json | null
          model_used: string | null
          news_and_press: Json | null
          organization_profile: Json | null
          project_id: string
          recommended_actions: Json | null
          rfp_id: string
          similar_contracts: Json | null
          sources: Json
          started_at: string | null
          status: string
          tokens_used: number | null
          updated_at: string | null
        }
        Insert: {
          competitor_analysis?: Json | null
          completed_at?: string | null
          compliance_context?: Json | null
          created_at?: string | null
          created_by?: string | null
          error?: string | null
          executive_summary?: string | null
          id?: string
          industry_context?: Json | null
          key_decision_makers?: Json | null
          key_insights?: Json | null
          market_intelligence?: Json | null
          model_used?: string | null
          news_and_press?: Json | null
          organization_profile?: Json | null
          project_id: string
          recommended_actions?: Json | null
          rfp_id: string
          similar_contracts?: Json | null
          sources?: Json
          started_at?: string | null
          status?: string
          tokens_used?: number | null
          updated_at?: string | null
        }
        Update: {
          competitor_analysis?: Json | null
          completed_at?: string | null
          compliance_context?: Json | null
          created_at?: string | null
          created_by?: string | null
          error?: string | null
          executive_summary?: string | null
          id?: string
          industry_context?: Json | null
          key_decision_makers?: Json | null
          key_insights?: Json | null
          market_intelligence?: Json | null
          model_used?: string | null
          news_and_press?: Json | null
          organization_profile?: Json | null
          project_id?: string
          recommended_actions?: Json | null
          rfp_id?: string
          similar_contracts?: Json | null
          sources?: Json
          started_at?: string | null
          status?: string
          tokens_used?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfp_research_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_research_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "rfp_research_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_research_results_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfps: {
        Row: {
          awarded_to: string | null
          budget_range: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          custom_fields: Json
          decision_date: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          estimated_value: number | null
          feedback: string | null
          go_no_go_date: string | null
          go_no_go_decision: string | null
          go_no_go_notes: string | null
          id: string
          issue_date: string | null
          opportunity_id: string | null
          organization_id: string | null
          outcome_reason: string | null
          owner_id: string | null
          project_id: string
          questions_due_date: string | null
          response_document_url: string | null
          rfp_document_url: string | null
          rfp_number: string | null
          status: Database["public"]["Enums"]["rfp_status"]
          submission_email: string | null
          submission_instructions: string | null
          submission_method: string | null
          submission_portal_url: string | null
          title: string
          updated_at: string
          win_probability: number | null
        }
        Insert: {
          awarded_to?: string | null
          budget_range?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json
          decision_date?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_value?: number | null
          feedback?: string | null
          go_no_go_date?: string | null
          go_no_go_decision?: string | null
          go_no_go_notes?: string | null
          id?: string
          issue_date?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          outcome_reason?: string | null
          owner_id?: string | null
          project_id: string
          questions_due_date?: string | null
          response_document_url?: string | null
          rfp_document_url?: string | null
          rfp_number?: string | null
          status?: Database["public"]["Enums"]["rfp_status"]
          submission_email?: string | null
          submission_instructions?: string | null
          submission_method?: string | null
          submission_portal_url?: string | null
          title: string
          updated_at?: string
          win_probability?: number | null
        }
        Update: {
          awarded_to?: string | null
          budget_range?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json
          decision_date?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_value?: number | null
          feedback?: string | null
          go_no_go_date?: string | null
          go_no_go_decision?: string | null
          go_no_go_notes?: string | null
          id?: string
          issue_date?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          outcome_reason?: string | null
          owner_id?: string | null
          project_id?: string
          questions_due_date?: string | null
          response_document_url?: string | null
          rfp_document_url?: string | null
          rfp_number?: string | null
          status?: Database["public"]["Enums"]["rfp_status"]
          submission_email?: string | null
          submission_instructions?: string | null
          submission_method?: string | null
          submission_portal_url?: string | null
          title?: string
          updated_at?: string
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rfps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfps_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfps_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "rfps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_audit_log: {
        Row: {
          change_type: Database["public"]["Enums"]["schema_change_type"]
          data_backup: Json | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          field_id: string | null
          field_name: string
          id: string
          new_value: Json | null
          notes: string | null
          old_value: Json | null
          performed_at: string
          performed_by: string | null
          project_id: string
          records_affected: number | null
        }
        Insert: {
          change_type: Database["public"]["Enums"]["schema_change_type"]
          data_backup?: Json | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          field_id?: string | null
          field_name: string
          id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          project_id: string
          records_affected?: number | null
        }
        Update: {
          change_type?: Database["public"]["Enums"]["schema_change_type"]
          data_backup?: Json | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          field_id?: string | null
          field_name?: string
          id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          project_id?: string
          records_affected?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schema_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schema_audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "schema_audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          body_html: string
          body_text: string | null
          created_by: string
          gmail_connection_id: string
          id: string
          message_id: string
          opportunity_id: string | null
          organization_id: string | null
          person_id: string | null
          project_id: string | null
          recipient_email: string
          rfp_id: string | null
          sent_at: string
          sequence_enrollment_id: string | null
          sequence_step_id: string | null
          subject: string
          thread_id: string | null
          tracking_id: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_by: string
          gmail_connection_id: string
          id?: string
          message_id: string
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id?: string | null
          recipient_email: string
          rfp_id?: string | null
          sent_at?: string
          sequence_enrollment_id?: string | null
          sequence_step_id?: string | null
          subject: string
          thread_id?: string | null
          tracking_id?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_by?: string
          gmail_connection_id?: string
          id?: string
          message_id?: string
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id?: string | null
          recipient_email?: string
          rfp_id?: string | null
          sent_at?: string
          sequence_enrollment_id?: string | null
          sequence_step_id?: string | null
          subject?: string
          thread_id?: string | null
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_gmail_connection_id_fkey"
            columns: ["gmail_connection_id"]
            isOneToOne: false
            referencedRelation: "gmail_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "sent_emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_sequence_step_id_fkey"
            columns: ["sequence_step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          bounce_detected_at: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string
          current_step: number
          gmail_connection_id: string
          id: string
          next_send_at: string | null
          person_id: string
          reply_detected_at: string | null
          sequence_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          bounce_detected_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          current_step?: number
          gmail_connection_id: string
          id?: string
          next_send_at?: string | null
          person_id: string
          reply_detected_at?: string | null
          sequence_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          bounce_detected_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          current_step?: number
          gmail_connection_id?: string
          id?: string
          next_send_at?: string | null
          person_id?: string
          reply_detected_at?: string | null
          sequence_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_gmail_connection_id_fkey"
            columns: ["gmail_connection_id"]
            isOneToOne: false
            referencedRelation: "gmail_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          body_html: string | null
          body_text: string | null
          condition: Json | null
          config: Json | null
          created_at: string | null
          delay_amount: number | null
          delay_unit: string | null
          id: string
          sequence_id: string
          sms_body: string | null
          step_number: number
          step_type: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          condition?: Json | null
          config?: Json | null
          created_at?: string | null
          delay_amount?: number | null
          delay_unit?: string | null
          id?: string
          sequence_id: string
          sms_body?: string | null
          step_number: number
          step_type: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          condition?: Json | null
          config?: Json | null
          created_at?: string | null
          delay_amount?: number | null
          delay_unit?: string | null
          id?: string
          sequence_id?: string
          sms_body?: string | null
          step_number?: number
          step_type?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          person_id: string | null
          project_id: string
          settings: Json
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          person_id?: string | null
          project_id: string
          settings?: Json
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          person_id?: string | null
          project_id?: string
          settings?: Json
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "sequences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body: string
          created_at: string | null
          delivered_at: string | null
          direction: string
          error_code: string | null
          error_message: string | null
          from_number: string
          id: string
          opportunity_id: string | null
          organization_id: string | null
          person_id: string | null
          project_id: string
          received_at: string | null
          rfp_id: string | null
          segments: number | null
          sent_at: string | null
          sequence_enrollment_id: string | null
          sequence_step_id: string | null
          status: string
          telnyx_connection_id: string
          telnyx_message_id: string | null
          to_number: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          delivered_at?: string | null
          direction: string
          error_code?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id: string
          received_at?: string | null
          rfp_id?: string | null
          segments?: number | null
          sent_at?: string | null
          sequence_enrollment_id?: string | null
          sequence_step_id?: string | null
          status?: string
          telnyx_connection_id: string
          telnyx_message_id?: string | null
          to_number: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          delivered_at?: string | null
          direction?: string
          error_code?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id?: string
          received_at?: string | null
          rfp_id?: string | null
          segments?: number | null
          sent_at?: string | null
          sequence_enrollment_id?: string | null
          sequence_step_id?: string | null
          status?: string
          telnyx_connection_id?: string
          telnyx_message_id?: string | null
          to_number?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "sms_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_sequence_enrollment_id_fkey"
            columns: ["sequence_enrollment_id"]
            isOneToOne: false
            referencedRelation: "sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_sequence_step_id_fkey"
            columns: ["sequence_step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_telnyx_connection_id_fkey"
            columns: ["telnyx_connection_id"]
            isOneToOne: false
            referencedRelation: "telnyx_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      table_column_preferences: {
        Row: {
          columns: Json
          created_at: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          columns?: Json
          created_at?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_column_preferences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "table_column_preferences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_column_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          opportunity_id: string | null
          organization_id: string | null
          person_id: string | null
          priority: string
          project_id: string
          rfp_id: string | null
          source_activity_id: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          priority?: string
          project_id: string
          rfp_id?: string | null
          source_activity_id?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          priority?: string
          project_id?: string
          rfp_id?: string | null
          source_activity_id?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_activity_id_fkey"
            columns: ["source_activity_id"]
            isOneToOne: false
            referencedRelation: "activity_log"
            referencedColumns: ["id"]
          },
        ]
      }
      telnyx_connections: {
        Row: {
          amd_enabled: boolean
          api_key: string
          call_control_app_id: string | null
          caller_id_name: string | null
          created_at: string | null
          created_by: string
          error_message: string | null
          id: string
          last_call_at: string | null
          messaging_profile_id: string | null
          phone_number: string
          phone_number_id: string | null
          project_id: string | null
          record_calls: boolean
          sip_connection_id: string | null
          sip_password: string | null
          sip_username: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amd_enabled?: boolean
          api_key: string
          call_control_app_id?: string | null
          caller_id_name?: string | null
          created_at?: string | null
          created_by: string
          error_message?: string | null
          id?: string
          last_call_at?: string | null
          messaging_profile_id?: string | null
          phone_number: string
          phone_number_id?: string | null
          project_id?: string | null
          record_calls?: boolean
          sip_connection_id?: string | null
          sip_password?: string | null
          sip_username?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amd_enabled?: boolean
          api_key?: string
          call_control_app_id?: string | null
          caller_id_name?: string | null
          created_at?: string | null
          created_by?: string
          error_message?: string | null
          id?: string
          last_call_at?: string | null
          messaging_profile_id?: string | null
          phone_number?: string
          phone_number_id?: string | null
          project_id?: string | null
          record_calls?: boolean
          sip_connection_id?: string | null
          sip_password?: string | null
          sip_username?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telnyx_connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telnyx_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "telnyx_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telnyx_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          last_active_at: string
          project_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          last_active_at?: string
          project_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          last_active_at?: string
          project_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          date_format: string | null
          default_project_id: string | null
          id: string
          notifications_digest: string | null
          notifications_email: boolean | null
          notifications_push: boolean | null
          theme: string | null
          time_format: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_format?: string | null
          default_project_id?: string | null
          id?: string
          notifications_digest?: string | null
          notifications_email?: boolean | null
          notifications_push?: boolean | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_format?: string | null
          default_project_id?: string | null
          id?: string
          notifications_digest?: string | null
          notifications_email?: boolean | null
          notifications_push?: boolean | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_project_id_fkey"
            columns: ["default_project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_settings_default_project_id_fkey"
            columns: ["default_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt_number: number
          created_at: string
          delivered_at: string | null
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          request_headers: Json | null
          response_body: string | null
          response_headers: Json | null
          response_status: number | null
          status: string
          webhook_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          request_headers?: Json | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          status?: string
          webhook_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          request_headers?: Json | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          status?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string
          events: string[]
          headers: Json | null
          id: string
          is_active: boolean
          name: string
          project_id: string
          retry_count: number
          secret: string | null
          timeout_ms: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          retry_count?: number
          secret?: string | null
          timeout_ms?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          retry_count?: number
          secret?: string | null
          timeout_ms?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "webhooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      activity_metrics: {
        Row: {
          action: string | null
          activity_count: number | null
          activity_date: string | null
          entity_type: string | null
          project_id: string | null
          unique_users: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking_stats: {
        Row: {
          bounces: number | null
          clicks: number | null
          first_open_at: string | null
          last_open_at: string | null
          opens: number | null
          opportunity_id: string | null
          organization_id: string | null
          person_id: string | null
          project_id: string | null
          replies: number | null
          rfp_id: string | null
          sent_email_id: string | null
          unique_clicks: number | null
          unique_opens: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "sent_emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_conversion: {
        Row: {
          lost_count: number | null
          lost_value: number | null
          month: string | null
          open_count: number | null
          project_id: string | null
          total_created: number | null
          win_rate: number | null
          won_count: number | null
          won_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_summary: {
        Row: {
          avg_probability: number | null
          avg_value: number | null
          opportunity_count: number | null
          project_id: string | null
          stage_name: Database["public"]["Enums"]["opportunity_stage"] | null
          total_value: number | null
          weighted_value: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      archive_notifications: {
        Args: { p_notification_ids: string[] }
        Returns: number
      }
      bulk_assign_tags: {
        Args: {
          p_entity_ids: string[]
          p_entity_type: string
          p_project_id: string
          p_tag_ids: string[]
        }
        Returns: number
      }
      bulk_complete_tasks: {
        Args: { p_project_id: string; p_task_ids: string[] }
        Returns: number
      }
      bulk_delete_opportunities: {
        Args: { p_opportunity_ids: string[]; p_project_id: string }
        Returns: number
      }
      bulk_delete_organizations: {
        Args: { p_organization_ids: string[]; p_project_id: string }
        Returns: number
      }
      bulk_delete_people: {
        Args: { p_person_ids: string[]; p_project_id: string }
        Returns: number
      }
      bulk_delete_rfps: {
        Args: { p_project_id: string; p_rfp_ids: string[] }
        Returns: number
      }
      bulk_delete_tasks: {
        Args: { p_project_id: string; p_task_ids: string[] }
        Returns: number
      }
      bulk_remove_tags: {
        Args: {
          p_entity_ids: string[]
          p_entity_type: string
          p_project_id: string
          p_tag_ids: string[]
        }
        Returns: number
      }
      bulk_restore_people: {
        Args: { p_person_ids: string[]; p_project_id: string }
        Returns: number
      }
      bulk_update_opportunities: {
        Args: {
          p_opportunity_ids: string[]
          p_project_id: string
          p_updates: Json
        }
        Returns: number
      }
      bulk_update_organizations: {
        Args: {
          p_organization_ids: string[]
          p_project_id: string
          p_updates: Json
        }
        Returns: number
      }
      bulk_update_people: {
        Args: { p_person_ids: string[]; p_project_id: string; p_updates: Json }
        Returns: number
      }
      bulk_update_tasks: {
        Args: { p_project_id: string; p_task_ids: string[]; p_updates: Json }
        Returns: number
      }
      cleanup_old_notifications: {
        Args: { p_days_old?: number }
        Returns: number
      }
      create_notification: {
        Args: {
          p_action_url?: string
          p_data?: Json
          p_entity_id?: string
          p_entity_type?: string
          p_message: string
          p_priority?: string
          p_project_id?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      get_activity_conversion_metrics: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_activity_summary: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
        }
        Returns: {
          action: string
          activity_date: string
          count: number
          entity_type: string
        }[]
      }
      get_activity_tile_metrics: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_ai_usage_stats: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
          p_user_id?: string
        }
        Returns: {
          call_count: number
          completion_tokens: number
          feature: string
          model: string
          prompt_tokens: number
          total_tokens: number
        }[]
      }
      get_automations_for_trigger: {
        Args: { p_project_id: string; p_trigger_type: string }
        Returns: {
          actions: Json
          conditions: Json
          id: string
          name: string
          trigger_config: Json
          trigger_type: string
        }[]
      }
      get_call_metrics: {
        Args: {
          p_end_date: string
          p_project_id: string
          p_start_date: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_conversion_metrics:
        | {
            Args: {
              p_end_date?: string
              p_project_id: string
              p_start_date?: string
            }
            Returns: {
              lost_count: number
              lost_value: number
              month: string
              open_count: number
              total_created: number
              win_rate: number
              won_count: number
              won_value: number
            }[]
          }
        | {
            Args: {
              p_end_date?: string
              p_project_id: string
              p_start_date?: string
              p_user_id?: string
            }
            Returns: {
              lost_count: number
              lost_value: number
              month: string
              open_count: number
              total_created: number
              win_rate: number
              won_count: number
              won_value: number
            }[]
          }
      get_dashboard_stats: { Args: { p_project_id: string }; Returns: Json }
      get_email_performance: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_enrichment_stats: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_opportunity_funnel: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
          p_user_id?: string
        }
        Returns: {
          count: number
          stage: string
          total_value: number
        }[]
      }
      get_pipeline_summary:
        | {
            Args: { p_project_id: string }
            Returns: {
              avg_value: number
              opportunity_count: number
              stage_name: string
              total_value: number
              weighted_value: number
            }[]
          }
        | {
            Args: { p_project_id: string; p_user_id?: string }
            Returns: {
              avg_value: number
              opportunity_count: number
              stage_name: string
              total_value: number
              weighted_value: number
            }[]
          }
      get_project_memberships: {
        Args: { p_project_id: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          joined_at: string
          last_active_at: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }[]
      }
      get_revenue_metrics:
        | {
            Args: {
              p_end_date?: string
              p_project_id: string
              p_start_date?: string
            }
            Returns: {
              avg_deal_size: number
              closed_won_value: number
              expected_value: number
              month: string
              opportunity_count: number
            }[]
          }
        | {
            Args: {
              p_end_date?: string
              p_project_id: string
              p_start_date?: string
              p_user_id?: string
            }
            Returns: {
              avg_deal_size: number
              closed_won_value: number
              expected_value: number
              month: string
              opportunity_count: number
            }[]
          }
      get_rfp_funnel: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
          p_user_id?: string
        }
        Returns: {
          count: number
          status: string
          total_value: number
        }[]
      }
      get_team_performance:
        | {
            Args: {
              p_end_date?: string
              p_project_id: string
              p_start_date?: string
            }
            Returns: {
              activities_logged: number
              opportunities_created: number
              opportunities_won: number
              tasks_completed: number
              total_won_value: number
              user_email: string
              user_id: string
            }[]
          }
        | {
            Args: {
              p_end_date?: string
              p_project_id: string
              p_start_date?: string
              p_user_id?: string
            }
            Returns: {
              activities_logged: number
              opportunities_created: number
              opportunities_won: number
              tasks_completed: number
              total_won_value: number
              user_email: string
              user_id: string
            }[]
          }
      get_unread_notification_count: {
        Args: { p_project_id?: string }
        Returns: number
      }
      get_webhooks_for_event: {
        Args: { p_event_type: string; p_project_id: string }
        Returns: {
          headers: Json
          id: string
          retry_count: number
          secret: string
          timeout_ms: number
          url: string
        }[]
      }
      global_search: {
        Args: {
          p_entity_types?: string[]
          p_limit?: number
          p_project_id: string
          p_query: string
        }
        Returns: {
          entity_id: string
          entity_type: string
          match_field: string
          name: string
          relevance: number
          subtitle: string
        }[]
      }
      has_project_role: {
        Args: {
          project_id: string
          required_role: Database["public"]["Enums"]["project_role"]
        }
        Returns: boolean
      }
      increment_template_usage: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      is_project_member: { Args: { project_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_changes?: Json
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_project_id: string
          p_user_id: string
        }
        Returns: string
      }
      log_automation_execution: {
        Args: {
          p_actions_results: Json
          p_automation_id: string
          p_conditions_met: boolean
          p_duration_ms: number
          p_entity_id: string
          p_entity_type: string
          p_error_message: string
          p_status: string
          p_trigger_event: Json
        }
        Returns: string
      }
      mark_all_notifications_read: {
        Args: { p_project_id?: string }
        Returns: number
      }
      mark_notifications_read: {
        Args: { p_notification_ids: string[] }
        Returns: number
      }
      queue_webhook_delivery: {
        Args: { p_event_type: string; p_payload: Json; p_webhook_id: string }
        Returns: string
      }
      remove_custom_field_data: {
        Args: {
          p_entity_type: Database["public"]["Enums"]["entity_type"]
          p_field_id: string
          p_field_name: string
          p_performed_by: string
          p_project_id: string
        }
        Returns: number
      }
      render_email_template: {
        Args: { p_template_id: string; p_variables?: Json }
        Returns: {
          body_html: string
          body_text: string
          subject: string
        }[]
      }
      update_member_role: {
        Args: { p_new_role: string; p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      upsert_news_article: {
        Args: {
          p_author: string
          p_body: string
          p_description: string
          p_image_url: string
          p_matched_keywords: string[]
          p_project_id: string
          p_published_at: string
          p_sentiment?: number
          p_source_name: string
          p_title: string
          p_url: string
        }
        Returns: string
      }
      validate_custom_field: {
        Args: {
          p_field_def: Database["public"]["Tables"]["custom_field_definitions"]["Row"]
          p_value: Json
        }
        Returns: boolean
      }
    }
    Enums: {
      entity_type: "organization" | "person" | "opportunity" | "rfp"
      field_type:
        | "text"
        | "textarea"
        | "number"
        | "currency"
        | "percentage"
        | "date"
        | "datetime"
        | "boolean"
        | "select"
        | "multi_select"
        | "url"
        | "email"
        | "phone"
        | "rating"
        | "user"
      opportunity_stage:
        | "prospecting"
        | "qualification"
        | "proposal"
        | "negotiation"
        | "closed_won"
        | "closed_lost"
      project_role: "owner" | "admin" | "member" | "viewer"
      rfp_question_status: "unanswered" | "draft" | "review" | "approved"
      rfp_status:
        | "identified"
        | "reviewing"
        | "preparing"
        | "submitted"
        | "won"
        | "lost"
        | "no_bid"
      schema_change_type:
        | "field_created"
        | "field_updated"
        | "field_deleted"
        | "field_data_removed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      entity_type: ["organization", "person", "opportunity", "rfp"],
      field_type: [
        "text",
        "textarea",
        "number",
        "currency",
        "percentage",
        "date",
        "datetime",
        "boolean",
        "select",
        "multi_select",
        "url",
        "email",
        "phone",
        "rating",
        "user",
      ],
      opportunity_stage: [
        "prospecting",
        "qualification",
        "proposal",
        "negotiation",
        "closed_won",
        "closed_lost",
      ],
      project_role: ["owner", "admin", "member", "viewer"],
      rfp_question_status: ["unanswered", "draft", "review", "approved"],
      rfp_status: [
        "identified",
        "reviewing",
        "preparing",
        "submitted",
        "won",
        "lost",
        "no_bid",
      ],
      schema_change_type: [
        "field_created",
        "field_updated",
        "field_deleted",
        "field_data_removed",
      ],
    },
  },
} as const
