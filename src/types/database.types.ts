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

// Phase 3 enums (Active Work)
export type EngagementStatus = 'active' | 'completed' | 'cancelled' | 'disputed';
export type MilestoneStatus =
  | 'awaiting_funding'
  | 'funded'
  | 'in_progress'
  | 'submitted'
  | 'revision_requested'
  | 'approved'
  | 'disputed';
export type PayoutStatus = 'not_due' | 'pending_release' | 'on_hold' | 'released' | 'cancelled';
export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'disputed';
export type InvoiceStatus = 'pending_approval' | 'approved' | 'paid' | 'disputed';
export type DisputeStatus = 'open' | 'resolved';
export type TicketType = 'help' | 'problem';
export type ApprovalSource = 'client' | 'auto';

// Phase 4 enums
export type NotificationType =
  | 'proposal_received'
  | 'proposal_viewed'
  | 'proposal_shortlisted'
  | 'proposal_accepted'
  | 'proposal_declined'
  | 'milestone_funded'
  | 'deliverable_submitted'
  | 'review_reminder'
  | 'deliverable_approved'
  | 'approved_automatically'
  | 'revision_requested'
  | 'payment_released'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'withdrawal_paid'
  | 'withdrawal_failed'
  | 'message_received'
  | 'credential_verified'
  | 'credential_rejected'
  | 'plan_renewal'
  | 'system_announcement';

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

      engagements: {
        Row: {
          id: string;
          project_id: string;
          proposal_id: string;
          client_id: string;
          designer_id: string;
          payment_type: PaymentType;
          total_price: number;
          currency: string;
          platform_fee_percent: number;
          hourly_rate: number | null;
          weekly_hours_cap: number | null;
          status: EngagementStatus;
          terms_snapshot: Json;
          started_at: string;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          proposal_id: string;
          client_id: string;
          designer_id: string;
          payment_type: PaymentType;
          total_price: number;
          currency?: string;
          platform_fee_percent?: number;
          hourly_rate?: number | null;
          weekly_hours_cap?: number | null;
          status?: EngagementStatus;
          terms_snapshot?: Json;
          started_at?: string;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          proposal_id?: string;
          client_id?: string;
          designer_id?: string;
          payment_type?: PaymentType;
          total_price?: number;
          currency?: string;
          platform_fee_percent?: number;
          hourly_rate?: number | null;
          weekly_hours_cap?: number | null;
          status?: EngagementStatus;
          terms_snapshot?: Json;
          started_at?: string;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      engagement_milestones: {
        Row: {
          id: string;
          engagement_id: string;
          sort_order: number;
          name: string;
          description: string | null;
          deliverables: string[];
          billing_trigger: string | null;
          fee_percent: number;
          amount: number;
          due_date: string | null;
          status: MilestoneStatus;
          payout_status: PayoutStatus;
          funded_at: string | null;
          started_at: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          released_at: string | null;
          revision_count: number;
          approval_source: ApprovalSource | null;
          release_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          engagement_id: string;
          sort_order?: number;
          name: string;
          description?: string | null;
          deliverables?: string[];
          billing_trigger?: string | null;
          fee_percent: number;
          amount: number;
          due_date?: string | null;
          status?: MilestoneStatus;
          payout_status?: PayoutStatus;
          funded_at?: string | null;
          started_at?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          released_at?: string | null;
          revision_count?: number;
          approval_source?: ApprovalSource | null;
          release_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          engagement_id?: string;
          sort_order?: number;
          name?: string;
          description?: string | null;
          deliverables?: string[];
          billing_trigger?: string | null;
          fee_percent?: number;
          amount?: number;
          due_date?: string | null;
          status?: MilestoneStatus;
          payout_status?: PayoutStatus;
          funded_at?: string | null;
          started_at?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          released_at?: string | null;
          revision_count?: number;
          approval_source?: ApprovalSource | null;
          release_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      milestone_submissions: {
        Row: {
          id: string;
          milestone_id: string;
          version: number;
          notes: string | null;
          submitted_at: string;
          client_response: string | null;
          response_comment: string | null;
          responded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          milestone_id: string;
          version: number;
          notes?: string | null;
          submitted_at?: string;
          client_response?: string | null;
          response_comment?: string | null;
          responded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          milestone_id?: string;
          version?: number;
          notes?: string | null;
          submitted_at?: string;
          client_response?: string | null;
          response_comment?: string | null;
          responded_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      submission_files: {
        Row: {
          id: string;
          submission_id: string;
          path: string;
          file_name: string;
          size_bytes: number;
          mime_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          path: string;
          file_name: string;
          size_bytes: number;
          mime_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          path?: string;
          file_name?: string;
          size_bytes?: number;
          mime_type?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      milestone_comments: {
        Row: {
          id: string;
          milestone_id: string;
          submission_id: string | null;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          milestone_id: string;
          submission_id?: string | null;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          milestone_id?: string;
          submission_id?: string | null;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      time_entries: {
        Row: {
          id: string;
          engagement_id: string;
          designer_id: string;
          work_date: string;
          hours: number;
          description: string;
          status: TimeEntryStatus;
          week_start: string;
          submitted_at: string | null;
          approved_at: string | null;
          dispute_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          engagement_id: string;
          designer_id: string;
          work_date: string;
          hours: number;
          description: string;
          status?: TimeEntryStatus;
          week_start?: string;
          submitted_at?: string | null;
          approved_at?: string | null;
          dispute_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          engagement_id?: string;
          designer_id?: string;
          work_date?: string;
          hours?: number;
          description?: string;
          status?: TimeEntryStatus;
          week_start?: string;
          submitted_at?: string | null;
          approved_at?: string | null;
          dispute_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      invoices: {
        Row: {
          id: string;
          engagement_id: string;
          week_start: string;
          hours_total: number;
          hourly_rate: number;
          amount: number;
          status: InvoiceStatus;
          number: string;
          created_at: string;
          approved_at: string | null;
          approval_source: ApprovalSource | null;
          release_at: string | null;
        };
        Insert: {
          id?: string;
          engagement_id: string;
          week_start: string;
          hours_total: number;
          hourly_rate: number;
          amount: number;
          status?: InvoiceStatus;
          number: string;
          created_at?: string;
          approved_at?: string | null;
          approval_source?: ApprovalSource | null;
          release_at?: string | null;
        };
        Update: {
          id?: string;
          engagement_id?: string;
          week_start?: string;
          hours_total?: number;
          hourly_rate?: number;
          amount?: number;
          status?: InvoiceStatus;
          number?: string;
          created_at?: string;
          approved_at?: string | null;
          approval_source?: ApprovalSource | null;
          release_at?: string | null;
        };
        Relationships: [];
      };

      engagement_events: {
        Row: {
          id: string;
          engagement_id: string;
          actor_id: string;
          event_type: string;
          milestone_id: string | null;
          data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          engagement_id: string;
          actor_id: string;
          event_type: string;
          milestone_id?: string | null;
          data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          engagement_id?: string;
          actor_id?: string;
          event_type?: string;
          milestone_id?: string | null;
          data?: Json;
          created_at?: string;
        };
        Relationships: [];
      };

      disputes: {
        Row: {
          id: string;
          engagement_id: string;
          milestone_id: string | null;
          raised_by: string;
          reason: string;
          details: string;
          status: DisputeStatus;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          engagement_id: string;
          milestone_id?: string | null;
          raised_by: string;
          reason: string;
          details: string;
          status?: DisputeStatus;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          engagement_id?: string;
          milestone_id?: string | null;
          raised_by?: string;
          reason?: string;
          details?: string;
          status?: DisputeStatus;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };

      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          engagement_id: string | null;
          type: TicketType;
          subject: string;
          details: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          engagement_id?: string | null;
          type: TicketType;
          subject: string;
          details: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          engagement_id?: string | null;
          type?: TicketType;
          subject?: string;
          details?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      conversations: {
        Row: {
          id: string;
          project_id: string;
          proposal_id: string;
          client_id: string;
          designer_id: string;
          status: 'active' | 'closed';
          created_by: string;
          created_at: string;
          last_message_at: string | null;
          last_message_preview: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          proposal_id: string;
          client_id: string;
          designer_id: string;
          status?: 'active' | 'closed';
          created_by: string;
          created_at?: string;
          last_message_at?: string | null;
          last_message_preview?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          proposal_id?: string;
          client_id?: string;
          designer_id?: string;
          status?: 'active' | 'closed';
          created_by?: string;
          created_at?: string;
          last_message_at?: string | null;
          last_message_preview?: string | null;
        };
        Relationships: [];
      };

      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string | null;
          kind: 'user' | 'system';
          system_type: string | null;
          body: string;
          created_at: string;
          delivered_at: string | null;
          flagged: boolean;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id?: string | null;
          kind?: 'user' | 'system';
          system_type?: string | null;
          body: string;
          created_at?: string;
          delivered_at?: string | null;
          flagged?: boolean;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string | null;
          kind?: 'user' | 'system';
          system_type?: string | null;
          body?: string;
          created_at?: string;
          delivered_at?: string | null;
          flagged?: boolean;
        };
        Relationships: [];
      };

      message_attachments: {
        Row: {
          id: string;
          message_id: string;
          path: string;
          file_name: string;
          size_bytes: number;
          mime_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          path: string;
          file_name: string;
          size_bytes: number;
          mime_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          path?: string;
          file_name?: string;
          size_bytes?: number;
          mime_type?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      conversation_user_settings: {
        Row: {
          conversation_id: string;
          user_id: string;
          muted: boolean;
          archived: boolean;
          last_read_at: string | null;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          muted?: boolean;
          archived?: boolean;
          last_read_at?: string | null;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          muted?: boolean;
          archived?: boolean;
          last_read_at?: string | null;
        };
        Relationships: [];
      };

      conversation_reports: {
        Row: {
          id: string;
          conversation_id: string;
          reporter_id: string;
          reason: string;
          details: string;
          status: 'open' | 'resolved';
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          reporter_id: string;
          reason: string;
          details: string;
          status?: 'open' | 'resolved';
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          reporter_id?: string;
          reason?: string;
          details?: string;
          status?: 'open' | 'resolved';
          created_at?: string;
        };
        Relationships: [];
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          data: Json;
          created_at: string;
          read_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          data?: Json;
          created_at?: string;
          read_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string;
          data?: Json;
          created_at?: string;
          read_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      notification_preferences: {
        Row: {
          user_id: string;
          type: NotificationType;
          in_app: boolean;
          email: boolean;
        };
        Insert: {
          user_id: string;
          type: NotificationType;
          in_app?: boolean;
          email?: boolean;
        };
        Update: {
          user_id?: string;
          type?: NotificationType;
          in_app?: boolean;
          email?: boolean;
        };
        Relationships: [];
      };

      job_runs: {
        Row: {
          id: string;
          job_name: string;
          started_at: string;
          completed_at: string | null;
          status: string;
          items_processed: number;
          details: Json;
          error: string | null;
        };
        Insert: {
          id?: string;
          job_name: string;
          started_at?: string;
          completed_at?: string | null;
          status?: string;
          items_processed?: number;
          details?: Json;
          error?: string | null;
        };
        Update: {
          id?: string;
          job_name?: string;
          started_at?: string;
          completed_at?: string | null;
          status?: string;
          items_processed?: number;
          details?: Json;
          error?: string | null;
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

      // Phase 3 Functions
      accept_proposal: {
        Args: { p_proposal_id: string };
        Returns: string;
      };
      dev_fund_milestone: {
        Args: { p_milestone_id: string };
        Returns: void;
      };
      dev_release_milestone: {
        Args: { p_milestone_id: string };
        Returns: void;
      };
      start_milestone: {
        Args: { p_milestone_id: string };
        Returns: void;
      };
      submit_milestone: {
        Args: { p_milestone_id: string; p_notes: string; p_files?: Json };
        Returns: string;
      };
      add_milestone_comment: {
        Args: { p_milestone_id: string; p_submission_id: string | null; p_body: string };
        Returns: string;
      };
      log_time: {
        Args: { p_engagement_id: string; p_work_date: string; p_hours: number; p_description: string };
        Returns: string;
      };
      update_time_entry: {
        Args: { p_entry_id: string; p_work_date: string; p_hours: number; p_description: string };
        Returns: void;
      };
      delete_time_entry: {
        Args: { p_entry_id: string };
        Returns: void;
      };
      submit_week: {
        Args: { p_engagement_id: string; p_week_start: string };
        Returns: string;
      };
      approve_milestone: {
        Args: { p_milestone_id: string };
        Returns: void;
      };
      request_revision: {
        Args: { p_milestone_id: string; p_reason: string };
        Returns: void;
      };
      approve_week: {
        Args: { p_invoice_id: string };
        Returns: void;
      };
      dev_pay_invoice: {
        Args: { p_invoice_id: string };
        Returns: void;
      };
      dispute_week: {
        Args: { p_invoice_id: string; p_note: string };
        Returns: string;
      };
      complete_engagement: {
        Args: { p_engagement_id: string };
        Returns: void;
      };
      raise_dispute: {
        Args: { p_engagement_id: string; p_milestone_id: string | null; p_reason: string; p_details: string };
        Returns: string;
      };
      cancel_engagement: {
        Args: { p_engagement_id: string; p_reason: string };
        Returns: void;
      };
      create_support_ticket: {
        Args: { p_engagement_id: string | null; p_type: TicketType; p_subject: string; p_details: string };
        Returns: string;
      };
      get_designer_dashboard: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };

      // Phase 4 Functions
      client_raise_dispute: {
        Args: { p_item_type: 'milestone' | 'invoice'; p_item_id: string; p_reason: string; p_details: string };
        Returns: string;
      };
      resolve_dispute: {
        Args: { p_dispute_id: string; p_outcome: string; p_split_percent?: number | null; p_note?: string };
        Returns: void;
      };
      dev_fast_forward: {
        Args: { p_item_type: 'milestone' | 'invoice'; p_item_id: string; p_days: number };
        Returns: void;
      };
      send_review_reminders: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      auto_approve_overdue: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      release_due_payouts: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      start_conversation: {
        Args: { p_project_id: string; p_designer_id: string; p_first_message: string; p_attachments?: Json };
        Returns: string;
      };
      send_message: {
        Args: { p_conversation_id: string; p_body: string; p_attachments?: Json };
        Returns: string;
      };
      mark_delivered: {
        Args: { p_conversation_id: string };
        Returns: void;
      };
      mark_read: {
        Args: { p_conversation_id: string };
        Returns: void;
      };
      set_conversation_flags: {
        Args: { p_conversation_id: string; p_muted?: boolean | null; p_archived?: boolean | null };
        Returns: void;
      };
      report_conversation: {
        Args: { p_conversation_id: string; p_reason: string; p_details: string };
        Returns: string;
      };
      get_unread_counts: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      create_notification: {
        Args: { p_user_id: string; p_type: NotificationType; p_title: string; p_body: string; p_data?: Json };
        Returns: string | null;
      };
      mark_notification_read: {
        Args: { p_id: string; p_read?: boolean };
        Returns: void;
      };
      mark_all_notifications_read: {
        Args: { p_type?: NotificationType | null };
        Returns: void;
      };
      delete_notification: {
        Args: { p_id: string };
        Returns: void;
      };
      undo_delete_notification: {
        Args: { p_id: string };
        Returns: void;
      };
      purge_old_notifications: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      announce_system: {
        Args: { p_title: string; p_body: string; p_audience?: string };
        Returns: number;
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
      engagement_status: EngagementStatus;
      milestone_status: MilestoneStatus;
      payout_status: PayoutStatus;
      time_entry_status: TimeEntryStatus;
      invoice_status: InvoiceStatus;
      dispute_status: DisputeStatus;
      ticket_type: TicketType;
      approval_source: ApprovalSource;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
};
