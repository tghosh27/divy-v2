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
      activity_events: {
        Row: {
          amount: number | null
          created_at: string
          group_id: string | null
          id: string
          kind: string
          profile_id: string
          text: string
          unread: boolean
          who: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          profile_id: string
          text?: string
          unread?: boolean
          who?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          profile_id?: string
          text?: string
          unread?: boolean
          who?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          group_id: string
          id: string
          member_id: string | null
          occurred_on: string
          request_id: string | null
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          group_id: string
          id?: string
          member_id?: string | null
          occurred_on?: string
          request_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
          member_id?: string | null
          occurred_on?: string
          request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "funding_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          expense_id: string | null
          group_id: string
          id: string
          raised_by: string
          raised_name: string
          reason: string
          resolution: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expense_id?: string | null
          group_id: string
          id?: string
          raised_by: string
          raised_name?: string
          reason?: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expense_id?: string | null
          group_id?: string
          id?: string
          raised_by?: string
          raised_name?: string
          reason?: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          added_by: string | null
          category: string
          claim_status: string | null
          created_at: string
          each_amount: number
          group_id: string
          id: string
          items: Json | null
          paid: boolean
          payer_member_id: string | null
          receipt_key: string | null
          recur_freq: string | null
          recur_next: string | null
          recur_parent: string | null
          shares: Json | null
          spent_on: string
          title: string
          total: number
        }
        Insert: {
          added_by?: string | null
          category?: string
          claim_status?: string | null
          created_at?: string
          each_amount?: number
          group_id: string
          id?: string
          items?: Json | null
          paid?: boolean
          payer_member_id?: string | null
          receipt_key?: string | null
          recur_freq?: string | null
          recur_next?: string | null
          recur_parent?: string | null
          shares?: Json | null
          spent_on?: string
          title: string
          total?: number
        }
        Update: {
          added_by?: string | null
          category?: string
          claim_status?: string | null
          created_at?: string
          each_amount?: number
          group_id?: string
          id?: string
          items?: Json | null
          paid?: boolean
          payer_member_id?: string | null
          receipt_key?: string | null
          recur_freq?: string | null
          recur_next?: string | null
          recur_parent?: string | null
          shares?: Json | null
          spent_on?: string
          title?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payer_member_id_fkey"
            columns: ["payer_member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_requests: {
        Row: {
          amount: number
          audience: string
          collected: number
          created_at: string
          due_on: string | null
          goal: number
          group_id: string
          id: string
          title: string
        }
        Insert: {
          amount?: number
          audience?: string
          collected?: number
          created_at?: string
          due_on?: string | null
          goal?: number
          group_id: string
          id?: string
          title: string
        }
        Update: {
          amount?: number
          audience?: string
          collected?: number
          created_at?: string
          due_on?: string | null
          goal?: number
          group_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          avatar_key: string
          balance: number
          created_at: string
          display_name: string
          dues_paid: boolean
          group_id: string
          handle: string | null
          id: string
          is_admin: boolean
          last_reminded_at: string | null
          profile_id: string | null
        }
        Insert: {
          avatar_key?: string
          balance?: number
          created_at?: string
          display_name: string
          dues_paid?: boolean
          group_id: string
          handle?: string | null
          id?: string
          is_admin?: boolean
          last_reminded_at?: string | null
          profile_id?: string | null
        }
        Update: {
          avatar_key?: string
          balance?: number
          created_at?: string
          display_name?: string
          dues_paid?: boolean
          group_id?: string
          handle?: string | null
          id?: string
          is_admin?: boolean
          last_reminded_at?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          archived: boolean
          confirm_days: number
          cover_key: string
          created_at: string
          cycle_end: string
          cycle_label: string
          cycle_start: string
          cycle_state: string
          id: string
          join_code: string
          kind: string
          multicurrency: boolean
          name: string
          owner_id: string
          payment_due: string | null
          payment_opens: string | null
          progress: number
          purpose: string | null
          settle_anchor: string | null
          settle_frequency: string | null
          settle_mode: string
        }
        Insert: {
          archived?: boolean
          confirm_days?: number
          cover_key?: string
          created_at?: string
          cycle_end?: string
          cycle_label?: string
          cycle_start?: string
          cycle_state?: string
          id?: string
          join_code?: string
          kind?: string
          multicurrency?: boolean
          name: string
          owner_id: string
          payment_due?: string | null
          payment_opens?: string | null
          progress?: number
          purpose?: string | null
          settle_anchor?: string | null
          settle_frequency?: string | null
          settle_mode?: string
        }
        Update: {
          archived?: boolean
          confirm_days?: number
          cover_key?: string
          created_at?: string
          cycle_end?: string
          cycle_label?: string
          cycle_start?: string
          cycle_state?: string
          id?: string
          join_code?: string
          kind?: string
          multicurrency?: boolean
          name?: string
          owner_id?: string
          payment_due?: string | null
          payment_opens?: string | null
          progress?: number
          purpose?: string | null
          settle_anchor?: string | null
          settle_frequency?: string | null
          settle_mode?: string
        }
        Relationships: []
      }
      linked_accounts: {
        Row: {
          created_at: string
          detail: string
          id: string
          is_primary: boolean
          kind: string
          name: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: string
          is_primary?: boolean
          kind?: string
          name: string
          profile_id: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          is_primary?: boolean
          kind?: string
          name?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linked_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          profile_id: string
          title: string
          tone: string
          unread: boolean
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          profile_id: string
          title: string
          tone?: string
          unread?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          profile_id?: string
          title?: string
          tone?: string
          unread?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string
          created_at: string
          handle: string | null
          id: string
          name: string
          onboarded: boolean
          score: number
        }
        Insert: {
          avatar_key?: string
          created_at?: string
          handle?: string | null
          id: string
          name?: string
          onboarded?: boolean
          score?: number
        }
        Update: {
          avatar_key?: string
          created_at?: string
          handle?: string | null
          id?: string
          name?: string
          onboarded?: boolean
          score?: number
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount: number
          created_at: string
          group_id: string | null
          id: string
          kind: string
          profile_id: string
          source: string
        }
        Insert: {
          amount?: number
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          profile_id: string
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          profile_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          name: string
          note: string
          occurred_on: string
          profile_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          name: string
          note?: string
          occurred_on?: string
          profile_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          name?: string
          note?: string
          occurred_on?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available: number
          pending: number
          profile_id: string
        }
        Insert: {
          available?: number
          pending?: number
          profile_id: string
        }
        Update: {
          available?: number
          pending?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_group_member: {
        Args: { _group_id: string; _uid: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
