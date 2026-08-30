/**
 * Supabase database types.
 *
 * This checked-in baseline mirrors `supabase/migrations`. After linking a
 * project, regenerate it with `pnpm db-types`; the generated result is the
 * authoritative type file for the deployed database.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      voice_profiles: {
        Row: {
          user_id: string;
          profile_json: Json;
          interview_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          profile_json: Json;
          interview_json: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          profile_json?: Json;
          interview_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
