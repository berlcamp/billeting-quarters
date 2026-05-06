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
          roles: Database["palaro"]["Enums"]["user_role"][];
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
          roles?: Database["palaro"]["Enums"]["user_role"][];
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
          roles?: Database["palaro"]["Enums"]["user_role"][];
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
      clinic_patients: {
        Row: {
          id: string;
          patient_number: string;
          full_name: string;
          age: number | null;
          gender: string | null;
          delegation_id: string | null;
          phone: string | null;
          emergency_contact: string | null;
          allergies: string | null;
          medical_history: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_number?: string;
          full_name: string;
          age?: number | null;
          gender?: string | null;
          delegation_id?: string | null;
          phone?: string | null;
          emergency_contact?: string | null;
          allergies?: string | null;
          medical_history?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_number?: string;
          full_name?: string;
          age?: number | null;
          gender?: string | null;
          delegation_id?: string | null;
          phone?: string | null;
          emergency_contact?: string | null;
          allergies?: string | null;
          medical_history?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clinic_visits: {
        Row: {
          id: string;
          patient_id: string;
          site_id: string;
          visit_date: string;
          vital_signs: Json | null;
          chief_complaint: string | null;
          diagnosis: string | null;
          prescription: string | null;
          notes: string | null;
          attended_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          site_id: string;
          visit_date?: string;
          vital_signs?: Json | null;
          chief_complaint?: string | null;
          diagnosis?: string | null;
          prescription?: string | null;
          notes?: string | null;
          attended_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          site_id?: string;
          visit_date?: string;
          vital_signs?: Json | null;
          chief_complaint?: string | null;
          diagnosis?: string | null;
          prescription?: string | null;
          notes?: string | null;
          attended_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      personnel: {
        Row: {
          id: string;
          full_name: string;
          designation: string | null;
          committee: string;
          area_assigned: string | null;
          site_id: string | null;
          agency: string | null;
          contact_number: string | null;
          photo_url: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          designation?: string | null;
          committee: string;
          area_assigned?: string | null;
          site_id?: string | null;
          agency?: string | null;
          contact_number?: string | null;
          photo_url?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          designation?: string | null;
          committee?: string;
          area_assigned?: string | null;
          site_id?: string | null;
          agency?: string | null;
          contact_number?: string | null;
          photo_url?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
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
      vehicles: {
        Row: {
          id: string;
          vehicle_code: string;
          plate_number: string | null;
          vehicle_type: Database["palaro"]["Enums"]["vehicle_type"];
          make_model: string | null;
          capacity: number | null;
          driver_name: string | null;
          driver_contact: string | null;
          current_assignment: string | null;
          qr_code_url: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_code: string;
          plate_number?: string | null;
          vehicle_type: Database["palaro"]["Enums"]["vehicle_type"];
          make_model?: string | null;
          capacity?: number | null;
          driver_name?: string | null;
          driver_contact?: string | null;
          current_assignment?: string | null;
          qr_code_url?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_code?: string;
          plate_number?: string | null;
          vehicle_type?: Database["palaro"]["Enums"]["vehicle_type"];
          make_model?: string | null;
          capacity?: number | null;
          driver_name?: string | null;
          driver_contact?: string | null;
          current_assignment?: string | null;
          qr_code_url?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicle_routes: {
        Row: {
          id: string;
          vehicle_id: string;
          route_name: string;
          origin_site_id: string | null;
          destination_site_id: string | null;
          scheduled_time: string | null;
          delegation_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          route_name: string;
          origin_site_id?: string | null;
          destination_site_id?: string | null;
          scheduled_time?: string | null;
          delegation_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          route_name?: string;
          origin_site_id?: string | null;
          destination_site_id?: string | null;
          scheduled_time?: string | null;
          delegation_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      vehicle_logs: {
        Row: {
          id: string;
          vehicle_id: string;
          site_id: string;
          direction: Database["palaro"]["Enums"]["vehicle_log_direction"];
          scanned_by: string | null;
          scanned_at: string;
          passenger_count: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          site_id: string;
          direction: Database["palaro"]["Enums"]["vehicle_log_direction"];
          scanned_by?: string | null;
          scanned_at?: string;
          passenger_count?: number | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          site_id?: string;
          direction?: Database["palaro"]["Enums"]["vehicle_log_direction"];
          scanned_by?: string | null;
          scanned_at?: string;
          passenger_count?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      venue_schedules: {
        Row: {
          id: string;
          venue_id: string;
          delegation_id: string;
          sport: string | null;
          scheduled_start: string;
          scheduled_end: string;
          status: Database["palaro"]["Enums"]["schedule_status"];
          is_special_request: boolean;
          special_request_reason: string | null;
          approved_by: string | null;
          approved_at: string | null;
          booked_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          delegation_id: string;
          sport?: string | null;
          scheduled_start: string;
          scheduled_end: string;
          status?: Database["palaro"]["Enums"]["schedule_status"];
          is_special_request?: boolean;
          special_request_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          booked_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          delegation_id?: string;
          sport?: string | null;
          scheduled_start?: string;
          scheduled_end?: string;
          status?: Database["palaro"]["Enums"]["schedule_status"];
          is_special_request?: boolean;
          special_request_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          booked_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      medical_supplies: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          unit: string;
          current_stock: number;
          reorder_level: number;
          expiry_date: string | null;
          storage_site_id: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          unit: string;
          current_stock?: number;
          reorder_level?: number;
          expiry_date?: string | null;
          storage_site_id?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string | null;
          unit?: string;
          current_stock?: number;
          reorder_level?: number;
          expiry_date?: string | null;
          storage_site_id?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      supply_movements: {
        Row: {
          id: string;
          supply_id: string;
          movement_type: Database["palaro"]["Enums"]["supply_movement_type"];
          quantity: number;
          reason: string | null;
          reference_type: string | null;
          reference_id: string | null;
          performed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          supply_id: string;
          movement_type: Database["palaro"]["Enums"]["supply_movement_type"];
          quantity: number;
          reason?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          performed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          supply_id?: string;
          movement_type?: Database["palaro"]["Enums"]["supply_movement_type"];
          quantity?: number;
          reason?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          performed_by?: string | null;
          created_at?: string;
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
      garbage_collections: {
        Row: {
          id: string;
          site_id: string;
          scheduled_at: string;
          collected_at: string | null;
          status: Database["palaro"]["Enums"]["garbage_collection_status"];
          is_special_request: boolean;
          collector_name: string | null;
          collector_id: string | null;
          schedule_rule_id: string | null;
          notes: string | null;
          logged_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          scheduled_at: string;
          collected_at?: string | null;
          status?: Database["palaro"]["Enums"]["garbage_collection_status"];
          is_special_request?: boolean;
          collector_name?: string | null;
          collector_id?: string | null;
          schedule_rule_id?: string | null;
          notes?: string | null;
          logged_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          scheduled_at?: string;
          collected_at?: string | null;
          status?: Database["palaro"]["Enums"]["garbage_collection_status"];
          is_special_request?: boolean;
          collector_name?: string | null;
          collector_id?: string | null;
          schedule_rule_id?: string | null;
          notes?: string | null;
          logged_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      garbage_collectors: {
        Row: {
          id: string;
          swm_coordinator_name: string | null;
          city_enro_coordinator_name: string | null;
          driver_name: string | null;
          vehicle_description: string | null;
          contact_number: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          swm_coordinator_name?: string | null;
          city_enro_coordinator_name?: string | null;
          driver_name?: string | null;
          vehicle_description?: string | null;
          contact_number?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          swm_coordinator_name?: string | null;
          city_enro_coordinator_name?: string | null;
          driver_name?: string | null;
          vehicle_description?: string | null;
          contact_number?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      garbage_schedule_rules: {
        Row: {
          id: string;
          collector_id: string;
          site_id: string;
          days_of_week: number[];
          time_of_day: string;
          time_of_day_pm: string | null;
          is_active: boolean;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collector_id: string;
          site_id: string;
          days_of_week: number[];
          time_of_day: string;
          time_of_day_pm?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collector_id?: string;
          site_id?: string;
          days_of_week?: number[];
          time_of_day?: string;
          time_of_day_pm?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      food_suppliers: {
        Row: {
          id: string;
          name: string;
          contact_person: string | null;
          contact_number: string | null;
          email: string | null;
          business_category: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_person?: string | null;
          contact_number?: string | null;
          email?: string | null;
          business_category?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_person?: string | null;
          contact_number?: string | null;
          email?: string | null;
          business_category?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      food_requests: {
        Row: {
          id: string;
          bq_id: string;
          supplier_id: string | null;
          item_name: string;
          unit: string;
          quantity: number;
          required_at: string;
          status: string;
          notes: string | null;
          requested_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bq_id: string;
          supplier_id?: string | null;
          item_name: string;
          unit: string;
          quantity: number;
          required_at: string;
          status?: string;
          notes?: string | null;
          requested_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          bq_id?: string;
          supplier_id?: string | null;
          item_name?: string;
          unit?: string;
          quantity?: number;
          required_at?: string;
          status?: string;
          notes?: string | null;
          requested_by?: string | null;
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
      vehicle_type:
        | "bus"
        | "van"
        | "multicab"
        | "pedicab"
        | "ambulance"
        | "service_vehicle";
      vehicle_log_direction: "in" | "out";
      schedule_status:
        | "booked"
        | "special_request"
        | "cancelled"
        | "completed";
      supply_movement_type:
        | "stock_in"
        | "stock_out"
        | "adjustment"
        | "expired";
      garbage_collection_status:
        | "scheduled"
        | "collected"
        | "missed"
        | "special_request";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
