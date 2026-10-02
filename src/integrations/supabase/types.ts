export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      items: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          is_hidden: boolean;
          kind: Database["public"]["Enums"]["item_kind"];
          location: string;
          occurred_at: string | null;
          photo_url: string | null;
          reporter_id: string;
          reporter_name: string | null;
          reporter_role: Database["public"]["Enums"]["campus_role"] | null;
          status: Database["public"]["Enums"]["item_status"];
          title: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_hidden?: boolean;
          kind: Database["public"]["Enums"]["item_kind"];
          location: string;
          occurred_at?: string | null;
          photo_url?: string | null;
          reporter_id?: string;
          reporter_name?: string | null;
          reporter_role?: Database["public"]["Enums"]["campus_role"] | null;
          status?: Database["public"]["Enums"]["item_status"];
          title: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_hidden?: boolean;
          kind?: Database["public"]["Enums"]["item_kind"];
          location?: string;
          occurred_at?: string | null;
          photo_url?: string | null;
          reporter_id?: string;
          reporter_name?: string | null;
          reporter_role?: Database["public"]["Enums"]["campus_role"] | null;
          status?: Database["public"]["Enums"]["item_status"];
          title?: string;
        };
        Relationships: [];
      };
      campus_staff: {
        Row: {
          access_level: Database["public"]["Enums"]["staff_access"];
          created_at: string;
          user_id: string;
        };
        Insert: {
          access_level?: Database["public"]["Enums"]["staff_access"];
          created_at?: string;
          user_id: string;
        };
        Update: {
          access_level?: Database["public"]["Enums"]["staff_access"];
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      claims: {
        Row: {
          claimant_id: string;
          created_at: string;
          id: string;
          item_id: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewer_id: string | null;
          status: Database["public"]["Enums"]["claim_status"];
          verification_details: string;
        };
        Insert: {
          claimant_id: string;
          created_at?: string;
          id?: string;
          item_id: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: Database["public"]["Enums"]["claim_status"];
          verification_details: string;
        };
        Update: {
          claimant_id?: string;
          created_at?: string;
          id?: string;
          item_id?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: Database["public"]["Enums"]["claim_status"];
          verification_details?: string;
        };
        Relationships: [];
      };
      contact_requests: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          message: string;
          requester_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          message: string;
          requester_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          message?: string;
          requester_id?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          author_id: string;
          claim_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
        };
        Insert: {
          author_id: string;
          claim_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
        };
        Update: {
          author_id?: string;
          claim_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating?: number;
        };
        Relationships: [];
      };
      handovers: {
        Row: {
          claimant_confirmed: boolean;
          claim_id: string;
          completed_at: string | null;
          evidence: string | null;
          finder_confirmed: boolean;
          staff_confirmed: boolean;
          started_at: string;
        };
        Insert: {
          claimant_confirmed?: boolean;
          claim_id: string;
          completed_at?: string | null;
          evidence?: string | null;
          finder_confirmed?: boolean;
          staff_confirmed?: boolean;
          started_at?: string;
        };
        Update: {
          claimant_confirmed?: boolean;
          claim_id?: string;
          completed_at?: string | null;
          evidence?: string | null;
          finder_confirmed?: boolean;
          staff_confirmed?: boolean;
          started_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          claim_id: string | null;
          created_at: string;
          id: string;
          item_id: string | null;
          kind: string;
          read_at: string | null;
          recipient_id: string;
        };
        Insert: {
          claim_id?: string | null;
          created_at?: string;
          id?: string;
          item_id?: string | null;
          kind: string;
          read_at?: string | null;
          recipient_id: string;
        };
        Update: {
          claim_id?: string | null;
          created_at?: string;
          id?: string;
          item_id?: string | null;
          kind?: string;
          read_at?: string | null;
          recipient_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          campus_role: Database["public"]["Enums"]["campus_role"];
          college_email: string;
          created_at: string;
          full_name: string;
          id: string;
        };
        Insert: {
          campus_role?: Database["public"]["Enums"]["campus_role"];
          college_email: string;
          created_at?: string;
          full_name: string;
          id: string;
        };
        Update: {
          campus_role?: Database["public"]["Enums"]["campus_role"];
          college_email?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_handover: { Args: { p_claim_id: string }; Returns: undefined };
      confirm_handover: { Args: { p_claim_id: string }; Returns: undefined };
      is_campus_admin: { Args: Record<string, never>; Returns: boolean };
      is_campus_staff: { Args: Record<string, never>; Returns: boolean };
      is_item_reporter: { Args: { p_item_id: string }; Returns: boolean };
      moderate_item: { Args: { p_hidden: boolean; p_item_id: string }; Returns: undefined };
      get_my_items: {
        Args: Record<string, never>;
        Returns: {
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          is_hidden: boolean;
          kind: Database["public"]["Enums"]["item_kind"];
          location: string;
          occurred_at: string | null;
          photo_url: string | null;
          reporter_name: string | null;
          reporter_role: Database["public"]["Enums"]["campus_role"] | null;
          status: Database["public"]["Enums"]["item_status"];
          title: string;
        }[];
      };
      review_claim: {
        Args: { p_approved: boolean; p_claim_id: string; p_note?: string | null };
        Returns: undefined;
      };
      save_handover_evidence: {
        Args: { p_claim_id: string; p_evidence: string };
        Returns: undefined;
      };
      save_profile_name: { Args: { p_full_name: string }; Returns: undefined };
    };
    Enums: {
      campus_role: "student" | "teacher" | "security" | "cleaning_staff" | "other_staff";
      item_kind: "lost" | "found";
      item_status: "open" | "claimed" | "returned";
      claim_status: "pending" | "approved" | "rejected" | "handover_pending" | "returned";
      staff_access: "staff" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      campus_role: ["student", "teacher", "security", "cleaning_staff", "other_staff"],
      item_kind: ["lost", "found"],
      item_status: ["open", "claimed", "returned"],
      claim_status: ["pending", "approved", "rejected", "handover_pending", "returned"],
      staff_access: ["staff", "admin"],
    },
  },
} as const;
