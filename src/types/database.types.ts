/**
 * Database TypeScript Definitions for Dezignet (Phase 1)
 * Matches Supabase PostgreSQL Schema exactly
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'client' | 'designer' | 'admin';
export type ProfessionalType = 'architect' | 'interior_designer' | 'landscape_architect' | 'engineer';
export type CredentialStatus = 'pending' | 'verified' | 'rejected';

// Phase 2 enums
export type ProjectStatus = 'draft' | 'open' | 'awarded' | 'closed' | 'cancelled';
export type PaymentType = 'milestone' | 'hourly';
export type ProposalStatus = 'pending' | 'viewed' | 'shortlisted' | 'accepted' | 'declined' | 'withdrawn';
export type PlanTier = 'free' | 'basic' | 'upgraded';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          avatar_path: string | null;
          location: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name: string;
          avatar_path?: string | null;
          location?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string;
          avatar_path?: string | null;
          location?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      designer_profiles: {
        Row: {
          user_id: string;
          professional_type: ProfessionalType;
          title: string | null;
          studio_name: string | null;
          bio: string | null;
          specializations: string[];
          languages: string[];
          years_experience: number;
          hourly_rate: number | null;
          show_hourly_rate: boolean;
          is_available: boolean;
          availability_note: string | null;
          show_in_search: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          professional_type?: ProfessionalType;
          title?: string | null;
          studio_name?: string | null;
          bio?: string | null;
          specializations?: string[];
          languages?: string[];
          years_experience?: number;
          hourly_rate?: number | null;
          show_hourly_rate?: boolean;
          is_available?: boolean;
          availability_note?: string | null;
          show_in_search?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          professional_type?: ProfessionalType;
          title?: string | null;
          studio_name?: string | null;
          bio?: string | null;
          specializations?: string[];
          languages?: string[];
          years_experience?: number;
          hourly_rate?: number | null;
          show_hourly_rate?: boolean;
          is_available?: boolean;
          availability_note?: string | null;
          show_in_search?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'designer_profiles_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      portfolio_projects: {
        Row: {
          id: string;
          designer_id: string;
          title: string;
          year: number | null;
          category: string | null;
          location: string | null;
          description: string | null;
          role: string | null;
          sort_order: number;
          cover_image_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          designer_id: string;
          title: string;
          year?: number | null;
          category?: string | null;
          location?: string | null;
          description?: string | null;
          role?: string | null;
          sort_order?: number;
          cover_image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          designer_id?: string;
          title?: string;
          year?: number | null;
          category?: string | null;
          location?: string | null;
          description?: string | null;
          role?: string | null;
          sort_order?: number;
          cover_image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'portfolio_projects_designer_id_fkey';
            columns: ['designer_id'];
            referencedRelation: 'designer_profiles';
            referencedColumns: ['user_id'];
          }
        ];
      };
      portfolio_images: {
        Row: {
          id: string;
          portfolio_project_id: string;
          path: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          portfolio_project_id: string;
          path: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          portfolio_project_id?: string;
          path?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'portfolio_images_portfolio_project_id_fkey';
            columns: ['portfolio_project_id'];
            referencedRelation: 'portfolio_projects';
            referencedColumns: ['id'];
          }
        ];
      };
      credentials: {
        Row: {
          id: string;
          designer_id: string;
          body: string;
          number: string;
          state_region: string;
          year: number;
          certificate_path: string | null;
          status: CredentialStatus;
          rejection_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          designer_id: string;
          body: string;
          number: string;
          state_region: string;
          year: number;
          certificate_path?: string | null;
          status?: CredentialStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          designer_id?: string;
          body?: string;
          number?: string;
          state_region?: string;
          year?: number;
          certificate_path?: string | null;
          status?: CredentialStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credentials_designer_id_fkey';
            columns: ['designer_id'];
            referencedRelation: 'designer_profiles';
            referencedColumns: ['user_id'];
          }
        ];
      };

      // ─── Phase 2 Tables ─────────────────────────────────────────────────────

      app_settings: {
        Row: { key: string; value: Json; description: string | null; };
        Insert: { key: string; value: Json; description?: string | null; };
        Update: { key?: string; value?: Json; description?: string | null; };
        Relationships: [];
      };

      plan_limits: {
        Row: { plan: PlanTier; monthly_proposal_limit: number; portfolio_item_limit: number; };
        Insert: { plan: PlanTier; monthly_proposal_limit: number; portfolio_item_limit: number; };
        Update: { plan?: PlanTier; monthly_proposal_limit?: number; portfolio_item_limit?: number; };
        Relationships: [];
      };

      client_profiles: {
        Row: { user_id: string; payment_verified: boolean; created_at: string; updated_at: string; };
        Insert: { user_id: string; payment_verified?: boolean; created_at?: string; updated_at?: string; };
        Update: { user_id?: string; payment_verified?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [{ foreignKeyName: 'client_profiles_user_id_fkey'; columns: ['user_id']; referencedRelation: 'profiles'; referencedColumns: ['id']; }];
      };

      projects: {
        Row: {
          id: string; client_id: string; title: string; description: string | null;
          category: string; subcategory: string | null; project_type_notes: string | null;
          budget: number; currency: string; payment_type: PaymentType; hourly_rate_max: number | null;
          timeline_days: number | null; deadline: string | null; area_sqft: number | null;
          location_text: string | null; city: string | null; state_region: string | null;
          status: ProjectStatus; published_at: string | null; closed_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; client_id: string; title: string; description?: string | null;
          category: string; subcategory?: string | null; project_type_notes?: string | null;
          budget: number; currency?: string; payment_type: PaymentType; hourly_rate_max?: number | null;
          timeline_days?: number | null; deadline?: string | null; area_sqft?: number | null;
          location_text?: string | null; city?: string | null; state_region?: string | null;
          status?: ProjectStatus; published_at?: string | null; closed_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; client_id?: string; title?: string; description?: string | null;
          category?: string; subcategory?: string | null; project_type_notes?: string | null;
          budget?: number; currency?: string; payment_type?: PaymentType; hourly_rate_max?: number | null;
          timeline_days?: number | null; deadline?: string | null; area_sqft?: number | null;
          location_text?: string | null; city?: string | null; state_region?: string | null;
          status?: ProjectStatus; published_at?: string | null; closed_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Relationships: [{ foreignKeyName: 'projects_client_id_fkey'; columns: ['client_id']; referencedRelation: 'client_profiles'; referencedColumns: ['user_id']; }];
      };

      project_milestones: {
        Row: { id: string; project_id: string; sort_order: number; name: string; description: string | null; deliverables: string[]; billing_trigger: string | null; fee_percent: number; created_at: string; };
        Insert: { id?: string; project_id: string; sort_order: number; name: string; description?: string | null; deliverables?: string[]; billing_trigger?: string | null; fee_percent: number; created_at?: string; };
        Update: { id?: string; project_id?: string; sort_order?: number; name?: string; description?: string | null; deliverables?: string[]; billing_trigger?: string | null; fee_percent?: number; created_at?: string; };
        Relationships: [{ foreignKeyName: 'project_milestones_project_id_fkey'; columns: ['project_id']; referencedRelation: 'projects'; referencedColumns: ['id']; }];
      };

      project_images: {
        Row: { id: string; project_id: string; path: string; sort_order: number; };
        Insert: { id?: string; project_id: string; path: string; sort_order?: number; };
        Update: { id?: string; project_id?: string; path?: string; sort_order?: number; };
        Relationships: [{ foreignKeyName: 'project_images_project_id_fkey'; columns: ['project_id']; referencedRelation: 'projects'; referencedColumns: ['id']; }];
      };

      proposals: {
        Row: {
          id: string; project_id: string; designer_id: string; status: ProposalStatus;
          cover_letter: string; total_price: number; currency: string; delivery_days: number;
          hourly_rate: number | null; estimated_hours: number | null; exclusions: string | null;
          question_for_client: string | null; client_answer: string | null;
          sent_at: string; viewed_at: string | null; decided_at: string | null;
          decline_reason: string | null; withdraw_reason: string | null;
          version_count: number; project_snapshot: Json; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; project_id: string; designer_id: string; status?: ProposalStatus;
          cover_letter: string; total_price: number; currency?: string; delivery_days: number;
          hourly_rate?: number | null; estimated_hours?: number | null; exclusions?: string | null;
          question_for_client?: string | null; client_answer?: string | null;
          sent_at?: string; viewed_at?: string | null; decided_at?: string | null;
          decline_reason?: string | null; withdraw_reason?: string | null;
          version_count?: number; project_snapshot?: Json; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; project_id?: string; designer_id?: string; status?: ProposalStatus;
          cover_letter?: string; total_price?: number; currency?: string; delivery_days?: number;
          hourly_rate?: number | null; estimated_hours?: number | null; exclusions?: string | null;
          question_for_client?: string | null; client_answer?: string | null;
          sent_at?: string; viewed_at?: string | null; decided_at?: string | null;
          decline_reason?: string | null; withdraw_reason?: string | null;
          version_count?: number; project_snapshot?: Json; created_at?: string; updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'proposals_project_id_fkey'; columns: ['project_id']; referencedRelation: 'projects'; referencedColumns: ['id']; },
          { foreignKeyName: 'proposals_designer_id_fkey'; columns: ['designer_id']; referencedRelation: 'profiles'; referencedColumns: ['id']; }
        ];
      };

      proposal_milestones: {
        Row: { id: string; proposal_id: string; project_milestone_id: string | null; fee_percent: number; amount: number; };
        Insert: { id?: string; proposal_id: string; project_milestone_id?: string | null; fee_percent: number; amount: number; };
        Update: { id?: string; proposal_id?: string; project_milestone_id?: string | null; fee_percent?: number; amount?: number; };
        Relationships: [{ foreignKeyName: 'proposal_milestones_proposal_id_fkey'; columns: ['proposal_id']; referencedRelation: 'proposals'; referencedColumns: ['id']; }];
      };

      proposal_portfolio_items: {
        Row: { proposal_id: string; portfolio_project_id: string; };
        Insert: { proposal_id: string; portfolio_project_id: string; };
        Update: never;
        Relationships: [];
      };

      proposal_events: {
        Row: { id: string; proposal_id: string; event_type: string; actor_id: string | null; note: string | null; created_at: string; };
        Insert: { id?: string; proposal_id: string; event_type: string; actor_id?: string | null; note?: string | null; created_at?: string; };
        Update: never;
        Relationships: [{ foreignKeyName: 'proposal_events_proposal_id_fkey'; columns: ['proposal_id']; referencedRelation: 'proposals'; referencedColumns: ['id']; }];
      };

      proposal_versions: {
        Row: { proposal_id: string; version: number; data: Json; created_at: string; };
        Insert: { proposal_id: string; version: number; data: Json; created_at?: string; };
        Update: never;
        Relationships: [];
      };

      saved_projects: {
        Row: { user_id: string; project_id: string; created_at: string; };
        Insert: { user_id: string; project_id: string; created_at?: string; };
        Update: never;
        Relationships: [];
      };

      saved_designers: {
        Row: { user_id: string; designer_id: string; created_at: string; };
        Insert: { user_id: string; designer_id: string; created_at?: string; };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      // Phase 1 views
      public_designer_profiles: {
        Row: {
          designer_id: string;
          full_name: string;
          avatar_path: string | null;
          location: string | null;
          title: string | null;
          studio_name: string | null;
          bio: string | null;
          professional_type: ProfessionalType;
          specializations: string[];
          languages: string[];
          years_experience: number;
          is_available: boolean;
          availability_note: string | null;
          member_since: string;
          hourly_rate: number | null;
          show_hourly_rate: boolean;
          show_in_search: boolean;
          verified: boolean;
        };
        Relationships: [];
      };
      public_portfolio: {
        Row: {
          project_id: string;
          designer_id: string;
          title: string;
          year: number | null;
          category: string | null;
          location: string | null;
          description: string | null;
          role: string | null;
          sort_order: number;
          cover_image_path: string | null;
          images: Array<{
            id: string;
            path: string;
            sort_order: number;
          }>;
        };
        Relationships: [];
      };
      public_credentials: {
        Row: {
          id: string;
          designer_id: string;
          body: string;
          state_region: string;
          year: number;
          status: CredentialStatus;
          masked_number: string;
          certificate_path: string | null;
        };
        Relationships: [];
      };

      // Phase 2 views
      open_projects: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          description: string | null;
          category: string;
          subcategory: string | null;
          budget: number;
          currency: string;
          payment_type: PaymentType;
          hourly_rate_max: number | null;
          timeline_days: number | null;
          deadline: string | null;
          area_sqft: number | null;
          location_text: string | null;
          city: string | null;
          state_region: string | null;
          published_at: string | null;
          proposal_count: number;
          has_applied: boolean;
          is_saved: boolean;
          milestones: Json;
          status: ProjectStatus;
        };
        Relationships: [];
      };

      client_summaries: {
        Row: {
          user_id: string;
          display_name: string;
          city: string | null;
          state_region: string | null;
          member_since: string;
          projects_posted: number;
          payment_verified: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_profile_completeness: {
        Args: { p_designer_id: string };
        Returns: {
          score: number;
          checklist: Array<{
            id: string;
            label: string;
            tab: string;
            completed: boolean;
          }>;
        };
      };
      submit_proposal: {
        Args: {
          p_project_id: string;
          p_cover_letter: string;
          p_total_price: number;
          p_currency: string;
          p_delivery_days: number;
          p_hourly_rate: number | null;
          p_estimated_hours: number | null;
          p_exclusions: string | null;
          p_question_for_client: string | null;
          p_milestone_offers: Json;
          p_portfolio_item_ids: string[];
        };
        Returns: string;
      };
      update_proposal: {
        Args: {
          p_proposal_id: string;
          p_cover_letter: string;
          p_total_price: number;
          p_delivery_days: number;
          p_hourly_rate: number | null;
          p_estimated_hours: number | null;
          p_exclusions: string | null;
          p_question_for_client: string | null;
          p_milestone_offers: Json;
        };
        Returns: void;
      };
      withdraw_proposal: {
        Args: { p_proposal_id: string; p_reason: string | null };
        Returns: void;
      };
      mark_proposal_viewed: {
        Args: { p_proposal_id: string };
        Returns: void;
      };
      shortlist_proposal: {
        Args: { p_proposal_id: string };
        Returns: void;
      };
      decline_proposal: {
        Args: { p_proposal_id: string; p_reason: string | null };
        Returns: void;
      };
      proposal_usage: {
        Args: { p_designer_id: string };
        Returns: Array<{ used: number; limit: number; period_end: string }>;
      };
    };
    Enums: {
      user_role: UserRole;
      professional_type: ProfessionalType;
      credential_status: CredentialStatus;
      project_status: ProjectStatus;
      payment_type: PaymentType;
      proposal_status: ProposalStatus;
      plan_tier: PlanTier;
    };
    CompositeTypes: Record<string, never>;
  };
};
