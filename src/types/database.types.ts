export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          social_media: Json | null;
          created_at: string;
          updated_at: string;
          deleted: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          social_media?: Json | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          social_media?: Json | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          max_inactivity_time: string;
          contacts: Json;
          last_check_in: string;
          notification_content: string | null;
          created_at: string;
          updated_at: string;
          memo: string | null;
          deleted: boolean;
          last_trigger_time: string | null;
          muted: boolean;
          status: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          max_inactivity_time: string;
          contacts: Json;
          last_check_in?: string;
          notification_content?: string | null;
          created_at?: string;
          updated_at?: string;
          memo?: string | null;
          deleted?: boolean;
          last_trigger_time?: string | null;
          muted?: boolean;
          status?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          max_inactivity_time?: string;
          contacts?: Json;
          last_check_in?: string;
          notification_content?: string | null;
          created_at?: string;
          updated_at?: string;
          memo?: string | null;
          deleted?: boolean;
          last_trigger_time?: string | null;
          muted?: boolean;
          status?: string;
        };
      };
      notification_logs: {
        Row: {
          id: string;
          event_id: string;
          notification_type: string;
          recipient: string;
          content: string;
          sent_at: string;
          status: string;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          notification_type: string;
          recipient: string;
          content: string;
          sent_at?: string;
          status: string;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          notification_type?: string;
          recipient?: string;
          content?: string;
          sent_at?: string;
          status?: string;
          error_message?: string | null;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          event_id: string | null;
          action: string;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          action: string;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string | null;
          action?: string;
          details?: Json | null;
          created_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string | null;
          status: string | null;
          price_id: string | null;
          quantity: number | null;
          cancel_at_period_end: boolean | null;
          created_at: string;
          current_period_start: number | null;
          current_period_end: number | null;
          ended_at: number | null;
          cancel_at: number | null;
          canceled_at: number | null;
          trial_start: number | null;
          trial_end: number | null;
          metadata: Json | null;
          stripe_id: string | null;
          stripe_price_id: string | null;
          currency: string | null;
          interval: string | null;
          amount: number | null;
          started_at: number | null;
          customer_id: string | null;
          custom_field_data: Json | null;
          customer_cancellation_reason: string | null;
          customer_cancellation_comment: string | null;
          updated_at: string;
          ends_at: number | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          status?: string | null;
          price_id?: string | null;
          quantity?: number | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string;
          current_period_start?: number | null;
          current_period_end?: number | null;
          ended_at?: number | null;
          cancel_at?: number | null;
          canceled_at?: number | null;
          trial_start?: number | null;
          trial_end?: number | null;
          metadata?: Json | null;
          stripe_id?: string | null;
          stripe_price_id?: string | null;
          currency?: string | null;
          interval?: string | null;
          amount?: number | null;
          started_at?: number | null;
          customer_id?: string | null;
          custom_field_data?: Json | null;
          customer_cancellation_reason?: string | null;
          customer_cancellation_comment?: string | null;
          updated_at?: string;
          ends_at?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          status?: string | null;
          price_id?: string | null;
          quantity?: number | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string;
          current_period_start?: number | null;
          current_period_end?: number | null;
          ended_at?: number | null;
          cancel_at?: number | null;
          canceled_at?: number | null;
          trial_start?: number | null;
          trial_end?: number | null;
          metadata?: Json | null;
          stripe_id?: string | null;
          stripe_price_id?: string | null;
          currency?: string | null;
          interval?: string | null;
          amount?: number | null;
          started_at?: number | null;
          customer_id?: string | null;
          custom_field_data?: Json | null;
          customer_cancellation_reason?: string | null;
          customer_cancellation_comment?: string | null;
          updated_at?: string;
          ends_at?: number | null;
        };
      };
      users: {
        Row: {
          id: string;
          user_id: string | null;
          name: string | null;
          email: string | null;
          token_identifier: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string | null;
          subscription: string | null;
          credits: string | null;
          image: string | null;
          full_name: string | null;
          is_admin: boolean | null;
        };
        Insert: {
          id: string;
          user_id?: string | null;
          name?: string | null;
          email?: string | null;
          token_identifier: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string | null;
          subscription?: string | null;
          credits?: string | null;
          image?: string | null;
          full_name?: string | null;
          is_admin?: boolean | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string | null;
          email?: string | null;
          token_identifier?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string | null;
          subscription?: string | null;
          credits?: string | null;
          image?: string | null;
          full_name?: string | null;
          is_admin?: boolean | null;
        };
      };
      webhook_events: {
        Row: {
          id: string;
          event_type: string;
          type: string;
          stripe_event_id: string | null;
          created_at: string;
          modified_at: string;
          data: Json | null;
        };
        Insert: {
          id?: string;
          event_type: string;
          type: string;
          stripe_event_id?: string | null;
          created_at?: string;
          modified_at?: string;
          data?: Json | null;
        };
        Update: {
          id?: string;
          event_type?: string;
          type?: string;
          stripe_event_id?: string | null;
          created_at?: string;
          modified_at?: string;
          data?: Json | null;
        };
      };
    };
  };
}
