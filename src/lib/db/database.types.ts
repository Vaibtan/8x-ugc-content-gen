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
      brand_kits: {
        Row: {
          user_id: string;
          display_name: string;
          handle: string;
          headshot_path: string | null;
          logo_path: string | null;
          primary_color: string;
          secondary_color: string;
          font: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string;
          handle?: string;
          headshot_path?: string | null;
          logo_path?: string | null;
          primary_color?: string;
          secondary_color?: string;
          font?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          handle?: string;
          headshot_path?: string | null;
          logo_path?: string | null;
          primary_color?: string;
          secondary_color?: string;
          font?: string;
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
      usage_events: {
        Row: {
          id: string;
          user_id: string;
          pack_id: string | null;
          operation: string;
          input_tokens: number;
          output_tokens: number;
          characters: number;
          cost_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pack_id?: string | null;
          operation: string;
          input_tokens?: number;
          output_tokens?: number;
          characters?: number;
          cost_cents?: number;
          created_at?: string;
        };
        Update: {
          operation?: string;
          input_tokens?: number;
          output_tokens?: number;
          characters?: number;
          cost_cents?: number;
        };
        Relationships: [];
      };
      packs: {
        Row: {
          id: string;
          user_id: string;
          idea: string;
          pillar: string;
          goal: "reach" | "leads";
          status: "draft" | "ready" | "posted" | "winner";
          idempotency_key: string;
          content_json: Json | null;
          cost_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          idea: string;
          pillar: string;
          goal: "reach" | "leads";
          status?: "draft" | "ready" | "posted" | "winner";
          idempotency_key: string;
          content_json?: Json | null;
          cost_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "draft" | "ready" | "posted" | "winner";
          content_json?: Json | null;
          cost_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          pack_id: string;
          type: "post" | "carousel" | "video" | "newsletter" | "magnet";
          status: "queued" | "running" | "done" | "failed";
          content_json: Json | null;
          file_url: string | null;
          error: string | null;
          cost_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pack_id: string;
          type: "post" | "carousel" | "video" | "newsletter" | "magnet";
          status?: "queued" | "running" | "done" | "failed";
          content_json?: Json | null;
          file_url?: string | null;
          error?: string | null;
          cost_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "queued" | "running" | "done" | "failed";
          content_json?: Json | null;
          file_url?: string | null;
          error?: string | null;
          cost_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          pack_id: string;
          asset_id: string | null;
          type:
            | "generate-pack-text"
            | "render-carousel"
            | "render-video"
            | "render-magnet";
          status: "queued" | "running" | "done" | "failed";
          idempotency_key: string;
          attempt: number;
          error: string | null;
          cost_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pack_id: string;
          asset_id?: string | null;
          type:
            | "generate-pack-text"
            | "render-carousel"
            | "render-video"
            | "render-magnet";
          status?: "queued" | "running" | "done" | "failed";
          idempotency_key: string;
          attempt?: number;
          error?: string | null;
          cost_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "queued" | "running" | "done" | "failed";
          attempt?: number;
          error?: string | null;
          cost_cents?: number;
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
