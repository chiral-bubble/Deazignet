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
    };
    Views: {
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
    };
    Enums: {
      user_role: UserRole;
      professional_type: ProfessionalType;
      credential_status: CredentialStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
