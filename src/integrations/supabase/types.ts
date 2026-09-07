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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      campaign_activities: {
        Row: {
          campaign_id: string
          content: string | null
          created_at: string
          id: string
          metadata: Json | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_creators: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string
          fee: number | null
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id: string
          fee?: number | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string
          fee?: number | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_creators_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_deliverables: {
        Row: {
          campaign_creator_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          status: string
          submitted_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          campaign_creator_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          submitted_url?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          campaign_creator_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          submitted_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliverables_campaign_creator_id_fkey"
            columns: ["campaign_creator_id"]
            isOneToOne: false
            referencedRelation: "campaign_creators"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          age_range: string | null
          brand: string | null
          budget: number | null
          cluster: string | null
          created_at: string
          deliverables: string | null
          demographics: string | null
          description: string | null
          end_date: string | null
          id: string
          kpis: string | null
          markets: string[] | null
          name: string
          notes: string | null
          objective: string | null
          spent: number | null
          start_date: string | null
          status: string | null
          step: number | null
          target_audience: string | null
          updated_at: string
        }
        Insert: {
          age_range?: string | null
          brand?: string | null
          budget?: number | null
          cluster?: string | null
          created_at?: string
          deliverables?: string | null
          demographics?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          kpis?: string | null
          markets?: string[] | null
          name: string
          notes?: string | null
          objective?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          step?: number | null
          target_audience?: string | null
          updated_at?: string
        }
        Update: {
          age_range?: string | null
          brand?: string | null
          budget?: number | null
          cluster?: string | null
          created_at?: string
          deliverables?: string | null
          demographics?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          kpis?: string | null
          markets?: string[] | null
          name?: string
          notes?: string | null
          objective?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          step?: number | null
          target_audience?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      comet_niches: {
        Row: {
          cadence: string
          created_at: string
          created_by: string | null
          id: string
          intent: string | null
          is_active: boolean
          keywords: string[]
          last_synced_at: string | null
          min_views: number
          name: string
          platforms: string[]
          time_range: string
          updated_at: string
          virlo_comet_id: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string | null
          is_active?: boolean
          keywords?: string[]
          last_synced_at?: string | null
          min_views?: number
          name: string
          platforms?: string[]
          time_range?: string
          updated_at?: string
          virlo_comet_id: string
        }
        Update: {
          cadence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string | null
          is_active?: boolean
          keywords?: string[]
          last_synced_at?: string | null
          min_views?: number
          name?: string
          platforms?: string[]
          time_range?: string
          updated_at?: string
          virlo_comet_id?: string
        }
        Relationships: []
      }
      creator_collaborations: {
        Row: {
          brand_name: string
          caption: string | null
          collaboration_type: string | null
          comments: number | null
          created_at: string
          creator_id: string
          id: string
          image_url: string | null
          likes: number | null
          platform: string
          post_date: string | null
          post_url: string | null
          shortcode: string | null
          updated_at: string
          views: number | null
        }
        Insert: {
          brand_name: string
          caption?: string | null
          collaboration_type?: string | null
          comments?: number | null
          created_at?: string
          creator_id: string
          id?: string
          image_url?: string | null
          likes?: number | null
          platform?: string
          post_date?: string | null
          post_url?: string | null
          shortcode?: string | null
          updated_at?: string
          views?: number | null
        }
        Update: {
          brand_name?: string
          caption?: string | null
          collaboration_type?: string | null
          comments?: number | null
          created_at?: string
          creator_id?: string
          id?: string
          image_url?: string | null
          likes?: number | null
          platform?: string
          post_date?: string | null
          post_url?: string | null
          shortcode?: string | null
          updated_at?: string
          views?: number | null
        }
        Relationships: []
      }
      creator_platforms: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          creator_id: string
          engagement_rate: number | null
          followers: number | null
          handle: string | null
          id: string
          platform: string
          platform_data: Json | null
          profile_url: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          creator_id: string
          engagement_rate?: number | null
          followers?: number | null
          handle?: string | null
          id?: string
          platform: string
          platform_data?: Json | null
          profile_url?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          creator_id?: string
          engagement_rate?: number | null
          followers?: number | null
          handle?: string | null
          id?: string
          platform?: string
          platform_data?: Json | null
          profile_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_platforms_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_posts: {
        Row: {
          caption: string | null
          comments: number | null
          created_at: string
          creator_id: string
          id: string
          image_url: string | null
          instagram_url: string | null
          likes: number | null
          platform: string
          post_date: string | null
          shortcode: string | null
          video_url: string | null
          views: number | null
        }
        Insert: {
          caption?: string | null
          comments?: number | null
          created_at?: string
          creator_id: string
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          likes?: number | null
          platform?: string
          post_date?: string | null
          shortcode?: string | null
          video_url?: string | null
          views?: number | null
        }
        Update: {
          caption?: string | null
          comments?: number | null
          created_at?: string
          creator_id?: string
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          likes?: number | null
          platform?: string
          post_date?: string | null
          shortcode?: string | null
          video_url?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_posts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          avatar_url: string | null
          bio: string | null
          brand: string | null
          cluster: string | null
          country: string | null
          cpv: number | null
          created_at: string
          engagement_rate: number | null
          followers: number | null
          handle: string | null
          id: string
          name: string
          platform: string | null
          roi: number | null
          soi_score: number | null
          status: string | null
          total_posts: number | null
          updated_at: string
          user_id: string | null
          virlo_tracking_id: string | null
          virlo_tracking_platform: string | null
          virlo_tracking_status: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          brand?: string | null
          cluster?: string | null
          country?: string | null
          cpv?: number | null
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          handle?: string | null
          id?: string
          name: string
          platform?: string | null
          roi?: number | null
          soi_score?: number | null
          status?: string | null
          total_posts?: number | null
          updated_at?: string
          user_id?: string | null
          virlo_tracking_id?: string | null
          virlo_tracking_platform?: string | null
          virlo_tracking_status?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          brand?: string | null
          cluster?: string | null
          country?: string | null
          cpv?: number | null
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          handle?: string | null
          id?: string
          name?: string
          platform?: string | null
          roi?: number | null
          soi_score?: number | null
          status?: string | null
          total_posts?: number | null
          updated_at?: string
          user_id?: string | null
          virlo_tracking_id?: string | null
          virlo_tracking_platform?: string | null
          virlo_tracking_status?: string | null
        }
        Relationships: []
      }
      financial_data: {
        Row: {
          amount: number | null
          brand: string
          category: string | null
          cluster: string | null
          created_at: string
          description: string | null
          id: string
          period: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          brand: string
          category?: string | null
          cluster?: string | null
          created_at?: string
          description?: string | null
          id?: string
          period?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          brand?: string
          category?: string | null
          cluster?: string | null
          created_at?: string
          description?: string | null
          id?: string
          period?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trend_comments: {
        Row: {
          author: string | null
          content: string
          created_at: string
          id: string
          likes: number | null
          metadata: Json | null
          platform: string
          posted_at: string | null
          replies: number | null
          source_url: string | null
          trend_id: string
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string
          id?: string
          likes?: number | null
          metadata?: Json | null
          platform?: string
          posted_at?: string | null
          replies?: number | null
          source_url?: string | null
          trend_id: string
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string
          id?: string
          likes?: number | null
          metadata?: Json | null
          platform?: string
          posted_at?: string | null
          replies?: number | null
          source_url?: string | null
          trend_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_comments_trend_id_fkey"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
        ]
      }
      trends: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          relevance_score: number | null
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          relevance_score?: number | null
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          relevance_score?: number | null
          source?: string | null
          title?: string
          updated_at?: string
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
      virlo_cache: {
        Row: {
          cache_key: string
          created_at: string
          endpoint: string
          expires_at: string
          id: string
          params: Json
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          endpoint: string
          expires_at: string
          id?: string
          params?: Json
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          endpoint?: string
          expires_at?: string
          id?: string
          params?: Json
          payload?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "creator" | "user"
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
      app_role: ["admin", "creator", "user"],
    },
  },
} as const
