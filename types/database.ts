export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounting_companies: {
        Row: {
          base_currency: string
          bill_prefix: string
          created_at: string
          created_by: string
          deleted_at: string | null
          fiscal_year_start_month: number
          id: string
          invoice_prefix: string
          logo_url: string | null
          name: string
          next_bill_number: number
          next_invoice_number: number
          next_je_number: number
          updated_at: string
        }
        Insert: {
          base_currency?: string
          bill_prefix?: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          fiscal_year_start_month?: number
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          name: string
          next_bill_number?: number
          next_invoice_number?: number
          next_je_number?: number
          updated_at?: string
        }
        Update: {
          base_currency?: string
          bill_prefix?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          fiscal_year_start_month?: number
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          name?: string
          next_bill_number?: number
          next_invoice_number?: number
          next_je_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["accounting_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["accounting_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["accounting_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_company_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_company_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_settings: {
        Row: {
          company_id: string
          created_at: string
          default_ap_account_id: string | null
          default_ar_account_id: string | null
          default_cash_account_id: string | null
          default_expense_account_id: string | null
          default_fx_gain_loss_account_id: string | null
          default_payment_terms: number
          default_revenue_account_id: string | null
          default_tax_liability_account_id: string | null
          id: string
          invoice_footer: string | null
          invoice_notes: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_ap_account_id?: string | null
          default_ar_account_id?: string | null
          default_cash_account_id?: string | null
          default_expense_account_id?: string | null
          default_fx_gain_loss_account_id?: string | null
          default_payment_terms?: number
          default_revenue_account_id?: string | null
          default_tax_liability_account_id?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_notes?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_ap_account_id?: string | null
          default_ar_account_id?: string | null
          default_cash_account_id?: string | null
          default_expense_account_id?: string | null
          default_fx_gain_loss_account_id?: string | null
          default_payment_terms?: number
          default_revenue_account_id?: string | null
          default_tax_liability_account_id?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
        ]
      }
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
      api_connections: {
        Row: {
          config_enc: string | null
          created_at: string
          created_by: string
          id: string
          last_health_check: string | null
          last_used_at: string | null
          name: string
          project_id: string
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          config_enc?: string | null
          created_at?: string
          created_by: string
          id?: string
          last_health_check?: string | null
          last_used_at?: string | null
          name: string
          project_id: string
          service_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          config_enc?: string | null
          created_at?: string
          created_by?: string
          id?: string
          last_health_check?: string | null
          last_used_at?: string | null
          name?: string
          project_id?: string
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "api_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      availability_overrides: {
        Row: {
          created_at: string | null
          date: string
          end_time: string | null
          id: string
          is_available: boolean
          reason: string | null
          start_time: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          end_time?: string | null
          id?: string
          is_available?: boolean
          reason?: string | null
          start_time?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          end_time?: string | null
          id?: string
          is_available?: boolean
          reason?: string | null
          start_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          schedule_id: string
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          schedule_id: string
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          schedule_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "availability_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_schedules: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          timezone: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          timezone?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          timezone?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_id: string | null
          account_number_last4: string | null
          account_type: string
          company_id: string
          created_at: string
          currency: string
          current_balance: number
          deleted_at: string | null
          id: string
          institution: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_number_last4?: string | null
          account_type?: string
          company_id: string
          created_at?: string
          currency?: string
          current_balance?: number
          deleted_at?: string | null
          id?: string
          institution?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_number_last4?: string | null
          account_type?: string
          company_id?: string
          created_at?: string
          currency?: string
          current_balance?: number
          deleted_at?: string | null
          id?: string
          institution?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          company_id: string
          created_at: string
          currency: string
          description: string
          id: string
          import_batch_id: string | null
          import_source: string
          is_reconciled: boolean
          matched_journal_entry_id: string | null
          matched_payment_id: string | null
          reference: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          company_id: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          import_batch_id?: string | null
          import_source?: string
          is_reconciled?: boolean
          matched_journal_entry_id?: string | null
          matched_payment_id?: string | null
          reference?: string | null
          transaction_date: string
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          company_id?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          import_batch_id?: string | null
          import_source?: string
          is_reconciled?: boolean
          matched_journal_entry_id?: string | null
          matched_payment_id?: string | null
          reference?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_journal_entry_id_fkey"
            columns: ["matched_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_line_items: {
        Row: {
          account_id: string
          amount: number
          bill_id: string
          created_at: string
          description: string
          id: string
          quantity: number
          sort_order: number
          tax_amount: number
          tax_rate_id: string | null
          unit_price: number
        }
        Insert: {
          account_id: string
          amount?: number
          bill_id: string
          created_at?: string
          description: string
          id?: string
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          unit_price: number
        }
        Update: {
          account_id?: string
          amount?: number
          bill_id?: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_line_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_line_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_line_items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_tax_summary: {
        Row: {
          bill_id: string
          created_at: string
          id: string
          tax_amount: number
          tax_name: string
          tax_rate: number
          tax_rate_id: string
          taxable_amount: number
        }
        Insert: {
          bill_id: string
          created_at?: string
          id?: string
          tax_amount: number
          tax_name: string
          tax_rate: number
          tax_rate_id: string
          taxable_amount: number
        }
        Update: {
          bill_id?: string
          created_at?: string
          id?: string
          tax_amount?: number
          tax_name?: string
          tax_rate?: number
          tax_rate_id?: string
          taxable_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_tax_summary_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_tax_summary_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_paid: number
          balance_due: number
          bill_date: string
          bill_number: string
          company_id: string
          contact_id: string | null
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          discount_amount: number
          due_date: string
          exchange_rate: number
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          paid_at: string | null
          payment_terms: number | null
          project_id: string | null
          received_at: string | null
          status: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          vendor_address: string | null
          vendor_email: string | null
          vendor_name: string
          vendor_phone: string | null
          voided_at: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          bill_date: string
          bill_number: string
          company_id: string
          contact_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          deleted_at?: string | null
          discount_amount?: number
          due_date: string
          exchange_rate?: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_terms?: number | null
          project_id?: string | null
          received_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          vendor_address?: string | null
          vendor_email?: string | null
          vendor_name: string
          vendor_phone?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          bill_date?: string
          bill_number?: string
          company_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          discount_amount?: number
          due_date?: string
          exchange_rate?: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_terms?: number | null
          project_id?: string | null
          received_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          vendor_address?: string | null
          vendor_email?: string | null
          vendor_name?: string
          vendor_phone?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_rate_limits: {
        Row: {
          attempt_count: number | null
          id: string
          key: string
          window_start: string
        }
        Insert: {
          attempt_count?: number | null
          id?: string
          key: string
          window_start: string
        }
        Update: {
          attempt_count?: number | null
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          cancel_token: string | null
          cancellation_reason: string | null
          cancelled_by: string | null
          created_at: string | null
          effective_block: unknown
          effective_block_end: string
          effective_block_start: string
          end_at: string
          event_type_id: string
          host_user_id: string
          ics_token: string | null
          id: string
          invitee_email: string
          invitee_name: string
          invitee_notes: string | null
          invitee_phone: string | null
          invitee_timezone: string | null
          location: string | null
          meeting_id: string | null
          meeting_url: string | null
          organization_id: string | null
          person_id: string | null
          project_id: string
          reminder_sent_1h: boolean | null
          reminder_sent_24h: boolean | null
          reschedule_token: string | null
          rescheduled_from_id: string | null
          responses: Json | null
          start_at: string
          status: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          cancel_token?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          effective_block?: unknown
          effective_block_end: string
          effective_block_start: string
          end_at: string
          event_type_id: string
          host_user_id: string
          ics_token?: string | null
          id?: string
          invitee_email: string
          invitee_name: string
          invitee_notes?: string | null
          invitee_phone?: string | null
          invitee_timezone?: string | null
          location?: string | null
          meeting_id?: string | null
          meeting_url?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id: string
          reminder_sent_1h?: boolean | null
          reminder_sent_24h?: boolean | null
          reschedule_token?: string | null
          rescheduled_from_id?: string | null
          responses?: Json | null
          start_at: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          cancel_token?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          effective_block?: unknown
          effective_block_end?: string
          effective_block_start?: string
          end_at?: string
          event_type_id?: string
          host_user_id?: string
          ics_token?: string | null
          id?: string
          invitee_email?: string
          invitee_name?: string
          invitee_notes?: string | null
          invitee_phone?: string | null
          invitee_timezone?: string | null
          location?: string | null
          meeting_id?: string | null
          meeting_url?: string | null
          organization_id?: string | null
          person_id?: string | null
          project_id?: string
          reminder_sent_1h?: boolean | null
          reminder_sent_24h?: boolean | null
          reschedule_token?: string | null
          rescheduled_from_id?: string | null
          responses?: Json | null
          start_at?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bookings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          body: string
          body_html: string | null
          channel: string
          created_at: string
          created_by: string | null
          failure_reason: string | null
          filter_criteria: Json
          id: string
          project_id: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          body_html?: string | null
          channel: string
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          filter_criteria?: Json
          id?: string
          project_id: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          body_html?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          filter_criteria?: Json
          id?: string
          project_id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "broadcasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          created_at: string
          description: string
          id: string
          page_url: string
          priority: string | null
          project_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          screenshot_path: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          description: string
          id?: string
          page_url: string
          priority?: string | null
          project_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_path?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          page_url?: string
          priority?: string | null
          project_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_path?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bug_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bug_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bug_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_integrations: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          email: string
          gmail_connection_id: string | null
          granted_scopes: string[] | null
          id: string
          initial_sync_done: boolean | null
          is_primary: boolean | null
          last_sync_error: string | null
          last_synced_at: string | null
          provider: string
          push_enabled: boolean | null
          refresh_token: string | null
          status: string
          sync_enabled: boolean | null
          sync_errors_count: number | null
          sync_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          email: string
          gmail_connection_id?: string | null
          granted_scopes?: string[] | null
          id?: string
          initial_sync_done?: boolean | null
          is_primary?: boolean | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          provider?: string
          push_enabled?: boolean | null
          refresh_token?: string | null
          status?: string
          sync_enabled?: boolean | null
          sync_errors_count?: number | null
          sync_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          email?: string
          gmail_connection_id?: string | null
          granted_scopes?: string[] | null
          id?: string
          initial_sync_done?: boolean | null
          is_primary?: boolean | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          provider?: string
          push_enabled?: boolean | null
          refresh_token?: string | null
          status?: string
          sync_enabled?: boolean | null
          sync_errors_count?: number | null
          sync_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_integrations_gmail_connection_id_fkey"
            columns: ["gmail_connection_id"]
            isOneToOne: false
            referencedRelation: "gmail_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          booking_page_theme: Json | null
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean | null
          slug: string
          timezone: string
          updated_at: string | null
          user_id: string
          welcome_message: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          booking_page_theme?: Json | null
          created_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          slug: string
          timezone?: string
          updated_at?: string | null
          user_id: string
          welcome_message?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          booking_page_theme?: Json | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          slug?: string
          timezone?: string
          updated_at?: string | null
          user_id?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
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
      chart_of_accounts: {
        Row: {
          account_code: string
          account_subtype: string | null
          account_type: string
          company_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          normal_balance: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_subtype?: string | null
          account_type: string
          company_id: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          normal_balance: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_subtype?: string | null
          account_type?: string
          company_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          normal_balance?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          model: string | null
          project_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          project_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          project_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "chat_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          role: string
          token_usage: Json | null
          tool_call_id: string | null
          tool_calls: Json | null
          tool_name: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          token_usage?: Json | null
          tool_call_id?: string | null
          tool_calls?: Json | null
          tool_name?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          token_usage?: Json | null
          tool_call_id?: string | null
          tool_calls?: Json | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      community_assets: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          category: string
          condition: string
          created_at: string
          description: string | null
          dimension_id: string | null
          geocoded_status: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          project_id: string
          steward_organization_id: string | null
          steward_person_id: string | null
          updated_at: string
          value_estimate: number | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          category: string
          condition?: string
          created_at?: string
          description?: string | null
          dimension_id?: string | null
          geocoded_status?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          project_id: string
          steward_organization_id?: string | null
          steward_person_id?: string | null
          updated_at?: string
          value_estimate?: number | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          category?: string
          condition?: string
          created_at?: string
          description?: string | null
          dimension_id?: string | null
          geocoded_status?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          project_id?: string
          steward_organization_id?: string | null
          steward_person_id?: string | null
          updated_at?: string
          value_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_assets_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "impact_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "community_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_assets_steward_organization_id_fkey"
            columns: ["steward_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_assets_steward_person_id_fkey"
            columns: ["steward_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_audit_trail: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_type: string
          created_at: string
          details: Json | null
          document_id: string
          id: string
          ip_address: string | null
          project_id: string
          recipient_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          created_at?: string
          details?: Json | null
          document_id: string
          id?: string
          ip_address?: string | null
          project_id: string
          recipient_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          created_at?: string
          details?: Json | null
          document_id?: string
          id?: string
          ip_address?: string | null
          project_id?: string
          recipient_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_audit_trail_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_audit_trail_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contract_audit_trail_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_audit_trail_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "contract_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          certificate_file_path: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_signing_group: number | null
          custom_fields: Json
          declined_at: string | null
          deleted_at: string | null
          description: string | null
          expires_at: string | null
          gmail_connection_id: string | null
          id: string
          last_reminder_at: string | null
          notify_on_decline: boolean
          notify_on_sign: boolean
          notify_on_view: boolean
          opportunity_id: string | null
          organization_id: string | null
          original_file_hash: string | null
          original_file_name: string
          original_file_path: string
          owner_id: string | null
          page_count: number
          person_id: string | null
          project_id: string
          receipt_sent_at: string | null
          reminder_enabled: boolean
          reminder_interval_days: number | null
          send_completed_copy_to_recipients: boolean
          send_completed_copy_to_sender: boolean
          sender_email: string | null
          sent_at: string | null
          signed_file_hash: string | null
          signed_file_path: string | null
          signing_order_type: string
          status: string
          template_id: string | null
          title: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          certificate_file_path?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_signing_group?: number | null
          custom_fields?: Json
          declined_at?: string | null
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          gmail_connection_id?: string | null
          id?: string
          last_reminder_at?: string | null
          notify_on_decline?: boolean
          notify_on_sign?: boolean
          notify_on_view?: boolean
          opportunity_id?: string | null
          organization_id?: string | null
          original_file_hash?: string | null
          original_file_name: string
          original_file_path: string
          owner_id?: string | null
          page_count?: number
          person_id?: string | null
          project_id: string
          receipt_sent_at?: string | null
          reminder_enabled?: boolean
          reminder_interval_days?: number | null
          send_completed_copy_to_recipients?: boolean
          send_completed_copy_to_sender?: boolean
          sender_email?: string | null
          sent_at?: string | null
          signed_file_hash?: string | null
          signed_file_path?: string | null
          signing_order_type?: string
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          certificate_file_path?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_signing_group?: number | null
          custom_fields?: Json
          declined_at?: string | null
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          gmail_connection_id?: string | null
          id?: string
          last_reminder_at?: string | null
          notify_on_decline?: boolean
          notify_on_sign?: boolean
          notify_on_view?: boolean
          opportunity_id?: string | null
          organization_id?: string | null
          original_file_hash?: string | null
          original_file_name?: string
          original_file_path?: string
          owner_id?: string | null
          page_count?: number
          person_id?: string | null
          project_id?: string
          receipt_sent_at?: string | null
          reminder_enabled?: boolean
          reminder_interval_days?: number | null
          send_completed_copy_to_recipients?: boolean
          send_completed_copy_to_sender?: boolean
          sender_email?: string | null
          sent_at?: string | null
          signed_file_hash?: string | null
          signed_file_path?: string | null
          signing_order_type?: string
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contract_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_fields: {
        Row: {
          auto_populate_from: string | null
          created_at: string
          document_id: string
          field_type: string
          filled_at: string | null
          height: number
          id: string
          is_required: boolean
          label: string | null
          options: Json | null
          page_number: number
          placeholder: string | null
          project_id: string
          recipient_id: string
          updated_at: string
          validation_rule: string | null
          value: string | null
          width: number
          x: number
          y: number
        }
        Insert: {
          auto_populate_from?: string | null
          created_at?: string
          document_id: string
          field_type: string
          filled_at?: string | null
          height: number
          id?: string
          is_required?: boolean
          label?: string | null
          options?: Json | null
          page_number?: number
          placeholder?: string | null
          project_id: string
          recipient_id: string
          updated_at?: string
          validation_rule?: string | null
          value?: string | null
          width: number
          x: number
          y: number
        }
        Update: {
          auto_populate_from?: string | null
          created_at?: string
          document_id?: string
          field_type?: string
          filled_at?: string | null
          height?: number
          id?: string
          is_required?: boolean
          label?: string | null
          options?: Json | null
          page_number?: number
          placeholder?: string | null
          project_id?: string
          recipient_id?: string
          updated_at?: string
          validation_rule?: string | null
          value?: string | null
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_fields_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contract_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_fields_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "contract_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_recipients: {
        Row: {
          consent_ip: string | null
          consent_timestamp: string | null
          consent_user_agent: string | null
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          delegated_at: string | null
          delegated_to_recipient_id: string | null
          document_id: string
          email: string
          id: string
          initials_data: Json | null
          name: string
          person_id: string | null
          project_id: string
          role: string
          sent_at: string | null
          signature_data: Json | null
          signed_at: string | null
          signing_ip: string | null
          signing_order: number
          signing_token: string
          signing_user_agent: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          consent_ip?: string | null
          consent_timestamp?: string | null
          consent_user_agent?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          delegated_at?: string | null
          delegated_to_recipient_id?: string | null
          document_id: string
          email: string
          id?: string
          initials_data?: Json | null
          name: string
          person_id?: string | null
          project_id: string
          role?: string
          sent_at?: string | null
          signature_data?: Json | null
          signed_at?: string | null
          signing_ip?: string | null
          signing_order?: number
          signing_token?: string
          signing_user_agent?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          consent_ip?: string | null
          consent_timestamp?: string | null
          consent_user_agent?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          delegated_at?: string | null
          delegated_to_recipient_id?: string | null
          document_id?: string
          email?: string
          id?: string
          initials_data?: Json | null
          name?: string
          person_id?: string | null
          project_id?: string
          role?: string
          sent_at?: string | null
          signature_data?: Json | null
          signed_at?: string | null
          signing_ip?: string | null
          signing_order?: number
          signing_token?: string
          signing_user_agent?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_recipients_delegated_to_recipient_id_fkey"
            columns: ["delegated_to_recipient_id"]
            isOneToOne: false
            referencedRelation: "contract_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_recipients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_recipients_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_recipients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contract_recipients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          fields: Json
          file_name: string
          file_path: string
          html_content: string | null
          id: string
          last_used_at: string | null
          merge_fields: Json
          name: string
          page_count: number
          project_id: string
          roles: Json
          updated_at: string
          use_count: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          fields?: Json
          file_name: string
          file_path: string
          html_content?: string | null
          id?: string
          last_used_at?: string | null
          merge_fields?: Json
          name: string
          page_count?: number
          project_id: string
          roles?: Json
          updated_at?: string
          use_count?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          fields?: Json
          file_name?: string
          file_path?: string
          html_content?: string | null
          id?: string
          last_used_at?: string | null
          merge_fields?: Json
          name?: string
          page_count?: number
          project_id?: string
          roles?: Json
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contract_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_scopes: {
        Row: {
          certifications: string[]
          compensation_terms: string | null
          contractor_id: string
          created_at: string
          created_by: string | null
          description: string | null
          document_url: string | null
          end_date: string | null
          home_base_latitude: number | null
          home_base_longitude: number | null
          id: string
          project_id: string
          service_area_radius_miles: number | null
          service_categories: string[]
          service_type_ids: string[]
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          certifications?: string[]
          compensation_terms?: string | null
          contractor_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_url?: string | null
          end_date?: string | null
          home_base_latitude?: number | null
          home_base_longitude?: number | null
          id?: string
          project_id: string
          service_area_radius_miles?: number | null
          service_categories?: string[]
          service_type_ids?: string[]
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          certifications?: string[]
          compensation_terms?: string | null
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_url?: string | null
          end_date?: string | null
          home_base_latitude?: number | null
          home_base_longitude?: number | null
          id?: string
          project_id?: string
          service_area_radius_miles?: number | null
          service_categories?: string[]
          service_type_ids?: string[]
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_scopes_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_scopes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contractor_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          created_at: string
          currency: string
          date: string
          description: string | null
          dimension_id: string | null
          donor_household_id: string | null
          donor_organization_id: string | null
          donor_person_id: string | null
          grant_id: string | null
          hours: number | null
          id: string
          program_id: string | null
          project_id: string
          recipient_household_id: string | null
          recipient_person_id: string | null
          status: string
          type: string
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          date: string
          description?: string | null
          dimension_id?: string | null
          donor_household_id?: string | null
          donor_organization_id?: string | null
          donor_person_id?: string | null
          grant_id?: string | null
          hours?: number | null
          id?: string
          program_id?: string | null
          project_id: string
          recipient_household_id?: string | null
          recipient_person_id?: string | null
          status?: string
          type: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          dimension_id?: string | null
          donor_household_id?: string | null
          donor_organization_id?: string | null
          donor_person_id?: string | null
          grant_id?: string | null
          hours?: number | null
          id?: string
          program_id?: string | null
          project_id?: string
          recipient_household_id?: string | null
          recipient_person_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "impact_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_donor_household_id_fkey"
            columns: ["donor_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_donor_organization_id_fkey"
            columns: ["donor_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_donor_person_id_fkey"
            columns: ["donor_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_recipient_household_id_fkey"
            columns: ["recipient_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_recipient_person_id_fkey"
            columns: ["recipient_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_rates: {
        Row: {
          company_id: string
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          rate: number
          to_currency: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          effective_date: string
          from_currency: string
          id?: string
          rate: number
          to_currency: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
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
      dedup_settings: {
        Row: {
          auto_merge_threshold: number
          created_at: string
          id: string
          min_match_threshold: number
          project_id: string
          updated_at: string
        }
        Insert: {
          auto_merge_threshold?: number
          created_at?: string
          id?: string
          min_match_threshold?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          auto_merge_threshold?: number
          created_at?: string
          id?: string
          min_match_threshold?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dedup_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "dedup_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositions: {
        Row: {
          blocks_outreach: boolean
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entity_type: string
          id: string
          is_default: boolean
          name: string
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          blocks_outreach?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_type: string
          id?: string
          is_default?: boolean
          name: string
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          blocks_outreach?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_type?: string
          id?: string
          is_default?: boolean
          name?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "dispositions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_candidates: {
        Row: {
          created_at: string
          detection_source: string
          entity_type: string
          id: string
          match_reasons: Json
          match_score: number
          merge_audit: Json | null
          merged_at: string | null
          merged_by: string | null
          project_id: string
          source_id: string
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          survivor_id: string | null
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detection_source: string
          entity_type: string
          id?: string
          match_reasons?: Json
          match_score: number
          merge_audit?: Json | null
          merged_at?: string | null
          merged_by?: string | null
          project_id: string
          source_id: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          survivor_id?: string | null
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detection_source?: string
          entity_type?: string
          id?: string
          match_reasons?: Json
          match_score?: number
          merge_audit?: Json | null
          merged_at?: string | null
          merged_by?: string | null
          project_id?: string
          source_id?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          survivor_id?: string | null
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "duplicate_candidates_project_id_fkey"
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
          sender_name: string | null
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
          sender_name?: string | null
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
          sender_name?: string | null
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
      enrollment_waivers: {
        Row: {
          contract_document_id: string | null
          created_at: string
          enrollment_id: string
          id: string
          program_waiver_id: string
          signed_at: string | null
          updated_at: string
        }
        Insert: {
          contract_document_id?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          program_waiver_id: string
          signed_at?: string | null
          updated_at?: string
        }
        Update: {
          contract_document_id?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          program_waiver_id?: string
          signed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_waivers_contract_document_id_fkey"
            columns: ["contract_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_waivers_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "program_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_waivers_program_waiver_id_fkey"
            columns: ["program_waiver_id"]
            isOneToOne: false
            referencedRelation: "program_waivers"
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
      event_calendar_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          logo_url: string | null
          primary_color: string | null
          project_id: string
          slug: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          logo_url?: string | null
          primary_color?: string | null
          project_id: string
          slug: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          logo_url?: string | null
          primary_color?: string | null
          project_id?: string
          slug?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_calendar_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "event_calendar_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_tickets: {
        Row: {
          attendee_email: string | null
          attendee_name: string | null
          checked_in_at: string | null
          created_at: string
          id: string
          qr_code: string | null
          registration_id: string
          ticket_type_id: string
        }
        Insert: {
          attendee_email?: string | null
          attendee_name?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          qr_code?: string | null
          registration_id: string
          ticket_type_id: string
        }
        Update: {
          attendee_email?: string | null
          attendee_name?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          qr_code?: string | null
          registration_id?: string
          ticket_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_tickets_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_tickets_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          cancel_token: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          confirmation_token: string | null
          created_at: string
          event_id: string
          id: string
          ip_address: string | null
          person_id: string | null
          registrant_email: string
          registrant_name: string
          registrant_phone: string | null
          reminder_sent_1h: boolean | null
          reminder_sent_24h: boolean | null
          responses: Json
          series_registration_id: string | null
          source: string | null
          status: string
          updated_at: string
          user_agent: string | null
          waiver_signed_at: string | null
          waiver_status: string
        }
        Insert: {
          cancel_token?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmation_token?: string | null
          created_at?: string
          event_id: string
          id?: string
          ip_address?: string | null
          person_id?: string | null
          registrant_email: string
          registrant_name: string
          registrant_phone?: string | null
          reminder_sent_1h?: boolean | null
          reminder_sent_24h?: boolean | null
          responses?: Json
          series_registration_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          waiver_signed_at?: string | null
          waiver_status?: string
        }
        Update: {
          cancel_token?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmation_token?: string | null
          created_at?: string
          event_id?: string
          id?: string
          ip_address?: string | null
          person_id?: string | null
          registrant_email?: string
          registrant_name?: string
          registrant_phone?: string | null
          reminder_sent_1h?: boolean | null
          reminder_sent_24h?: boolean | null
          responses?: Json
          series_registration_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          waiver_signed_at?: string | null
          waiver_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_series_registration_id_fkey"
            columns: ["series_registration_id"]
            isOneToOne: false
            referencedRelation: "event_series_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          cancellation_policy: string | null
          category: string | null
          confirmation_message: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          custom_questions: Json
          description: string | null
          description_html: string | null
          generation_horizon_days: number
          id: string
          last_generated_date: string | null
          location_type: string
          max_tickets_per_registration: number
          organizer_email: string | null
          organizer_name: string | null
          program_id: string | null
          project_id: string
          recurrence_count: number | null
          recurrence_day_position: number | null
          recurrence_days_of_week: string[] | null
          recurrence_frequency: string
          recurrence_interval: number
          recurrence_until: string | null
          registration_enabled: boolean
          require_approval: boolean
          requires_waiver: boolean
          status: string
          tags: string[] | null
          template_end_time: string
          template_start_time: string
          timezone: string
          title: string
          total_capacity: number | null
          updated_at: string
          venue_address: string | null
          venue_latitude: number | null
          venue_longitude: number | null
          venue_name: string | null
          virtual_url: string | null
          visibility: string
          waitlist_enabled: boolean
        }
        Insert: {
          cancellation_policy?: string | null
          category?: string | null
          confirmation_message?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_questions?: Json
          description?: string | null
          description_html?: string | null
          generation_horizon_days?: number
          id?: string
          last_generated_date?: string | null
          location_type?: string
          max_tickets_per_registration?: number
          organizer_email?: string | null
          organizer_name?: string | null
          program_id?: string | null
          project_id: string
          recurrence_count?: number | null
          recurrence_day_position?: number | null
          recurrence_days_of_week?: string[] | null
          recurrence_frequency: string
          recurrence_interval?: number
          recurrence_until?: string | null
          registration_enabled?: boolean
          require_approval?: boolean
          requires_waiver?: boolean
          status?: string
          tags?: string[] | null
          template_end_time: string
          template_start_time: string
          timezone?: string
          title: string
          total_capacity?: number | null
          updated_at?: string
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
          virtual_url?: string | null
          visibility?: string
          waitlist_enabled?: boolean
        }
        Update: {
          cancellation_policy?: string | null
          category?: string | null
          confirmation_message?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_questions?: Json
          description?: string | null
          description_html?: string | null
          generation_horizon_days?: number
          id?: string
          last_generated_date?: string | null
          location_type?: string
          max_tickets_per_registration?: number
          organizer_email?: string | null
          organizer_name?: string | null
          program_id?: string | null
          project_id?: string
          recurrence_count?: number | null
          recurrence_day_position?: number | null
          recurrence_days_of_week?: string[] | null
          recurrence_frequency?: string
          recurrence_interval?: number
          recurrence_until?: string | null
          registration_enabled?: boolean
          require_approval?: boolean
          requires_waiver?: boolean
          status?: string
          tags?: string[] | null
          template_end_time?: string
          template_start_time?: string
          timezone?: string
          title?: string
          total_capacity?: number | null
          updated_at?: string
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
          virtual_url?: string | null
          visibility?: string
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "event_series_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series_registrations: {
        Row: {
          cancel_token: string | null
          created_at: string
          id: string
          person_id: string | null
          registrant_email: string
          registrant_name: string
          registrant_phone: string | null
          responses: Json
          series_id: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancel_token?: string | null
          created_at?: string
          id?: string
          person_id?: string | null
          registrant_email: string
          registrant_name: string
          registrant_phone?: string | null
          responses?: Json
          series_id: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancel_token?: string | null
          created_at?: string
          id?: string
          person_id?: string | null
          registrant_email?: string
          registrant_name?: string
          registrant_phone?: string | null
          responses?: Json
          series_id?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_registrations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_registrations_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_types: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          event_id: string
          id: string
          is_active: boolean
          is_hidden: boolean
          max_per_order: number
          name: string
          price_cents: number
          quantity_available: number | null
          sales_end_at: string | null
          sales_start_at: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          max_per_order?: number
          name: string
          price_cents?: number
          quantity_available?: number | null
          sales_end_at?: string | null
          sales_start_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          max_per_order?: number
          name?: string
          price_cents?: number
          quantity_available?: number | null
          sales_end_at?: string | null
          sales_start_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_type_members: {
        Row: {
          created_at: string | null
          event_type_id: string
          id: string
          is_active: boolean | null
          priority: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_type_id: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_type_id?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_type_members_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_type_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          asset_id: string | null
          buffer_after_minutes: number | null
          buffer_before_minutes: number | null
          cancellation_policy: string | null
          color: string | null
          confirmation_message: string | null
          created_at: string | null
          custom_questions: Json | null
          daily_limit: number | null
          default_meeting_type: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          location_type: string
          location_value: string | null
          max_attendees: number | null
          max_days_in_advance: number | null
          min_notice_hours: number | null
          program_id: string | null
          project_id: string
          redirect_url: string | null
          requires_confirmation: boolean | null
          schedule_id: string | null
          scheduling_type: string | null
          slot_interval_minutes: number | null
          slug: string
          title: string
          updated_at: string | null
          user_id: string
          weekly_limit: number | null
        }
        Insert: {
          asset_id?: string | null
          buffer_after_minutes?: number | null
          buffer_before_minutes?: number | null
          cancellation_policy?: string | null
          color?: string | null
          confirmation_message?: string | null
          created_at?: string | null
          custom_questions?: Json | null
          daily_limit?: number | null
          default_meeting_type?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          location_type?: string
          location_value?: string | null
          max_attendees?: number | null
          max_days_in_advance?: number | null
          min_notice_hours?: number | null
          program_id?: string | null
          project_id: string
          redirect_url?: string | null
          requires_confirmation?: boolean | null
          schedule_id?: string | null
          scheduling_type?: string | null
          slot_interval_minutes?: number | null
          slug: string
          title: string
          updated_at?: string | null
          user_id: string
          weekly_limit?: number | null
        }
        Update: {
          asset_id?: string | null
          buffer_after_minutes?: number | null
          buffer_before_minutes?: number | null
          cancellation_policy?: string | null
          color?: string | null
          confirmation_message?: string | null
          created_at?: string | null
          custom_questions?: Json | null
          daily_limit?: number | null
          default_meeting_type?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          location_type?: string
          location_value?: string | null
          max_attendees?: number | null
          max_days_in_advance?: number | null
          min_notice_hours?: number | null
          program_id?: string | null
          project_id?: string
          redirect_url?: string | null
          requires_confirmation?: boolean | null
          schedule_id?: string | null
          scheduling_type?: string | null
          slot_interval_minutes?: number | null
          slug?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          weekly_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_types_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "community_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "event_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "availability_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waivers: {
        Row: {
          created_at: string
          event_id: string
          id: string
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waivers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waivers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          add_to_crm: boolean
          cancellation_policy: string | null
          category: string | null
          confirmation_message: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          custom_questions: Json
          description: string | null
          description_html: string | null
          ends_at: string
          id: string
          is_all_day: boolean
          location_type: string
          max_tickets_per_registration: number
          organizer_email: string | null
          organizer_name: string | null
          program_id: string | null
          project_id: string
          published_at: string | null
          registration_closes_at: string | null
          registration_enabled: boolean
          registration_opens_at: string | null
          require_approval: boolean
          requires_waiver: boolean
          series_id: string | null
          series_index: number | null
          series_instance_modified: boolean
          slug: string
          starts_at: string
          status: string
          tags: string[] | null
          timezone: string
          title: string
          total_capacity: number | null
          updated_at: string
          venue_address: string | null
          venue_latitude: number | null
          venue_longitude: number | null
          venue_name: string | null
          virtual_url: string | null
          visibility: string
          waitlist_enabled: boolean
        }
        Insert: {
          add_to_crm?: boolean
          cancellation_policy?: string | null
          category?: string | null
          confirmation_message?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_questions?: Json
          description?: string | null
          description_html?: string | null
          ends_at: string
          id?: string
          is_all_day?: boolean
          location_type?: string
          max_tickets_per_registration?: number
          organizer_email?: string | null
          organizer_name?: string | null
          program_id?: string | null
          project_id: string
          published_at?: string | null
          registration_closes_at?: string | null
          registration_enabled?: boolean
          registration_opens_at?: string | null
          require_approval?: boolean
          requires_waiver?: boolean
          series_id?: string | null
          series_index?: number | null
          series_instance_modified?: boolean
          slug: string
          starts_at: string
          status?: string
          tags?: string[] | null
          timezone?: string
          title: string
          total_capacity?: number | null
          updated_at?: string
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
          virtual_url?: string | null
          visibility?: string
          waitlist_enabled?: boolean
        }
        Update: {
          add_to_crm?: boolean
          cancellation_policy?: string | null
          category?: string | null
          confirmation_message?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_questions?: Json
          description?: string | null
          description_html?: string | null
          ends_at?: string
          id?: string
          is_all_day?: boolean
          location_type?: string
          max_tickets_per_registration?: number
          organizer_email?: string | null
          organizer_name?: string | null
          program_id?: string | null
          project_id?: string
          published_at?: string | null
          registration_closes_at?: string | null
          registration_enabled?: boolean
          registration_opens_at?: string | null
          require_approval?: boolean
          requires_waiver?: boolean
          series_id?: string | null
          series_index?: number | null
          series_instance_modified?: boolean
          slug?: string
          starts_at?: string
          status?: string
          tags?: string[] | null
          timezone?: string
          title?: string
          total_capacity?: number | null
          updated_at?: string
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
          virtual_url?: string | null
          visibility?: string
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
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
      grant_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          grant_id: string
          id: string
          is_required: boolean
          is_submitted: boolean
          label: string
          mime_type: string | null
          notes: string | null
          project_id: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          grant_id: string
          id?: string
          is_required?: boolean
          is_submitted?: boolean
          label: string
          mime_type?: string | null
          notes?: string | null
          project_id: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          grant_id?: string
          id?: string
          is_required?: boolean
          is_submitted?: boolean
          label?: string
          mime_type?: string | null
          notes?: string | null
          project_id?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "grant_documents_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "grant_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_report_schedules: {
        Row: {
          created_at: string
          document_id: string | null
          due_date: string
          grant_id: string
          id: string
          notes: string | null
          project_id: string
          report_type: string
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          due_date: string
          grant_id: string
          id?: string
          notes?: string | null
          project_id: string
          report_type: string
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          due_date?: string
          grant_id?: string
          id?: string
          notes?: string | null
          project_id?: string
          report_type?: string
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_report_schedules_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "grant_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_report_schedules_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_report_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "grant_report_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          agreement_status: string | null
          amount_awarded: number | null
          amount_requested: number | null
          application_due_at: string | null
          assigned_to: string | null
          award_number: string | null
          award_period_end: string | null
          award_period_start: string | null
          closeout_date: string | null
          contact_person_id: string | null
          contract_document_id: string | null
          created_at: string
          funder_grant_id: string | null
          funder_organization_id: string | null
          id: string
          indirect_cost_rate: number | null
          loi_due_at: string | null
          match_required: number | null
          match_type: string | null
          name: string
          notes: string | null
          program_id: string | null
          project_id: string
          report_due_at: string | null
          status: string
          total_award_amount: number | null
          updated_at: string
        }
        Insert: {
          agreement_status?: string | null
          amount_awarded?: number | null
          amount_requested?: number | null
          application_due_at?: string | null
          assigned_to?: string | null
          award_number?: string | null
          award_period_end?: string | null
          award_period_start?: string | null
          closeout_date?: string | null
          contact_person_id?: string | null
          contract_document_id?: string | null
          created_at?: string
          funder_grant_id?: string | null
          funder_organization_id?: string | null
          id?: string
          indirect_cost_rate?: number | null
          loi_due_at?: string | null
          match_required?: number | null
          match_type?: string | null
          name: string
          notes?: string | null
          program_id?: string | null
          project_id: string
          report_due_at?: string | null
          status?: string
          total_award_amount?: number | null
          updated_at?: string
        }
        Update: {
          agreement_status?: string | null
          amount_awarded?: number | null
          amount_requested?: number | null
          application_due_at?: string | null
          assigned_to?: string | null
          award_number?: string | null
          award_period_end?: string | null
          award_period_start?: string | null
          closeout_date?: string | null
          contact_person_id?: string | null
          contract_document_id?: string | null
          created_at?: string
          funder_grant_id?: string | null
          funder_organization_id?: string | null
          id?: string
          indirect_cost_rate?: number | null
          loi_due_at?: string | null
          match_required?: number | null
          match_type?: string | null
          name?: string
          notes?: string | null
          program_id?: string | null
          project_id?: string
          report_due_at?: string | null
          status?: string
          total_award_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grants_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_contract_document_id_fkey"
            columns: ["contract_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_funder_organization_id_fkey"
            columns: ["funder_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "grants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      household_intake: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          created_at: string
          household_id: string
          id: string
          needs: Json
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          created_at?: string
          household_id: string
          id?: string
          needs?: Json
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          created_at?: string
          household_id?: string
          id?: string
          needs?: Json
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_intake_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_intake_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          end_date: string | null
          household_id: string
          id: string
          is_primary_contact: boolean
          person_id: string
          relationship: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          household_id: string
          id?: string
          is_primary_contact?: boolean
          person_id: string
          relationship: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          household_id?: string
          id?: string
          is_primary_contact?: boolean
          person_id?: string
          relationship?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          deleted_at: string | null
          geocoded_status: string
          household_size: number | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          primary_contact_person_id: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          geocoded_status?: string
          household_size?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          primary_contact_person_id?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          geocoded_status?: string
          household_size?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          primary_contact_person_id?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "households_primary_contact_person_id_fkey"
            columns: ["primary_contact_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "households_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "households_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_dimensions: {
        Row: {
          color: string
          created_at: string
          description: string | null
          framework_id: string
          icon: string
          id: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          description?: string | null
          framework_id: string
          icon: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          framework_id?: string
          icon?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_dimensions_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "impact_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_frameworks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          project_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          project_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_frameworks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "impact_frameworks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      invoice_line_items: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          tax_amount: number
          tax_rate_id: string | null
          unit_price: number
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          unit_price: number
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_tax_summary: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          tax_amount: number
          tax_name: string
          tax_rate: number
          tax_rate_id: string
          taxable_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          tax_amount: number
          tax_name: string
          tax_rate: number
          tax_rate_id: string
          taxable_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          tax_amount?: number
          tax_name?: string
          tax_rate?: number
          tax_rate_id?: string
          taxable_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_tax_summary_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_tax_summary_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance_due: number
          company_id: string
          contact_id: string | null
          contract_id: string | null
          created_at: string
          created_by: string
          currency: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          due_date: string
          exchange_rate: number
          footer: string | null
          id: string
          invoice_date: string
          invoice_number: string
          journal_entry_id: string | null
          notes: string | null
          opportunity_id: string | null
          organization_id: string | null
          paid_at: string | null
          payment_terms: number | null
          project_id: string | null
          sent_at: string | null
          status: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          company_id: string
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          deleted_at?: string | null
          due_date: string
          exchange_rate?: number
          footer?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          journal_entry_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_terms?: number | null
          project_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          company_id?: string
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          deleted_at?: string | null
          due_date?: string
          exchange_rate?: number
          footer?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          journal_entry_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_terms?: number | null
          project_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_time_entries: {
        Row: {
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          is_break: boolean
          job_id: string
          notes: string | null
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_break?: boolean
          job_id: string
          notes?: string | null
          started_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_break?: boolean
          job_id?: string
          notes?: string | null
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_by: string | null
          completed_at: string | null
          contractor_id: string | null
          created_at: string
          deadline: string | null
          description: string | null
          desired_start: string | null
          id: string
          is_out_of_scope: boolean
          notes: string | null
          priority: string
          project_id: string
          pulled_at: string | null
          required_certifications: string[]
          scope_id: string | null
          service_address: string | null
          service_category: string | null
          service_latitude: number | null
          service_longitude: number | null
          service_type_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          completed_at?: string | null
          contractor_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          desired_start?: string | null
          id?: string
          is_out_of_scope?: boolean
          notes?: string | null
          priority?: string
          project_id: string
          pulled_at?: string | null
          required_certifications?: string[]
          scope_id?: string | null
          service_address?: string | null
          service_category?: string | null
          service_latitude?: number | null
          service_longitude?: number | null
          service_type_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          completed_at?: string | null
          contractor_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          desired_start?: string | null
          id?: string
          is_out_of_scope?: boolean
          notes?: string | null
          priority?: string
          project_id?: string
          pulled_at?: string | null
          required_certifications?: string[]
          scope_id?: string | null
          service_address?: string | null
          service_category?: string | null
          service_latitude?: number | null
          service_longitude?: number | null
          service_type_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "contractor_scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          entry_date: string
          entry_number: number
          id: string
          memo: string | null
          posted_at: string | null
          project_id: string | null
          reference: string | null
          source_id: string | null
          source_type: string | null
          status: string
          updated_at: string
          voided_at: string | null
          voided_by_entry_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          entry_date: string
          entry_number: number
          id?: string
          memo?: string | null
          posted_at?: string | null
          project_id?: string | null
          reference?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          voided_at?: string | null
          voided_by_entry_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          entry_date?: string
          entry_number?: number
          id?: string
          memo?: string | null
          posted_at?: string | null
          project_id?: string | null
          reference?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          voided_at?: string | null
          voided_by_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journal_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_voided_by_entry_id_fkey"
            columns: ["voided_by_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          base_credit: number
          base_debit: number
          created_at: string
          credit: number
          currency: string
          debit: number
          description: string | null
          exchange_rate: number
          id: string
          journal_entry_id: string
          organization_id: string | null
        }
        Insert: {
          account_id: string
          base_credit?: number
          base_debit?: number
          created_at?: string
          credit?: number
          currency?: string
          debit?: number
          description?: string | null
          exchange_rate?: number
          id?: string
          journal_entry_id: string
          organization_id?: string | null
        }
        Update: {
          account_id?: string
          base_credit?: number
          base_debit?: number
          created_at?: string
          credit?: number
          currency?: string
          debit?: number
          description?: string | null
          exchange_rate?: number
          id?: string
          journal_entry_id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_api_keys: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          key_encrypted: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          project_id: string
          revoked_at: string | null
          role: string
          scopes: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          key_encrypted: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          project_id: string
          revoked_at?: string | null
          role?: string
          scopes?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          key_encrypted?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          project_id?: string
          revoked_at?: string | null
          role?: string
          scopes?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_api_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mcp_api_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_external_servers: {
        Row: {
          auth_config_enc: string | null
          created_at: string | null
          created_by: string
          description: string | null
          health_status: string | null
          id: string
          is_active: boolean | null
          last_health_check: string | null
          name: string
          project_id: string
          tool_manifest: Json | null
          transport_type: string
          updated_at: string | null
          url: string
        }
        Insert: {
          auth_config_enc?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_health_check?: string | null
          name: string
          project_id: string
          tool_manifest?: Json | null
          transport_type?: string
          updated_at?: string | null
          url: string
        }
        Update: {
          auth_config_enc?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_health_check?: string | null
          name?: string
          project_id?: string
          tool_manifest?: Json | null
          transport_type?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_external_servers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mcp_external_servers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tool_configs: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          min_role: string | null
          project_id: string
          rate_limit_per_hour: number | null
          rate_limit_per_minute: number | null
          tool_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          min_role?: string | null
          project_id: string
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          tool_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          min_role?: string | null
          project_id?: string
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          tool_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tool_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mcp_tool_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_usage_logs: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_summary: Json | null
          ip_address: unknown
          output_summary: string | null
          project_id: string
          status: string
          tool_name: string
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: Json | null
          ip_address?: unknown
          output_summary?: string | null
          project_id: string
          status?: string
          tool_name: string
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: Json | null
          ip_address?: unknown
          output_summary?: string | null
          project_id?: string
          status?: string
          tool_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "mcp_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_usage_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mcp_usage_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      merge_history: {
        Row: {
          entity_type: string
          field_selections: Json | null
          id: string
          merged_at: string
          merged_by: string | null
          merged_ids: string[]
          merged_records_snapshot: Json | null
          project_id: string
          related_records_moved: Json | null
          survivor_id: string
        }
        Insert: {
          entity_type: string
          field_selections?: Json | null
          id?: string
          merged_at?: string
          merged_by?: string | null
          merged_ids: string[]
          merged_records_snapshot?: Json | null
          project_id: string
          related_records_moved?: Json | null
          survivor_id: string
        }
        Update: {
          entity_type?: string
          field_selections?: Json | null
          id?: string
          merged_at?: string
          merged_by?: string | null
          merged_ids?: string[]
          merged_records_snapshot?: Json | null
          project_id?: string
          related_records_moved?: Json | null
          survivor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merge_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "merge_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      municipal_scan_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          minutes_fetched: number | null
          municipality_id: string | null
          rfps_created: number | null
          rfps_detected: number | null
          scan_completed_at: string | null
          scan_started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          minutes_fetched?: number | null
          municipality_id?: string | null
          rfps_created?: number | null
          rfps_detected?: number | null
          scan_completed_at?: string | null
          scan_started_at?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          minutes_fetched?: number | null
          municipality_id?: string | null
          rfps_created?: number | null
          rfps_detected?: number | null
          scan_completed_at?: string | null
          scan_started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipal_scan_logs_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          last_scanned_at: string | null
          minutes_url: string | null
          municipality_type: string | null
          name: string
          official_website: string | null
          population: number | null
          province: string
          rfps_found_count: number | null
          scan_error: string | null
          scan_status: string | null
          updated_at: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          last_scanned_at?: string | null
          minutes_url?: string | null
          municipality_type?: string | null
          name: string
          official_website?: string | null
          population?: number | null
          province: string
          rfps_found_count?: number | null
          scan_error?: string | null
          scan_status?: string | null
          updated_at?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          last_scanned_at?: string | null
          minutes_url?: string | null
          municipality_type?: string | null
          name?: string
          official_website?: string | null
          population?: number | null
          province?: string
          rfps_found_count?: number | null
          scan_error?: string | null
          scan_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          category: string | null
          content: string
          content_html: string | null
          created_at: string | null
          created_by: string
          event_id: string | null
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
          category?: string | null
          content: string
          content_html?: string | null
          created_at?: string | null
          created_by: string
          event_id?: string | null
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
          category?: string | null
          content?: string
          content_html?: string | null
          created_at?: string | null
          created_by?: string
          event_id?: string | null
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
            foreignKeyName: "notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          billing_address: Json | null
          billing_email: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          default_tax_rate_id: string | null
          deleted_at: string | null
          description: string | null
          disposition_id: string | null
          domain: string | null
          employee_count: number | null
          id: string
          industry: string | null
          is_customer: boolean
          is_referral_partner: boolean
          is_vendor: boolean
          latitude: number | null
          linkedin_url: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          payment_terms: number | null
          phone: string | null
          project_id: string
          tax_id: string | null
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
          billing_address?: Json | null
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          default_tax_rate_id?: string | null
          deleted_at?: string | null
          description?: string | null
          disposition_id?: string | null
          domain?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_customer?: boolean
          is_referral_partner?: boolean
          is_vendor?: boolean
          latitude?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          payment_terms?: number | null
          phone?: string | null
          project_id: string
          tax_id?: string | null
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
          billing_address?: Json | null
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          default_tax_rate_id?: string | null
          deleted_at?: string | null
          description?: string | null
          disposition_id?: string | null
          domain?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_customer?: boolean
          is_referral_partner?: boolean
          is_vendor?: boolean
          latitude?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          payment_terms?: number | null
          phone?: string | null
          project_id?: string
          tax_id?: string | null
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
            foreignKeyName: "organizations_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: false
            referencedRelation: "dispositions"
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
      payments: {
        Row: {
          account_id: string
          amount: number
          bill_id: string | null
          company_id: string
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          exchange_rate: number
          id: string
          invoice_id: string | null
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          payment_date: string
          payment_method: string | null
          payment_type: string
          project_id: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          bill_id?: string | null
          company_id: string
          created_at?: string
          created_by: string
          currency?: string
          deleted_at?: string | null
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date: string
          payment_method?: string | null
          payment_type?: string
          project_id?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          bill_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_type?: string
          project_id?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
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
          disposition_id: string | null
          email: string | null
          email_verified: boolean | null
          email_verified_at: string | null
          enriched_at: string | null
          enrichment_data: Json | null
          enrichment_status: string | null
          first_name: string
          id: string
          is_contractor: boolean
          is_volunteer: boolean
          job_title: string | null
          last_name: string
          latitude: number | null
          linkedin_outreach_status: string | null
          linkedin_url: string | null
          longitude: number | null
          mobile_phone: string | null
          notes: string | null
          phone: string | null
          preferred_contact_method: string | null
          project_id: string
          timezone: string | null
          twitter_handle: string | null
          updated_at: string
          user_id: string | null
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
          disposition_id?: string | null
          email?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enrichment_status?: string | null
          first_name: string
          id?: string
          is_contractor?: boolean
          is_volunteer?: boolean
          job_title?: string | null
          last_name: string
          latitude?: number | null
          linkedin_outreach_status?: string | null
          linkedin_url?: string | null
          longitude?: number | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          project_id: string
          timezone?: string | null
          twitter_handle?: string | null
          updated_at?: string
          user_id?: string | null
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
          disposition_id?: string | null
          email?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enrichment_status?: string | null
          first_name?: string
          id?: string
          is_contractor?: boolean
          is_volunteer?: boolean
          job_title?: string | null
          last_name?: string
          latitude?: number | null
          linkedin_outreach_status?: string | null
          linkedin_url?: string | null
          longitude?: number | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          project_id?: string
          timezone?: string | null
          twitter_handle?: string | null
          updated_at?: string
          user_id?: string | null
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
            foreignKeyName: "people_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: false
            referencedRelation: "dispositions"
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
          {
            foreignKeyName: "people_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      products: {
        Row: {
          created_at: string
          created_by: string | null
          default_price: number | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          project_id: string
          sku: string | null
          unit_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_price?: number | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          sku?: string | null
          unit_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_price?: number | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          sku?: string | null
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      program_attendance: {
        Row: {
          created_at: string
          date: string
          hours: number
          id: string
          person_id: string
          program_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          hours?: number
          id?: string
          person_id: string
          program_id: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          hours?: number
          id?: string
          person_id?: string
          program_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_attendance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          enrolled_at: string
          household_id: string | null
          id: string
          notes: string | null
          person_id: string | null
          program_id: string
          status: string
          updated_at: string
          waiver_status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string
          household_id?: string | null
          id?: string
          notes?: string | null
          person_id?: string | null
          program_id: string
          status?: string
          updated_at?: string
          waiver_status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string
          household_id?: string | null
          id?: string
          notes?: string | null
          person_id?: string | null
          program_id?: string
          status?: string
          updated_at?: string
          waiver_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_enrollments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_waivers: {
        Row: {
          created_at: string
          id: string
          program_id: string
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_waivers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_waivers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          location_latitude: number | null
          location_longitude: number | null
          location_name: string | null
          name: string
          project_id: string
          requires_waiver: boolean
          schedule: Json | null
          start_date: string | null
          status: string
          target_dimensions: string[]
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          name: string
          project_id: string
          requires_waiver?: boolean
          schedule?: Json | null
          start_date?: string | null
          status?: string
          target_dimensions?: string[]
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          name?: string
          project_id?: string
          requires_waiver?: boolean
          schedule?: Json | null
          start_date?: string | null
          status?: string
          target_dimensions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "programs_project_id_fkey"
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
      project_secrets: {
        Row: {
          created_at: string
          encrypted_value: string
          id: string
          key_name: string
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          encrypted_value: string
          id?: string
          key_name: string
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          encrypted_value?: string
          id?: string
          key_name?: string
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_secrets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_secrets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_secrets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          accounting_company_id: string | null
          accounting_target: string | null
          calendar_sync_enabled: boolean | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          impact_framework_id: string | null
          logo_url: string | null
          name: string
          owner_id: string
          project_type: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          accounting_company_id?: string | null
          accounting_target?: string | null
          calendar_sync_enabled?: boolean | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          impact_framework_id?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          project_type?: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          accounting_company_id?: string | null
          accounting_target?: string | null
          calendar_sync_enabled?: boolean | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          impact_framework_id?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          project_type?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_accounting_company_id_fkey"
            columns: ["accounting_company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_impact_framework_id_fkey"
            columns: ["impact_framework_id"]
            isOneToOne: false
            referencedRelation: "impact_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      public_dashboard_configs: {
        Row: {
          access_type: string
          archived_at: string | null
          created_at: string
          data_freshness: string
          date_range_end: string | null
          date_range_start: string | null
          date_range_type: string
          description: string | null
          excluded_categories: string[]
          geo_granularity: string
          hero_image_url: string | null
          id: string
          min_count_threshold: number
          password_hash: string | null
          project_id: string
          published_at: string | null
          published_by: string | null
          slug: string
          snapshot_data: Json | null
          status: string
          theme: Json
          title: string
          updated_at: string
          widget_order: string[]
          widgets: Json
        }
        Insert: {
          access_type?: string
          archived_at?: string | null
          created_at?: string
          data_freshness?: string
          date_range_end?: string | null
          date_range_start?: string | null
          date_range_type?: string
          description?: string | null
          excluded_categories?: string[]
          geo_granularity?: string
          hero_image_url?: string | null
          id?: string
          min_count_threshold?: number
          password_hash?: string | null
          project_id: string
          published_at?: string | null
          published_by?: string | null
          slug: string
          snapshot_data?: Json | null
          status?: string
          theme?: Json
          title: string
          updated_at?: string
          widget_order?: string[]
          widgets?: Json
        }
        Update: {
          access_type?: string
          archived_at?: string | null
          created_at?: string
          data_freshness?: string
          date_range_end?: string | null
          date_range_start?: string | null
          date_range_type?: string
          description?: string | null
          excluded_categories?: string[]
          geo_granularity?: string
          hero_image_url?: string | null
          id?: string
          min_count_threshold?: number
          password_hash?: string | null
          project_id?: string
          published_at?: string | null
          published_by?: string | null
          slug?: string
          snapshot_data?: Json | null
          status?: string
          theme?: Json
          title?: string
          updated_at?: string
          widget_order?: string[]
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "public_dashboard_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "public_dashboard_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_dashboard_configs_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      public_dashboard_share_links: {
        Row: {
          access_count: number
          config_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          last_accessed_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          access_count?: number
          config_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_accessed_at?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          access_count?: number
          config_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_accessed_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_dashboard_share_links_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "public_dashboard_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_dashboard_share_links_created_by_fkey"
            columns: ["created_by"]
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
      quote_line_items: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          line_total: number
          name: string
          product_id: string | null
          quantity: number
          quote_id: string
          sort_order: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          line_total?: number
          name: string
          product_id?: string | null
          quantity?: number
          quote_id: string
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          line_total?: number
          name?: string
          product_id?: string | null
          quantity?: number
          quote_id?: string
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          discount_total: number
          id: string
          is_primary: boolean
          notes: string | null
          opportunity_id: string
          project_id: string
          quote_number: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          title: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount_total?: number
          id?: string
          is_primary?: boolean
          notes?: string | null
          opportunity_id: string
          project_id: string
          quote_number?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          title: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount_total?: number
          id?: string
          is_primary?: boolean
          notes?: string | null
          opportunity_id?: string
          project_id?: string
          quote_number?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotes_opportunity_project"
            columns: ["opportunity_id", "project_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_confirmations: {
        Row: {
          account_code: string | null
          accounting_target: string
          amount: number
          class_name: string | null
          created_at: string
          description: string | null
          error_message: string | null
          external_bill_id: string | null
          id: string
          image_url: string
          ocr_raw: Json
          project_id: string
          receipt_date: string
          status: string
          submitted_by: string | null
          updated_at: string
          vendor: string
        }
        Insert: {
          account_code?: string | null
          accounting_target: string
          amount: number
          class_name?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          external_bill_id?: string | null
          id?: string
          image_url: string
          ocr_raw?: Json
          project_id: string
          receipt_date: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
          vendor: string
        }
        Update: {
          account_code?: string | null
          accounting_target?: string
          amount?: number
          class_name?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          external_bill_id?: string | null
          id?: string
          image_url?: string
          ocr_raw?: Json
          project_id?: string
          receipt_date?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_confirmations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "receipt_confirmations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_confirmations_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_items: {
        Row: {
          bank_transaction_id: string
          created_at: string
          id: string
          reconciliation_id: string
        }
        Insert: {
          bank_transaction_id: string
          created_at?: string
          id?: string
          reconciliation_id: string
        }
        Update: {
          bank_transaction_id?: string
          created_at?: string
          id?: string
          reconciliation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_items_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_items_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliations: {
        Row: {
          bank_account_id: string
          company_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          difference: number
          id: string
          reconciled_balance: number
          statement_date: string
          statement_ending_balance: number
          statement_starting_balance: number
          status: string
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          difference?: number
          id?: string
          reconciled_balance?: number
          statement_date: string
          statement_ending_balance: number
          statement_starting_balance?: number
          status?: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          difference?: number
          id?: string
          reconciled_balance?: number
          statement_date?: string
          statement_ending_balance?: number
          statement_starting_balance?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          company_id: string
          contact_id: string | null
          counterparty_address: string | null
          counterparty_email: string | null
          counterparty_name: string
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          description: string | null
          end_date: string | null
          footer: string | null
          frequency: string
          id: string
          is_active: boolean
          last_generated_at: string | null
          line_items: Json
          name: string
          next_date: string
          notes: string | null
          occurrences_remaining: number | null
          organization_id: string | null
          project_id: string | null
          start_date: string
          total_generated: number
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          counterparty_address?: string | null
          counterparty_email?: string | null
          counterparty_name: string
          created_at?: string
          created_by: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          footer?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          line_items?: Json
          name: string
          next_date: string
          notes?: string | null
          occurrences_remaining?: number | null
          organization_id?: string | null
          project_id?: string | null
          start_date: string
          total_generated?: number
          type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          counterparty_address?: string | null
          counterparty_email?: string | null
          counterparty_name?: string
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          footer?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          line_items?: Json
          name?: string
          next_date?: string
          notes?: string | null
          occurrences_remaining?: number | null
          organization_id?: string | null
          project_id?: string | null
          start_date?: string
          total_generated?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          household_id: string | null
          id: string
          notes: string | null
          outcome: string | null
          partner_organization_id: string | null
          person_id: string | null
          project_id: string
          service_type: string
          service_type_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          partner_organization_id?: string | null
          person_id?: string | null
          project_id: string
          service_type: string
          service_type_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          partner_organization_id?: string | null
          person_id?: string | null
          project_id?: string
          service_type?: string
          service_type_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "referrals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_waivers: {
        Row: {
          contract_document_id: string | null
          created_at: string
          event_waiver_id: string
          id: string
          registration_id: string
          signed_at: string | null
          updated_at: string
        }
        Insert: {
          contract_document_id?: string | null
          created_at?: string
          event_waiver_id: string
          id?: string
          registration_id: string
          signed_at?: string | null
          updated_at?: string
        }
        Update: {
          contract_document_id?: string | null
          created_at?: string
          event_waiver_id?: string
          id?: string
          registration_id?: string
          signed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_waivers_contract_document_id_fkey"
            columns: ["contract_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_waivers_event_waiver_id_fkey"
            columns: ["event_waiver_id"]
            isOneToOne: false
            referencedRelation: "event_waivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_waivers_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          person_a_id: string
          person_b_id: string
          project_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          person_a_id: string
          person_b_id: string
          project_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          person_a_id?: string
          person_b_id?: string
          project_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_person_a_id_fkey"
            columns: ["person_a_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_person_b_id_fkey"
            columns: ["person_b_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "relationships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          scan_batch: string | null
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
          scan_batch?: string | null
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
          scan_batch?: string | null
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
      round_robin_state: {
        Row: {
          assignment_count: Json | null
          event_type_id: string
          id: string
          last_assigned_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          assignment_count?: Json | null
          event_type_id: string
          id?: string
          last_assigned_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assignment_count?: Json | null
          event_type_id?: string
          id?: string
          last_assigned_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_robin_state_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: true
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_state_last_assigned_user_id_fkey"
            columns: ["last_assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          co_recipient_ids: string[] | null
          completed_at: string | null
          created_at: string | null
          created_by: string
          current_step: number
          disposition_reason: string | null
          dispositioned_at: string | null
          dispositioned_by: string | null
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
          co_recipient_ids?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          current_step?: number
          disposition_reason?: string | null
          dispositioned_at?: string | null
          dispositioned_by?: string | null
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
          co_recipient_ids?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          current_step?: number
          disposition_reason?: string | null
          dispositioned_at?: string | null
          dispositioned_by?: string | null
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
            foreignKeyName: "sequence_enrollments_dispositioned_by_fkey"
            columns: ["dispositioned_by"]
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
          attachments: Json | null
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
          attachments?: Json | null
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
          attachments?: Json | null
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
      service_types: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "service_types_project_id_fkey"
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
      synced_events: {
        Row: {
          created_at: string | null
          end_at: string
          external_id: string
          id: string
          integration_id: string
          is_all_day: boolean | null
          raw_data: Json | null
          source_calendar: string | null
          start_at: string
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_at: string
          external_id: string
          id?: string
          integration_id: string
          is_all_day?: boolean | null
          raw_data?: Json | null
          source_calendar?: string | null
          start_at: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_at?: string
          external_id?: string
          id?: string
          integration_id?: string
          is_all_day?: boolean | null
          raw_data?: Json | null
          source_calendar?: string | null
          start_at?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synced_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "calendar_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_admin_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          target_id: string | null
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_admin_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_admin_sessions: {
        Row: {
          admin_user_id: string
          entered_at: string
          exited_at: string | null
          id: string
          membership_id: string
          project_id: string
        }
        Insert: {
          admin_user_id: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          membership_id: string
          project_id: string
        }
        Update: {
          admin_user_id?: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          membership_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_admin_sessions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_admin_sessions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "project_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_admin_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "system_admin_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
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
      tax_rates: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          rate: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          rate?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
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
          is_system_admin: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_system_admin?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_system_admin?: boolean
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
      workflow_executions: {
        Row: {
          completed_at: string | null
          context_data: Json
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          started_at: string
          status: string
          trigger_event: Json
          workflow_id: string
          workflow_version: number
        }
        Insert: {
          completed_at?: string | null
          context_data?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          trigger_event?: Json
          workflow_id: string
          workflow_version: number
        }
        Update: {
          completed_at?: string | null
          context_data?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          trigger_event?: Json
          workflow_id?: string
          workflow_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_step_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_id: string
          id: string
          input_data: Json | null
          node_id: string
          node_type: string
          output_data: Json | null
          retry_count: number
          scheduled_for: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_id: string
          id?: string
          input_data?: Json | null
          node_id: string
          node_type: string
          output_data?: Json | null
          retry_count?: number
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_id?: string
          id?: string
          input_data?: Json | null
          node_id?: string
          node_type?: string
          output_data?: Json | null
          retry_count?: number
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_executions_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "workflow_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by: string
          definition: Json
          id: string
          trigger_config: Json
          trigger_type: string
          version: number
          workflow_id: string
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by: string
          definition: Json
          id?: string
          trigger_config?: Json
          trigger_type: string
          version: number
          workflow_id: string
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by?: string
          definition?: Json
          id?: string
          trigger_config?: Json
          trigger_type?: string
          version?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string
          current_version: number
          definition: Json
          description: string | null
          execution_count: number
          id: string
          is_active: boolean
          is_template: boolean
          last_executed_at: string | null
          name: string
          project_id: string
          tags: string[] | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_version?: number
          definition?: Json
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          is_template?: boolean
          last_executed_at?: string | null
          name: string
          project_id: string
          tags?: string[] | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_version?: number
          definition?: Json
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          is_template?: boolean
          last_executed_at?: string | null
          name?: string
          project_id?: string
          tags?: string[] | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "workflows_project_id_fkey"
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
      _build_report_join: {
        Args: { p_primary: string; p_related: string }
        Returns: string
      }
      _resolve_report_fk: {
        Args: { p_primary: string; p_related: string }
        Returns: string
      }
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      accept_quote: {
        Args: {
          p_project_id: string
          p_quote_id: string
          p_sync_amount?: boolean
        }
        Returns: Json
      }
      advance_recurring_date: {
        Args: { p_current_date: string; p_frequency: string }
        Returns: string
      }
      allocate_bill_number: { Args: { p_company_id: string }; Returns: string }
      allocate_invoice_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      allocate_je_number: { Args: { p_company_id: string }; Returns: number }
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
      community_can_access_shared_directory: {
        Args: { p_action: string; p_project_id: string }
        Returns: boolean
      }
      community_contractor_can_view_job: {
        Args: { p_job_id: string }
        Returns: boolean
      }
      community_contractor_person_id: {
        Args: { p_project_id: string }
        Returns: string
      }
      community_current_role: {
        Args: { p_project_id: string }
        Returns: Database["public"]["Enums"]["project_role"]
      }
      community_has_permission: {
        Args: { p_action: string; p_project_id: string; p_resource: string }
        Returns: boolean
      }
      complete_reconciliation: {
        Args: { p_reconciliation_id: string }
        Returns: string
      }
      count_active_projects_7d: { Args: never; Returns: number }
      count_projects_missing_api_key: { Args: never; Returns: number }
      create_bill:
        | {
            Args: {
              p_bill_date: string
              p_company_id: string
              p_contact_id?: string
              p_currency?: string
              p_due_date: string
              p_exchange_rate?: number
              p_lines: Json
              p_notes?: string
              p_organization_id?: string
              p_payment_terms?: number
              p_project_id?: string
              p_vendor_address?: string
              p_vendor_email?: string
              p_vendor_name: string
              p_vendor_phone?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_bill_date: string
              p_company_id: string
              p_contact_id?: string
              p_created_by?: string
              p_currency?: string
              p_due_date: string
              p_exchange_rate?: number
              p_lines: Json
              p_notes?: string
              p_organization_id?: string
              p_payment_terms?: number
              p_project_id?: string
              p_vendor_address?: string
              p_vendor_email?: string
              p_vendor_name: string
              p_vendor_phone?: string
            }
            Returns: string
          }
      create_booking_if_available: {
        Args: {
          p_buffer_after: string
          p_buffer_before: string
          p_daily_limit: number
          p_end_at: string
          p_event_type_id: string
          p_exclude_booking_id?: string
          p_host_timezone: string
          p_host_user_id: string
          p_invitee_email: string
          p_invitee_name: string
          p_invitee_notes: string
          p_invitee_phone: string
          p_invitee_timezone: string
          p_location: string
          p_meeting_url: string
          p_project_id: string
          p_requires_confirmation: boolean
          p_responses: Json
          p_start_at: string
          p_weekly_limit: number
        }
        Returns: string
      }
      create_collective_booking: {
        Args: {
          p_buffer_after: string
          p_buffer_before: string
          p_daily_limit: number
          p_end_at: string
          p_event_type_id: string
          p_host_timezone: string
          p_host_user_id: string
          p_invitee_email: string
          p_invitee_name: string
          p_invitee_notes: string
          p_invitee_phone: string
          p_invitee_timezone: string
          p_location: string
          p_meeting_url: string
          p_member_user_ids: string[]
          p_project_id: string
          p_requires_confirmation: boolean
          p_responses: Json
          p_start_at: string
          p_weekly_limit: number
        }
        Returns: string
      }
      create_invoice: {
        Args: {
          p_company_id: string
          p_contact_id?: string
          p_currency?: string
          p_customer_address?: string
          p_customer_email?: string
          p_customer_name: string
          p_customer_phone?: string
          p_due_date: string
          p_exchange_rate?: number
          p_footer?: string
          p_invoice_date: string
          p_lines: Json
          p_notes?: string
          p_organization_id?: string
          p_payment_terms?: number
          p_project_id?: string
        }
        Returns: string
      }
      create_invoice_with_links: {
        Args: {
          p_company_id: string
          p_contact_id?: string
          p_contract_id?: string
          p_currency?: string
          p_customer_address?: string
          p_customer_email?: string
          p_customer_name: string
          p_customer_phone?: string
          p_due_date: string
          p_exchange_rate?: number
          p_footer?: string
          p_invoice_date: string
          p_lines: Json
          p_notes?: string
          p_opportunity_id?: string
          p_organization_id?: string
          p_payment_terms?: number
          p_project_id?: string
        }
        Returns: string
      }
      create_journal_entry: {
        Args: {
          p_company_id: string
          p_entry_date: string
          p_lines?: Json
          p_memo?: string
          p_project_id?: string
          p_reference?: string
          p_source_id?: string
          p_source_type?: string
        }
        Returns: string
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
      create_round_robin_booking: {
        Args: {
          p_buffer_after: string
          p_buffer_before: string
          p_candidate_user_ids: string[]
          p_daily_limit: number
          p_end_at: string
          p_event_type_id: string
          p_host_timezone: string
          p_invitee_email: string
          p_invitee_name: string
          p_invitee_notes: string
          p_invitee_phone: string
          p_invitee_timezone: string
          p_location: string
          p_meeting_url: string
          p_project_id: string
          p_requires_confirmation: boolean
          p_responses: Json
          p_start_at: string
          p_weekly_limit: number
        }
        Returns: {
          assigned_user_id: string
          booking_id: string
        }[]
      }
      execute_custom_report: {
        Args: { p_config: Json; p_project_id: string }
        Returns: Json
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
      get_exchange_rate: {
        Args: {
          p_company_id: string
          p_date: string
          p_from_currency: string
          p_to_currency: string
        }
        Returns: number
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
      get_public_calendar_profile: {
        Args: { p_slug: string }
        Returns: {
          avatar_url: string
          bio: string
          booking_page_theme: Json
          display_name: string
          timezone: string
          welcome_message: string
        }[]
      }
      get_public_event_detail: {
        Args: { p_calendar_slug: string; p_event_slug: string }
        Returns: Json
      }
      get_public_event_types: {
        Args: { p_slug: string }
        Returns: {
          cancellation_policy: string
          color: string
          confirmation_message: string
          custom_questions: Json
          description: string
          duration_minutes: number
          id: string
          location_type: string
          location_value: string
          slug: string
          title: string
        }[]
      }
      get_public_events: { Args: { p_calendar_slug: string }; Returns: Json }
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
      get_workflows_for_trigger: {
        Args: { p_project_id: string; p_trigger_type: string }
        Returns: {
          current_version: number
          definition: Json
          id: string
          name: string
          trigger_config: Json
          trigger_type: string
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
      has_accounting_role: {
        Args: {
          company_id: string
          required_role: Database["public"]["Enums"]["accounting_role"]
        }
        Returns: boolean
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
      is_accounting_member: { Args: { company_id: string }; Returns: boolean }
      is_project_member: { Args: { project_id: string }; Returns: boolean }
      is_system_admin: { Args: never; Returns: boolean }
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
      log_workflow_execution: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_error_message?: string
          p_status: string
          p_trigger_event: Json
          p_workflow_id: string
          p_workflow_version: number
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
      perform_merge: {
        Args: {
          p_entity_type: string
          p_field_selections: Json
          p_merged_ids: string[]
          p_project_id: string
          p_survivor_id: string
          p_user_id: string
        }
        Returns: Json
      }
      projects_by_week: {
        Args: never
        Returns: {
          count: number
          week: string
        }[]
      }
      queue_webhook_delivery: {
        Args: { p_event_type: string; p_payload: Json; p_webhook_id: string }
        Returns: string
      }
      receive_bill: { Args: { p_bill_id: string }; Returns: string }
      recompute_quote_totals: {
        Args: { p_quote_id: string }
        Returns: undefined
      }
      record_bill_payment: {
        Args: {
          p_account_id: string
          p_amount: number
          p_bill_id: string
          p_notes?: string
          p_payment_date: string
          p_payment_method?: string
          p_reference?: string
        }
        Returns: string
      }
      record_invoice_payment: {
        Args: {
          p_account_id: string
          p_amount: number
          p_invoice_id: string
          p_notes?: string
          p_payment_date: string
          p_payment_method?: string
          p_reference?: string
        }
        Returns: string
      }
      register_for_event: {
        Args: {
          p_event_id: string
          p_ip_address: string
          p_registrant_email: string
          p_registrant_name: string
          p_registrant_phone: string
          p_responses: Json
          p_source: string
          p_ticket_selections: Json
          p_user_agent: string
        }
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
      replace_quote_line_items: {
        Args: { p_items?: Json; p_project_id: string; p_quote_id: string }
        Returns: undefined
      }
      scheduler_create_job: {
        Args: {
          p_body?: Json
          p_headers?: Json
          p_name: string
          p_schedule: string
          p_url: string
        }
        Returns: number
      }
      scheduler_delete_job: { Args: { p_name: string }; Returns: undefined }
      scheduler_job_history: {
        Args: { p_limit?: number; p_name: string }
        Returns: {
          end_time: string
          job_id: number
          return_message: string
          run_id: number
          start_time: string
          status: string
        }[]
      }
      scheduler_list_jobs: {
        Args: { p_prefix: string }
        Returns: {
          active: boolean
          command: string
          job_id: number
          job_name: string
          schedule: string
        }[]
      }
      scheduler_update_job: {
        Args: { p_active?: boolean; p_name: string; p_schedule?: string }
        Returns: undefined
      }
      seed_default_accounts: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      send_invoice: { Args: { p_invoice_id: string }; Returns: string }
      set_primary_quote: {
        Args: { p_project_id: string; p_quote_id: string }
        Returns: undefined
      }
      signups_by_week: {
        Args: never
        Returns: {
          count: number
          week: string
        }[]
      }
      update_draft_bill: {
        Args: { p_bill_id: string; p_lines?: Json; p_patch?: Json }
        Returns: string
      }
      update_draft_invoice: {
        Args: { p_invoice_id: string; p_lines?: Json; p_patch?: Json }
        Returns: string
      }
      update_draft_journal_entry: {
        Args: { p_entry_id: string; p_lines?: Json; p_patch?: Json }
        Returns: string
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
      upsert_rate_limit: {
        Args: { p_key: string; p_window_start: string }
        Returns: number
      }
      validate_custom_field: {
        Args: {
          p_field_def: Database["public"]["Tables"]["custom_field_definitions"]["Row"]
          p_value: Json
        }
        Returns: boolean
      }
      void_bill: { Args: { p_bill_id: string }; Returns: string }
      void_invoice: { Args: { p_invoice_id: string }; Returns: string }
      void_journal_entry: { Args: { p_entry_id: string }; Returns: string }
    }
    Enums: {
      accounting_role: "owner" | "admin" | "member" | "viewer"
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
      project_role:
        | "owner"
        | "admin"
        | "member"
        | "viewer"
        | "staff"
        | "case_manager"
        | "contractor"
        | "board_viewer"
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      accounting_role: ["owner", "admin", "member", "viewer"],
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
      project_role: [
        "owner",
        "admin",
        "member",
        "viewer",
        "staff",
        "case_manager",
        "contractor",
        "board_viewer",
      ],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired"],
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

