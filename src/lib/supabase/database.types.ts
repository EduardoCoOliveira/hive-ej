/**
 * Tipos gerados do esquema Supabase.
 * Para regenerar: npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
 */

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan_tier: "free" | "premium" | "internal";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string | null;
          avatar_url: string | null;
          email: string | null;
          rank: "trainee" | "assessor" | "project_leader" | "dept_leader" | "director" | "president";
          department: string | null;
          discord_id: string | null;
          google_calendar_id: string | null;
          skills: string[];
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      projects: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string | null;
          client_name: string | null;
          client_email: string | null;
          client_context: string | null;
          description: string | null;
          status: "prospecting" | "active" | "paused" | "completed" | "cancelled";
          value: number | null;
          estimated_hours: number | null;
          start_date: string | null;
          end_date: string | null;
          leader_id: string | null;
          enabled_integrations: Record<string, boolean> | null;
          external_ids: Record<string, string> | null;
          hive_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
      };
      project_allocations: {
        Row: {
          id: string;
          project_id: string;
          member_id: string;
          role: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["project_allocations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["project_allocations"]["Row"]>;
      };
      org_integrations: {
        Row: {
          id: string;
          org_id: string;
          provider: string;
          access_token: Uint8Array;
          refresh_token: Uint8Array | null;
          expires_at: string | null;
          scopes: string[];
          workspace_name: string | null;
          connected_by: string | null;
          connected_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["org_integrations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["org_integrations"]["Row"]>;
      };
      point_transactions: {
        Row: {
          id: string;
          member_id: string;
          organization_id: string;
          points: number;
          reason: string;
          reference_type: string | null;
          reference_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["point_transactions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["point_transactions"]["Row"]>;
      };
      member_badges: {
        Row: {
          id: string;
          member_id: string;
          organization_id: string;
          badge_type: string;
          category: string | null;
          awarded_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["member_badges"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["member_badges"]["Row"]>;
      };
      member_task_stats: {
        Row: {
          id: string;
          member_id: string;
          organization_id: string;
          skill_category: string;
          task_count: number;
          last_task_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["member_task_stats"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["member_task_stats"]["Row"]>;
      };
      discord_sentiment_log: {
        Row: {
          id: string;
          project_id: string;
          channel_id: string;
          sentiment: "positive" | "neutral" | "concerned" | "negative";
          score: number;
          summary: string | null;
          alert_sent: boolean;
          analyzed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["discord_sentiment_log"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["discord_sentiment_log"]["Row"]>;
      };
      playbooks: {
        Row: {
          id: string;
          project_id: string;
          step: string;
          guide: Record<string, unknown>;
          generated_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["playbooks"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["playbooks"]["Row"]>;
      };
      atomic_initiation_log: {
        Row: {
          id: string;
          project_id: string;
          steps: Record<string, unknown>;
          triggered_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["atomic_initiation_log"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["atomic_initiation_log"]["Row"]>;
      };
      kpi_records: {
        Row: {
          id: string;
          organization_id: string;
          period: string;
          active_projects: number | null;
          completed_projects: number | null;
          total_revenue: number | null;
          avg_hive_score: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kpi_records"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["kpi_records"]["Row"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
      };
    };
    Views: {
      member_point_balances: {
        Row: {
          member_id: string;
          organization_id: string;
          total_points: number;
          positive_points: number;
          negative_points: number;
        };
      };
    };
    Functions: {
      award_points: {
        Args: {
          p_member_id: string;
          p_organization_id: string;
          p_points: number;
          p_reason: string;
          p_reference_type?: string;
          p_reference_id?: string;
        };
        Returns: void;
      };
      increment_member_task_count: {
        Args: {
          p_member_id: string;
          p_organization_id: string;
          p_skill_category: string;
        };
        Returns: number;
      };
    };
    Enums: {
      member_rank: "trainee" | "assessor" | "project_leader" | "dept_leader" | "director" | "president";
      project_status: "prospecting" | "active" | "paused" | "completed" | "cancelled";
    };
  };
};
