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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      atomic_initiation_log: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          id: string
          org_id: string
          project_id: string
          result: Json | null
          status: string
          step: string
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          org_id: string
          project_id: string
          result?: Json | null
          status: string
          step: string
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          org_id?: string
          project_id?: string
          result?: Json | null
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "atomic_initiation_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "atomic_initiation_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atomic_initiation_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_role_channels: {
        Row: {
          channel_id: string
          channel_name: string | null
          department: string | null
          id: string
          organization_id: string
          rank: string
        }
        Insert: {
          channel_id: string
          channel_name?: string | null
          department?: string | null
          id?: string
          organization_id: string
          rank: string
        }
        Update: {
          channel_id?: string
          channel_name?: string | null
          department?: string | null
          id?: string
          organization_id?: string
          rank?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_role_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "discord_role_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_sentiment_log: {
        Row: {
          analyzed_at: string | null
          channel_id: string
          id: string
          org_id: string
          project_id: string | null
          reasoning: string | null
          score: number
          sentiment: string
          suggested_action: string | null
        }
        Insert: {
          analyzed_at?: string | null
          channel_id: string
          id?: string
          org_id: string
          project_id?: string | null
          reasoning?: string | null
          score: number
          sentiment: string
          suggested_action?: string | null
        }
        Update: {
          analyzed_at?: string | null
          channel_id?: string
          id?: string
          org_id?: string
          project_id?: string | null
          reasoning?: string | null
          score?: number
          sentiment?: string
          suggested_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discord_sentiment_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "discord_sentiment_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discord_sentiment_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string
          id: string
          organization_id: string
          pdf_url: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          template_data: Json
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          pdf_url?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          template_data?: Json
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          pdf_url?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          template_data?: Json
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          ai_extraction: Json | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string
          currency: string | null
          date: string | null
          description: string | null
          discord_message_id: string | null
          drive_file_id: string | null
          expense_date: string | null
          id: string
          member_id: string | null
          organization_id: string
          project_id: string | null
          receipt_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sheets_row: number | null
          status: string | null
          submitted_by: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          ai_extraction?: Json | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string | null
          date?: string | null
          description?: string | null
          discord_message_id?: string | null
          drive_file_id?: string | null
          expense_date?: string | null
          id?: string
          member_id?: string | null
          organization_id: string
          project_id?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sheets_row?: number | null
          status?: string | null
          submitted_by: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          ai_extraction?: Json | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string | null
          date?: string | null
          description?: string | null
          discord_message_id?: string | null
          drive_file_id?: string | null
          expense_date?: string | null
          id?: string
          member_id?: string | null
          organization_id?: string
          project_id?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sheets_row?: number | null
          status?: string | null
          submitted_by?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_roadmap: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          eta_quarter: string | null
          icon_url: string | null
          id: string
          provider: string
          status: string
          vote_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          eta_quarter?: string | null
          icon_url?: string | null
          id?: string
          provider: string
          status?: string
          vote_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          eta_quarter?: string | null
          icon_url?: string | null
          id?: string
          provider?: string
          status?: string
          vote_count?: number
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token_enc: string
          connected_at: string
          connected_by: string
          external_workspace_id: string | null
          id: string
          is_active: boolean
          organization_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_enc: string | null
          token_expires_at: string | null
        }
        Insert: {
          access_token_enc: string
          connected_at?: string
          connected_by: string
          external_workspace_id?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_enc?: string | null
          token_expires_at?: string | null
        }
        Update: {
          access_token_enc?: string
          connected_at?: string
          connected_by?: string
          external_workspace_id?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          refresh_token_enc?: string | null
          token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_records: {
        Row: {
          active_members: number
          id: string
          nps_average: number | null
          organization_id: string
          period: string
          projects_count: number
          recorded_at: string
          revenue: number
          satisfaction_rate: number | null
        }
        Insert: {
          active_members?: number
          id?: string
          nps_average?: number | null
          organization_id: string
          period: string
          projects_count?: number
          recorded_at?: string
          revenue?: number
          satisfaction_rate?: number | null
        }
        Update: {
          active_members?: number
          id?: string
          nps_average?: number | null
          organization_id?: string
          period?: string
          projects_count?: number
          recorded_at?: string
          revenue?: number
          satisfaction_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "kpi_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          action_items: Json | null
          audio_url: string | null
          created_at: string
          created_by: string | null
          decisions: Json | null
          discord_sent: boolean | null
          doc_id: string | null
          doc_url: string | null
          duration_minutes: number | null
          email_sent: boolean | null
          id: string
          meeting_date: string
          meeting_date_text: string | null
          next_steps: string | null
          organization_id: string
          participants: string[] | null
          processing_steps: Json | null
          project_id: string | null
          summary: string | null
          title: string
          transcript: string | null
          uploaded_by: string | null
        }
        Insert: {
          action_items?: Json | null
          audio_url?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: Json | null
          discord_sent?: boolean | null
          doc_id?: string | null
          doc_url?: string | null
          duration_minutes?: number | null
          email_sent?: boolean | null
          id?: string
          meeting_date: string
          meeting_date_text?: string | null
          next_steps?: string | null
          organization_id: string
          participants?: string[] | null
          processing_steps?: Json | null
          project_id?: string | null
          summary?: string | null
          title: string
          transcript?: string | null
          uploaded_by?: string | null
        }
        Update: {
          action_items?: Json | null
          audio_url?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: Json | null
          discord_sent?: boolean | null
          doc_id?: string | null
          doc_url?: string | null
          duration_minutes?: number | null
          email_sent?: boolean | null
          id?: string
          meeting_date?: string
          meeting_date_text?: string | null
          next_steps?: string | null
          organization_id?: string
          participants?: string[] | null
          processing_steps?: Json | null
          project_id?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "meeting_minutes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      member_badges: {
        Row: {
          badge_name: string
          category: string
          earned_at: string | null
          id: string
          member_id: string
          org_id: string
          task_count: number
        }
        Insert: {
          badge_name: string
          category: string
          earned_at?: string | null
          id?: string
          member_id: string
          org_id: string
          task_count?: number
        }
        Update: {
          badge_name?: string
          category?: string
          earned_at?: string | null
          id?: string
          member_id?: string
          org_id?: string
          task_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_badges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_badges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "member_badges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_offboarding_log: {
        Row: {
          canva_removed: boolean | null
          clickup_removed: boolean | null
          completed_at: string
          discord_removed: boolean | null
          figma_removed: boolean | null
          google_suspended: boolean | null
          id: string
          member_email: string | null
          member_id: string
          member_name: string | null
          notion_removed: boolean | null
          organization_id: string
          reason: string | null
          steps: Json | null
          triggered_by: string | null
        }
        Insert: {
          canva_removed?: boolean | null
          clickup_removed?: boolean | null
          completed_at?: string
          discord_removed?: boolean | null
          figma_removed?: boolean | null
          google_suspended?: boolean | null
          id?: string
          member_email?: string | null
          member_id: string
          member_name?: string | null
          notion_removed?: boolean | null
          organization_id: string
          reason?: string | null
          steps?: Json | null
          triggered_by?: string | null
        }
        Update: {
          canva_removed?: boolean | null
          clickup_removed?: boolean | null
          completed_at?: string
          discord_removed?: boolean | null
          figma_removed?: boolean | null
          google_suspended?: boolean | null
          id?: string
          member_email?: string | null
          member_id?: string
          member_name?: string | null
          notion_removed?: boolean | null
          organization_id?: string
          reason?: string | null
          steps?: Json | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_offboarding_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "member_offboarding_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_skills: {
        Row: {
          id: string
          level: number
          skill_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          level: number
          skill_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          level?: number
          skill_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_task_stats: {
        Row: {
          category: string
          count: number
          early_count: number
          id: string
          member_id: string
          on_time_count: number
          org_id: string
          updated_at: string | null
        }
        Insert: {
          category: string
          count?: number
          early_count?: number
          id?: string
          member_id: string
          on_time_count?: number
          org_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          count?: number
          early_count?: number
          id?: string
          member_id?: string
          on_time_count?: number
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_task_stats_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_task_stats_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "member_task_stats_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          discord_channel_name: string | null
          discord_enabled: boolean
          notify_new_member: boolean
          notify_payment_failed: boolean
          notify_project_activated: boolean
          notify_project_completed: boolean
          notify_project_created: boolean
          organization_id: string
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          discord_channel_name?: string | null
          discord_enabled?: boolean
          notify_new_member?: boolean
          notify_payment_failed?: boolean
          notify_project_activated?: boolean
          notify_project_completed?: boolean
          notify_project_created?: boolean
          organization_id: string
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          discord_channel_name?: string | null
          discord_enabled?: boolean
          notify_new_member?: boolean
          notify_payment_failed?: boolean
          notify_project_activated?: boolean
          notify_project_completed?: boolean
          notify_project_created?: boolean
          organization_id?: string
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "notification_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_integrations: {
        Row: {
          access_token: string
          connected_at: string
          connected_by: string | null
          expires_at: string | null
          id: string
          org_id: string
          provider: string
          refresh_token: string | null
          scopes: string[] | null
          updated_at: string
          workspace_name: string | null
        }
        Insert: {
          access_token: string
          connected_at?: string
          connected_by?: string | null
          expires_at?: string | null
          id?: string
          org_id: string
          provider: string
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string
          workspace_name?: string | null
        }
        Update: {
          access_token?: string
          connected_at?: string
          connected_by?: string | null
          expires_at?: string | null
          id?: string
          org_id?: string
          provider?: string
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          discord_guild_id: string | null
          email_domain: string | null
          finance_drive_folder_id: string | null
          finance_sheet_id: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          discord_guild_id?: string | null
          email_domain?: string | null
          finance_drive_folder_id?: string | null
          finance_sheet_id?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          discord_guild_id?: string | null
          email_domain?: string | null
          finance_drive_folder_id?: string | null
          finance_sheet_id?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      playbooks: {
        Row: {
          content: Json
          created_at: string | null
          generated_by: string | null
          id: string
          is_customized: boolean | null
          org_id: string
          project_id: string | null
          step: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          generated_by?: string | null
          id?: string
          is_customized?: boolean | null
          org_id: string
          project_id?: string | null
          step: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          generated_by?: string | null
          id?: string
          is_customized?: boolean | null
          org_id?: string
          project_id?: string | null
          step?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "playbooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      point_rules: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "point_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          amount: number
          awarded_by: string | null
          created_at: string | null
          id: string
          org_id: string
          project_id: string | null
          reason: string
          source_event: string
          user_id: string
        }
        Insert: {
          amount: number
          awarded_by?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          project_id?: string | null
          reason: string
          source_event: string
          user_id: string
        }
        Update: {
          amount?: number
          awarded_by?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          project_id?: string | null
          reason?: string
          source_event?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "point_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department: string | null
          discord_id: string | null
          full_name: string
          google_calendar_id: string | null
          id: string
          is_active: boolean
          joined_at: string | null
          organization_id: string
          rank: Database["public"]["Enums"]["member_rank"]
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          discord_id?: string | null
          full_name: string
          google_calendar_id?: string | null
          id: string
          is_active?: boolean
          joined_at?: string | null
          organization_id: string
          rank?: Database["public"]["Enums"]["member_rank"]
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          discord_id?: string | null
          full_name?: string
          google_calendar_id?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string | null
          organization_id?: string
          rank?: Database["public"]["Enums"]["member_rank"]
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_allocations: {
        Row: {
          created_at: string
          end_date: string | null
          hours_per_week: number
          id: string
          project_id: string
          role_in_project: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          hours_per_week?: number
          id?: string
          project_id: string
          role_in_project: string
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          hours_per_week?: number
          id?: string
          project_id?: string
          role_in_project?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_context: string | null
          client_name: string
          created_at: string
          created_by: string
          description: string | null
          discord_channel_id: string | null
          enabled_integrations: Json | null
          end_date: string | null
          estimated_hours: number | null
          external_ids: Json | null
          id: string
          leader_id: string | null
          name: string
          nps_score: number | null
          organization_id: string
          slug: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          value: number
        }
        Insert: {
          client_context?: string | null
          client_name: string
          created_at?: string
          created_by: string
          description?: string | null
          discord_channel_id?: string | null
          enabled_integrations?: Json | null
          end_date?: string | null
          estimated_hours?: number | null
          external_ids?: Json | null
          id?: string
          leader_id?: string | null
          name: string
          nps_score?: number | null
          organization_id: string
          slug?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          value?: number
        }
        Update: {
          client_context?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          description?: string | null
          discord_channel_id?: string | null
          enabled_integrations?: Json | null
          end_date?: string | null
          estimated_hours?: number | null
          external_ids?: Json | null
          id?: string
          leader_id?: string | null
          name?: string
          nps_score?: number | null
          organization_id?: string
          slug?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: Database["public"]["Enums"]["skill_category"]
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["skill_category"]
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["skill_category"]
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      wiki_articles: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_archived: boolean
          organization_id: string
          role_tag: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          organization_id: string
          role_tag?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          organization_id?: string
          role_tag?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_articles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "wiki_articles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_summary: {
        Row: {
          active_members: number | null
          active_projects: number | null
          completed_projects: number | null
          connected_integrations: number | null
          current_month_nps: number | null
          current_month_revenue: number | null
          org_id: string | null
          org_name: string | null
          plan_tier: Database["public"]["Enums"]["plan_tier"] | null
        }
        Relationships: []
      }
      member_point_balances: {
        Row: {
          avatar_url: string | null
          department: string | null
          full_name: string | null
          org_id: string | null
          rank: Database["public"]["Enums"]["member_rank"] | null
          total_awarded: number | null
          total_deducted: number | null
          total_points: number | null
          transaction_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "dashboard_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "point_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      award_points: {
        Args: {
          p_amount: number
          p_awarded_by?: string
          p_org_id: string
          p_project_id?: string
          p_reason: string
          p_source_event: string
          p_user_id: string
        }
        Returns: undefined
      }
      current_org_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      increment_kpi_revenue: {
        Args: { p_amount: number; p_org_id: string; p_period: string }
        Returns: undefined
      }
      increment_member_task_count: {
        Args: {
          p_category: string
          p_early: boolean
          p_member_id: string
          p_on_time: boolean
          p_org_id: string
        }
        Returns: undefined
      }
      upsert_kpi_nps: {
        Args: { p_nps_score: number; p_org_id: string; p_period: string }
        Returns: undefined
      }
    }
    Enums: {
      document_status: "draft" | "sent" | "signed" | "cancelled"
      document_type: "contract" | "proposal" | "nda" | "other"
      integration_provider:
        | "google"
        | "clickup"
        | "notion"
        | "discord"
        | "canva"
        | "figma"
      member_rank:
        | "trainee"
        | "assessor"
        | "project_leader"
        | "dept_leader"
        | "director"
        | "president"
      plan_tier: "free" | "premium" | "internal"
      project_status:
        | "prospecting"
        | "proposal"
        | "negotiation"
        | "active"
        | "completed"
        | "cancelled"
      skill_category:
        | "tech"
        | "design"
        | "marketing"
        | "finance"
        | "management"
        | "communication"
        | "other"
      user_role: "owner" | "admin" | "member" | "viewer"
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
      document_status: ["draft", "sent", "signed", "cancelled"],
      document_type: ["contract", "proposal", "nda", "other"],
      integration_provider: [
        "google",
        "clickup",
        "notion",
        "discord",
        "canva",
        "figma",
      ],
      member_rank: [
        "trainee",
        "assessor",
        "project_leader",
        "dept_leader",
        "director",
        "president",
      ],
      plan_tier: ["free", "premium", "internal"],
      project_status: [
        "prospecting",
        "proposal",
        "negotiation",
        "active",
        "completed",
        "cancelled",
      ],
      skill_category: [
        "tech",
        "design",
        "marketing",
        "finance",
        "management",
        "communication",
        "other",
      ],
      user_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
