// Placeholder Database types for the `palaro` schema.
// Replace by running `npm run gen:types` once SUPABASE_ACCESS_TOKEN is set in .env.local.
// The shape mirrors what `supabase gen types typescript` produces, so regenerated output drops in cleanly.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  palaro: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          auth_user_id: string | null;
          full_name: string | null;
          email: string;
          phone: string | null;
          role: Database["palaro"]["Enums"]["user_role"] | null;
          status: Database["palaro"]["Enums"]["profile_status"];
          agency: string | null;
          designation: string | null;
          rank: string | null;
          primary_assignment_site_id: string | null;
          is_active: boolean;
          avatar_url: string | null;
          invited_by: string | null;
          invited_at: string | null;
          activated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          full_name?: string | null;
          email: string;
          phone?: string | null;
          role?: Database["palaro"]["Enums"]["user_role"] | null;
          status?: Database["palaro"]["Enums"]["profile_status"];
          agency?: string | null;
          designation?: string | null;
          rank?: string | null;
          primary_assignment_site_id?: string | null;
          is_active?: boolean;
          avatar_url?: string | null;
          invited_by?: string | null;
          invited_at?: string | null;
          activated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          full_name?: string | null;
          email?: string;
          phone?: string | null;
          role?: Database["palaro"]["Enums"]["user_role"] | null;
          status?: Database["palaro"]["Enums"]["profile_status"];
          agency?: string | null;
          designation?: string | null;
          rank?: string | null;
          primary_assignment_site_id?: string | null;
          is_active?: boolean;
          avatar_url?: string | null;
          invited_by?: string | null;
          invited_at?: string | null;
          activated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          referral_number: string;
          incident_id: string | null;
          level: Database["palaro"]["Enums"]["referral_level"];
          status: Database["palaro"]["Enums"]["referral_status"];
          from_site_id: string | null;
          to_site_id: string;
          patient_name: string;
          patient_age: number | null;
          patient_gender: string | null;
          delegation_id: string | null;
          chief_complaint: string | null;
          initial_diagnosis: string | null;
          vital_signs: Json | null;
          treatment_given: string | null;
          referred_by: string | null;
          referred_at: string;
          received_by: string | null;
          received_at: string | null;
          assessment_notes: string | null;
          final_diagnosis: string | null;
          treatment_plan: string | null;
          discharge_notes: string | null;
          discharged_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          referral_number?: string;
          incident_id?: string | null;
          level: Database["palaro"]["Enums"]["referral_level"];
          status?: Database["palaro"]["Enums"]["referral_status"];
          from_site_id?: string | null;
          to_site_id: string;
          patient_name: string;
          patient_age?: number | null;
          patient_gender?: string | null;
          delegation_id?: string | null;
          chief_complaint?: string | null;
          initial_diagnosis?: string | null;
          vital_signs?: Json | null;
          treatment_given?: string | null;
          referred_by?: string | null;
          referred_at?: string;
          received_by?: string | null;
          received_at?: string | null;
          assessment_notes?: string | null;
          final_diagnosis?: string | null;
          treatment_plan?: string | null;
          discharge_notes?: string | null;
          discharged_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          referral_number?: string;
          incident_id?: string | null;
          level?: Database["palaro"]["Enums"]["referral_level"];
          status?: Database["palaro"]["Enums"]["referral_status"];
          from_site_id?: string | null;
          to_site_id?: string;
          patient_name?: string;
          patient_age?: number | null;
          patient_gender?: string | null;
          delegation_id?: string | null;
          chief_complaint?: string | null;
          initial_diagnosis?: string | null;
          vital_signs?: Json | null;
          treatment_given?: string | null;
          referred_by?: string | null;
          referred_at?: string;
          received_by?: string | null;
          received_at?: string | null;
          assessment_notes?: string | null;
          final_diagnosis?: string | null;
          treatment_plan?: string | null;
          discharge_notes?: string | null;
          discharged_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string | null;
          recipient_role: Database["palaro"]["Enums"]["user_role"] | null;
          title: string;
          body: string | null;
          category: string;
          severity: string | null;
          reference_type: string | null;
          reference_id: string | null;
          link_url: string | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id?: string | null;
          recipient_role?: Database["palaro"]["Enums"]["user_role"] | null;
          title: string;
          body?: string | null;
          category: string;
          severity?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          link_url?: string | null;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string | null;
          recipient_role?: Database["palaro"]["Enums"]["user_role"] | null;
          title?: string;
          body?: string | null;
          category?: string;
          severity?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          link_url?: string | null;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      incidents: {
        Row: {
          id: string;
          incident_number: string;
          category: Database["palaro"]["Enums"]["incident_category"];
          severity: Database["palaro"]["Enums"]["incident_severity"];
          status: Database["palaro"]["Enums"]["incident_status"];
          title: string;
          description: string | null;
          site_id: string | null;
          location_details: string | null;
          latitude: number | null;
          longitude: number | null;
          delegation_id: string | null;
          affected_person_name: string | null;
          affected_person_age: number | null;
          affected_person_role: string | null;
          reported_by: string | null;
          reported_at: string;
          resolved_by: string | null;
          resolved_at: string | null;
          resolution_notes: string | null;
          photo_urls: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          incident_number?: string;
          category: Database["palaro"]["Enums"]["incident_category"];
          severity?: Database["palaro"]["Enums"]["incident_severity"];
          status?: Database["palaro"]["Enums"]["incident_status"];
          title: string;
          description?: string | null;
          site_id?: string | null;
          location_details?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          delegation_id?: string | null;
          affected_person_name?: string | null;
          affected_person_age?: number | null;
          affected_person_role?: string | null;
          reported_by?: string | null;
          reported_at?: string;
          resolved_by?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          photo_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          incident_number?: string;
          category?: Database["palaro"]["Enums"]["incident_category"];
          severity?: Database["palaro"]["Enums"]["incident_severity"];
          status?: Database["palaro"]["Enums"]["incident_status"];
          title?: string;
          description?: string | null;
          site_id?: string | null;
          location_details?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          delegation_id?: string | null;
          affected_person_name?: string | null;
          affected_person_age?: number | null;
          affected_person_role?: string | null;
          reported_by?: string | null;
          reported_at?: string;
          resolved_by?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          photo_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      delegations: {
        Row: {
          id: string;
          region_code: string;
          region_name: string;
          short_name: string | null;
          head_of_delegation: string | null;
          contact_number: string | null;
          total_athletes: number | null;
          total_coaches: number | null;
          total_officials: number | null;
          color_hex: string | null;
          logo_url: string | null;
          assigned_bq_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          region_code: string;
          region_name: string;
          short_name?: string | null;
          head_of_delegation?: string | null;
          contact_number?: string | null;
          total_athletes?: number | null;
          total_coaches?: number | null;
          total_officials?: number | null;
          color_hex?: string | null;
          logo_url?: string | null;
          assigned_bq_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          region_code?: string;
          region_name?: string;
          short_name?: string | null;
          head_of_delegation?: string | null;
          contact_number?: string | null;
          total_athletes?: number | null;
          total_coaches?: number | null;
          total_officials?: number | null;
          color_hex?: string | null;
          logo_url?: string | null;
          assigned_bq_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          name: string;
          site_type: Database["palaro"]["Enums"]["site_type"];
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          contact_person: string | null;
          contact_number: string | null;
          capacity: number | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          site_type: Database["palaro"]["Enums"]["site_type"];
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          contact_person?: string | null;
          contact_number?: string | null;
          capacity?: number | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          site_type?: Database["palaro"]["Enums"]["site_type"];
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          contact_person?: string | null;
          contact_number?: string | null;
          capacity?: number | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vip_persons: {
        Row: {
          id: string;
          full_name: string;
          title: string | null;
          organization: string | null;
          delegation_id: string | null;
          contact_number: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          title?: string | null;
          organization?: string | null;
          delegation_id?: string | null;
          contact_number?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          title?: string | null;
          organization?: string | null;
          delegation_id?: string | null;
          contact_number?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      vip_movements: {
        Row: {
          id: string;
          vip_id: string;
          destination_site_id: string | null;
          status: Database["palaro"]["Enums"]["vip_movement_status"];
          estimated_arrival: string | null;
          actual_arrival: string | null;
          estimated_departure: string | null;
          actual_departure: string | null;
          purpose: string | null;
          protocol_officer_id: string | null;
          vehicle_info: string | null;
          escort_count: number | null;
          notes: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vip_id: string;
          destination_site_id?: string | null;
          status: Database["palaro"]["Enums"]["vip_movement_status"];
          estimated_arrival?: string | null;
          actual_arrival?: string | null;
          estimated_departure?: string | null;
          actual_departure?: string | null;
          purpose?: string | null;
          protocol_officer_id?: string | null;
          vehicle_info?: string | null;
          escort_count?: number | null;
          notes?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vip_id?: string;
          destination_site_id?: string | null;
          status?: Database["palaro"]["Enums"]["vip_movement_status"];
          estimated_arrival?: string | null;
          actual_arrival?: string | null;
          estimated_departure?: string | null;
          actual_departure?: string | null;
          purpose?: string | null;
          protocol_officer_id?: string | null;
          vehicle_info?: string | null;
          escort_count?: number | null;
          notes?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      heat_index_readings: {
        Row: {
          id: string;
          site_id: string;
          temperature_c: number;
          humidity_percent: number;
          heat_index_c: number | null;
          danger_level: string | null;
          game_suspension_recommended: boolean | null;
          recorded_by: string | null;
          recorded_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          site_id: string;
          temperature_c: number;
          humidity_percent: number;
          heat_index_c?: number | null;
          danger_level?: string | null;
          game_suspension_recommended?: boolean | null;
          recorded_by?: string | null;
          recorded_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          site_id?: string;
          temperature_c?: number;
          humidity_percent?: number;
          heat_index_c?: number | null;
          danger_level?: string | null;
          game_suspension_recommended?: boolean | null;
          recorded_by?: string | null;
          recorded_at?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      duty_schedules: {
        Row: {
          id: string;
          personnel_id: string;
          site_id: string | null;
          duty_start: string;
          duty_end: string;
          shift_label: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          personnel_id: string;
          site_id?: string | null;
          duty_start: string;
          duty_end: string;
          shift_label?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          personnel_id?: string;
          site_id?: string | null;
          duty_start?: string;
          duty_end?: string;
          shift_label?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      attendance_logs: {
        Row: {
          id: string;
          personnel_id: string;
          site_id: string | null;
          type: Database["palaro"]["Enums"]["attendance_type"];
          scanned_at: string;
          scanned_by: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          personnel_id: string;
          site_id?: string | null;
          type: Database["palaro"]["Enums"]["attendance_type"];
          scanned_at?: string;
          scanned_by?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          personnel_id?: string;
          site_id?: string | null;
          type?: Database["palaro"]["Enums"]["attendance_type"];
          scanned_at?: string;
          scanned_by?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          changes: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          changes?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          changes?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role:
        | "super_admin"
        | "command_center"
        | "medical_field"
        | "medical_ucf"
        | "medical_hospital"
        | "medical_clinic"
        | "protocol_officer"
        | "logistics_officer"
        | "personnel_admin"
        | "venue_manager"
        | "delegation_head"
        | "transportation_dispatcher"
        | "garbage_logger"
        | "food_supplier_admin";
      profile_status: "pending" | "active" | "suspended";
      incident_category:
        | "medical"
        | "utility"
        | "vip_status"
        | "security"
        | "facility"
        | "other";
      incident_severity: "low" | "medium" | "high" | "critical";
      incident_status:
        | "open"
        | "in_progress"
        | "referred"
        | "resolved"
        | "closed";
      referral_status:
        | "pending"
        | "accepted"
        | "in_treatment"
        | "discharged"
        | "admitted"
        | "rejected";
      referral_level:
        | "field_to_ucf"
        | "ucf_to_hospital"
        | "hospital_admit";
      site_type:
        | "billeting_quarter"
        | "playing_venue"
        | "urgent_care_facility"
        | "hospital"
        | "command_center"
        | "clinic";
      vip_movement_status:
        | "eta_logged"
        | "arrived"
        | "etd_logged"
        | "departed"
        | "cancelled";
      attendance_type: "time_in" | "time_out";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
