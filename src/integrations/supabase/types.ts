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
      business_accounts: {
        Row: {
          created_at: string
          handle: string | null
          id: string
          kind: string
          notes: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          handle?: string | null
          id?: string
          kind: string
          notes?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          handle?: string | null
          id?: string
          kind?: string
          notes?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      business_knowledge_entries: {
        Row: {
          body: string
          created_at: string
          id: string
          source: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          source?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          source?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_profile: {
        Row: {
          created_at: string
          description: string | null
          extra: Json | null
          industry: string | null
          name: string | null
          onboarding_completed_at: string | null
          primary_goal: string | null
          tagline: string | null
          target_audience: string | null
          tone: string | null
          updated_at: string
          user_id: string
          value_props: string[] | null
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra?: Json | null
          industry?: string | null
          name?: string | null
          onboarding_completed_at?: string | null
          primary_goal?: string | null
          tagline?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
          value_props?: string[] | null
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          extra?: Json | null
          industry?: string | null
          name?: string | null
          onboarding_completed_at?: string | null
          primary_goal?: string | null
          tagline?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
          value_props?: string[] | null
          website?: string | null
        }
        Relationships: []
      }
      business_team_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          id: string
          invite_token: string | null
          invited_at: string | null
          member_user_id: string | null
          name: string
          notes: string | null
          permissions: string[]
          phone: string | null
          role: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          member_user_id?: string | null
          name: string
          notes?: string | null
          permissions?: string[]
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          member_user_id?: string | null
          name?: string
          notes?: string | null
          permissions?: string[]
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      composio_connections: {
        Row: {
          connected_account_id: string | null
          created_at: string
          id: string
          redirect_url: string | null
          status: string
          toolkit_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_account_id?: string | null
          created_at?: string
          id?: string
          redirect_url?: string | null
          status?: string
          toolkit_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_account_id?: string | null
          created_at?: string
          id?: string
          redirect_url?: string | null
          status?: string
          toolkit_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          agent_id: string | null
          amount: number
          complexity: string | null
          created_at: string
          id: string
          kind: string
          meta: Json
          model: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          amount: number
          complexity?: string | null
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          model?: string | null
          thread_id?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          amount?: number
          complexity?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          model?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_grants: {
        Row: {
          grant_date: string
          user_id: string
        }
        Insert: {
          grant_date: string
          user_id: string
        }
        Update: {
          grant_date?: string
          user_id?: string
        }
        Relationships: []
      }
      instagram_pending_replies: {
        Row: {
          created_at: string
          error_subcode: number | null
          id: string
          last_error: string | null
          message_text: string
          next_retry_at: string | null
          raw_error: Json | null
          recipient_id: string
          reopened_at: string | null
          sent_at: string | null
          status: string
          tool_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_subcode?: number | null
          id?: string
          last_error?: string | null
          message_text: string
          next_retry_at?: string | null
          raw_error?: Json | null
          recipient_id: string
          reopened_at?: string | null
          sent_at?: string | null
          status?: string
          tool_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_subcode?: number | null
          id?: string
          last_error?: string | null
          message_text?: string
          next_retry_at?: string | null
          raw_error?: Json | null
          recipient_id?: string
          reopened_at?: string | null
          sent_at?: string | null
          status?: string
          tool_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_staff: boolean
          sender_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          created_at: string
          dodo_subscription_id: string | null
          monthly_credits: number
          renews_at: string | null
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dodo_subscription_id?: string | null
          monthly_credits?: number
          renews_at?: string | null
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dodo_subscription_id?: string | null
          monthly_credits?: number
          renews_at?: string | null
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sites: {
        Row: {
          created_at: string
          deployment_url: string | null
          files: Json
          id: string
          last_error: string | null
          name: string
          prompt: string
          status: string
          style_notes: string | null
          updated_at: string
          user_id: string
          vercel_project_id: string | null
        }
        Insert: {
          created_at?: string
          deployment_url?: string | null
          files?: Json
          id?: string
          last_error?: string | null
          name: string
          prompt: string
          status?: string
          style_notes?: string | null
          updated_at?: string
          user_id: string
          vercel_project_id?: string | null
        }
        Update: {
          created_at?: string
          deployment_url?: string | null
          files?: Json
          id?: string
          last_error?: string | null
          name?: string
          prompt?: string
          status?: string
          style_notes?: string | null
          updated_at?: string
          user_id?: string
          vercel_project_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_credit_balance: { Args: { uid: string }; Returns: number }
      grant_daily_free_credits: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      plan_tier: "free" | "pro" | "everest"
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
      app_role: ["admin", "moderator", "user"],
      plan_tier: ["free", "pro", "everest"],
    },
  },
} as const
