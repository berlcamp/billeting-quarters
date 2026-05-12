-- =====================================================================
-- PALARONG PAMBANSA DELEGATION MONITORING SYSTEM
-- Database Schema (PostgreSQL / Supabase)
-- Version: 2.0 (palaro custom schema)
-- =====================================================================
-- All tables live under the `palaro` custom schema.
-- All app queries MUST use .schema('palaro') with Supabase client.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS palaro;
SET search_path TO palaro, public;

-- =====================
-- ENUMS
-- =====================

CREATE TYPE palaro.user_role AS ENUM (
  'super_admin',
  'command_center',
  'medical_field',
  'medical_ucf',
  'medical_hospital',
  'medical_clinic',
  'protocol_officer',
  'logistics_officer',
  'personnel_admin',
  'venue_manager',
  'delegation_head',
  'transportation_dispatcher',
  'transportation_head',
  'transportation_driver',
  'garbage_logger',
  'food_supplier_admin',
  'incident_monitoring'
);

CREATE TYPE palaro.incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE palaro.incident_status AS ENUM ('open', 'in_progress', 'referred', 'resolved', 'closed');
CREATE TYPE palaro.incident_category AS ENUM ('medical', 'utility', 'vip_status', 'security', 'facility', 'other');

CREATE TYPE palaro.referral_status AS ENUM ('pending', 'accepted', 'in_treatment', 'discharged', 'admitted', 'rejected');
CREATE TYPE palaro.referral_level AS ENUM ('field_to_ucf', 'ucf_to_hospital', 'hospital_admit');

CREATE TYPE palaro.site_type AS ENUM ('billeting_quarter', 'playing_venue', 'urgent_care_facility', 'hospital', 'command_center', 'clinic');

CREATE TYPE palaro.vip_movement_status AS ENUM ('eta_logged', 'arrived', 'etd_logged', 'departed', 'cancelled');

CREATE TYPE palaro.vehicle_type AS ENUM ('bus', 'van', 'multicab', 'pedicab', 'ambulance', 'service_vehicle');
CREATE TYPE palaro.vehicle_log_direction AS ENUM ('in', 'out');
CREATE TYPE palaro.dispatch_status AS ENUM ('scheduled', 'in_transit', 'completed', 'cancelled');

CREATE TYPE palaro.schedule_status AS ENUM ('booked', 'special_request', 'cancelled', 'completed');

CREATE TYPE palaro.garbage_collection_status AS ENUM ('scheduled', 'collected', 'missed', 'special_request', 'no_collection_needed', 'cancelled');

CREATE TYPE palaro.attendance_type AS ENUM ('time_in', 'time_out');

CREATE TYPE palaro.supply_movement_type AS ENUM ('stock_in', 'stock_out', 'adjustment', 'expired');

CREATE TYPE palaro.profile_status AS ENUM ('pending', 'active', 'suspended');


-- =====================
-- CORE: USERS & ROLES
-- =====================

-- Supabase auth.users is managed automatically; we extend with profiles.
--
-- Design: profiles has its own auto-generated `id` (PK, never null).
-- The link to auth.users is a separate nullable column `auth_user_id`.
-- This supports the invitation flow:
--   1. Admin invites user by email → row created with auth_user_id=NULL
--   2. User signs in with Google → trigger sets auth_user_id = auth.users.id
--   3. App joins palaro.profiles ON auth_user_id = auth.uid()
CREATE TABLE palaro.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  roles palaro.user_role[] NOT NULL DEFAULT '{}',
  status palaro.profile_status NOT NULL DEFAULT 'pending',
  agency TEXT,
  designation TEXT,
  rank TEXT,
  primary_assignment_site_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  invited_by UUID REFERENCES palaro.profiles(id),
  invited_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_roles ON palaro.profiles USING GIN(roles);
CREATE INDEX idx_profiles_active ON palaro.profiles(is_active);
CREATE INDEX idx_profiles_status ON palaro.profiles(status);
CREATE INDEX idx_profiles_email ON palaro.profiles(email);
CREATE INDEX idx_profiles_auth_user ON palaro.profiles(auth_user_id);


-- =====================
-- DELEGATIONS (17 regions of PH)
-- =====================

CREATE TABLE palaro.delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code TEXT UNIQUE NOT NULL,  -- e.g. 'NCR', 'R-X', 'CAR'
  region_name TEXT NOT NULL,         -- 'National Capital Region'
  short_name TEXT,                   -- 'NCR'
  head_of_delegation TEXT,
  contact_number TEXT,
  total_athletes INTEGER DEFAULT 0,
  total_coaches INTEGER DEFAULT 0,
  total_officials INTEGER DEFAULT 0,
  color_hex TEXT,                    -- delegation colors for UI
  logo_url TEXT,
  assigned_bq_id UUID,               -- primary BQ assignment
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================
-- SITES (BQ, PV, Hospitals, UCF, etc.)
-- =====================

CREATE TABLE palaro.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  site_type palaro.site_type NOT NULL,
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  contact_person TEXT,
  contact_number TEXT,
  capacity INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sites_type ON palaro.sites(site_type);
CREATE INDEX idx_sites_active ON palaro.sites(is_active);

-- Now backfill the FK references
ALTER TABLE palaro.profiles ADD CONSTRAINT fk_profiles_site
  FOREIGN KEY (primary_assignment_site_id) REFERENCES palaro.sites(id) ON DELETE SET NULL;
ALTER TABLE palaro.delegations ADD CONSTRAINT fk_delegations_bq
  FOREIGN KEY (assigned_bq_id) REFERENCES palaro.sites(id) ON DELETE SET NULL;


-- =====================
-- INCIDENT REPORTING (universal entry point)
-- =====================

CREATE TABLE palaro.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number TEXT UNIQUE NOT NULL,    -- auto-generated: INC-2025-0001
  category palaro.incident_category NOT NULL,
  severity palaro.incident_severity NOT NULL DEFAULT 'low',
  status palaro.incident_status NOT NULL DEFAULT 'open',

  title TEXT NOT NULL,
  description TEXT,

  -- where it happened
  site_id UUID REFERENCES palaro.sites(id),
  location_details TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),

  -- who's involved
  delegation_id UUID REFERENCES palaro.delegations(id),
  affected_person_name TEXT,
  affected_person_age INTEGER,
  affected_person_role TEXT,  -- 'athlete', 'coach', 'spectator', etc.

  -- reporter
  reported_by UUID REFERENCES palaro.profiles(id),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- resolution
  resolved_by UUID REFERENCES palaro.profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- attachments stored in Supabase Storage
  photo_urls TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_status ON palaro.incidents(status);
CREATE INDEX idx_incidents_severity ON palaro.incidents(severity);
CREATE INDEX idx_incidents_category ON palaro.incidents(category);
CREATE INDEX idx_incidents_site ON palaro.incidents(site_id);
CREATE INDEX idx_incidents_delegation ON palaro.incidents(delegation_id);
CREATE INDEX idx_incidents_reported_at ON palaro.incidents(reported_at DESC);


-- =====================
-- MEDICAL REFERRAL CHAIN
-- =====================

CREATE TABLE palaro.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_number TEXT UNIQUE NOT NULL,    -- REF-2025-0001
  incident_id UUID REFERENCES palaro.incidents(id) ON DELETE CASCADE,

  level palaro.referral_level NOT NULL,
  status palaro.referral_status NOT NULL DEFAULT 'pending',

  from_site_id UUID REFERENCES palaro.sites(id),
  to_site_id UUID NOT NULL REFERENCES palaro.sites(id),

  patient_name TEXT NOT NULL,
  patient_age INTEGER,
  patient_gender TEXT,
  delegation_id UUID REFERENCES palaro.delegations(id),

  chief_complaint TEXT,
  initial_diagnosis TEXT,
  vital_signs JSONB,        -- {bp, hr, temp, rr, spo2}
  treatment_given TEXT,

  referred_by UUID REFERENCES palaro.profiles(id),
  referred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  received_by UUID REFERENCES palaro.profiles(id),
  received_at TIMESTAMPTZ,

  -- after assessment at receiving facility
  assessment_notes TEXT,
  final_diagnosis TEXT,
  treatment_plan TEXT,
  discharge_notes TEXT,
  discharged_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referrals_status ON palaro.referrals(status);
CREATE INDEX idx_referrals_to_site ON palaro.referrals(to_site_id);
CREATE INDEX idx_referrals_incident ON palaro.referrals(incident_id);


-- =====================
-- OPEN CLINIC (walk-in patients)
-- =====================

CREATE TABLE palaro.clinic_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  delegation_id UUID REFERENCES palaro.delegations(id),
  phone TEXT,
  emergency_contact TEXT,
  allergies TEXT,
  medical_history TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE palaro.clinic_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES palaro.clinic_patients(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES palaro.sites(id),
  visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vital_signs JSONB,        -- {bp, hr, temp, rr, spo2, weight, height}
  chief_complaint TEXT,
  diagnosis TEXT,
  prescription TEXT,
  notes TEXT,
  attended_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinic_visits_patient ON palaro.clinic_visits(patient_id);
CREATE INDEX idx_clinic_visits_date ON palaro.clinic_visits(visit_date DESC);


-- =====================
-- MEDICAL SUPPLIES INVENTORY
-- =====================

CREATE TABLE palaro.medical_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,                  -- 'medication', 'consumable', 'equipment'
  unit TEXT NOT NULL,             -- 'pcs', 'box', 'bottle'
  current_stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  expiry_date DATE,
  storage_site_id UUID REFERENCES palaro.sites(id),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE palaro.supply_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id UUID NOT NULL REFERENCES palaro.medical_supplies(id) ON DELETE CASCADE,
  movement_type palaro.supply_movement_type NOT NULL,
  quantity INTEGER NOT NULL,       -- positive for in, negative for out
  reason TEXT,
  reference_type TEXT,             -- 'clinic_visit', 'referral', 'manual'
  reference_id UUID,
  performed_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supply_movements_supply ON palaro.supply_movements(supply_id);


-- =====================
-- HEAT INDEX MONITORING
-- =====================

CREATE TABLE palaro.heat_index_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES palaro.sites(id),
  temperature_c NUMERIC(4, 1) NOT NULL,
  humidity_percent NUMERIC(4, 1) NOT NULL,
  heat_index_c NUMERIC(4, 1),     -- computed
  danger_level TEXT,               -- 'caution', 'extreme_caution', 'danger', 'extreme_danger'
  game_suspension_recommended BOOLEAN DEFAULT FALSE,
  recorded_by UUID REFERENCES palaro.profiles(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_heat_readings_site ON palaro.heat_index_readings(site_id);
CREATE INDEX idx_heat_readings_time ON palaro.heat_index_readings(recorded_at DESC);


-- =====================
-- VIP TRACKING (ETA-ATA / ETD-ATD)
-- =====================

CREATE TABLE palaro.vip_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  title TEXT,                      -- 'Secretary', 'Senator', etc.
  organization TEXT,
  delegation_id UUID REFERENCES palaro.delegations(id),
  contact_number TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE palaro.vip_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vip_id UUID NOT NULL REFERENCES palaro.vip_persons(id) ON DELETE CASCADE,
  destination_site_id UUID REFERENCES palaro.sites(id),
  status palaro.vip_movement_status NOT NULL,

  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  estimated_departure TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,

  purpose TEXT,
  protocol_officer_id UUID REFERENCES palaro.profiles(id),
  vehicle_info TEXT,
  escort_count INTEGER,
  notes TEXT,

  updated_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vip_movements_vip ON palaro.vip_movements(vip_id);
CREATE INDEX idx_vip_movements_status ON palaro.vip_movements(status);


-- =====================
-- VENUE PRACTICE SCHEDULING
-- =====================

CREATE TABLE palaro.venue_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES palaro.sites(id),  -- must be palaro.site_type=playing_venue
  delegation_id UUID NOT NULL REFERENCES palaro.delegations(id),
  sport TEXT,                      -- 'basketball', 'volleyball'
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  status palaro.schedule_status NOT NULL DEFAULT 'booked',
  is_special_request BOOLEAN NOT NULL DEFAULT FALSE,
  special_request_reason TEXT,
  approved_by UUID REFERENCES palaro.profiles(id),
  approved_at TIMESTAMPTZ,
  booked_by UUID REFERENCES palaro.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT venue_schedule_time_check CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_venue_schedules_venue_time ON palaro.venue_schedules(venue_id, scheduled_start);
CREATE INDEX idx_venue_schedules_delegation ON palaro.venue_schedules(delegation_id);
CREATE INDEX idx_venue_schedules_status ON palaro.venue_schedules(status);


-- =====================
-- TRANSPORTATION
-- =====================

CREATE TABLE palaro.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_code TEXT UNIQUE NOT NULL,    -- internal code, used for QR
  plate_number TEXT,
  vehicle_type palaro.vehicle_type NOT NULL,
  make_model TEXT,
  capacity INTEGER,
  driver_name TEXT,
  driver_contact TEXT,
  current_assignment TEXT,
  qr_code_url TEXT,                     -- pre-generated QR image
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicle routes are templates: any vehicle from the dispatch pool can run a
-- route, so vehicle_id is nullable. Multi-stop ordering lives in
-- vehicle_route_stops below; the origin/destination columns are the
-- denormalised first/last stops for fast lookups.
CREATE TABLE palaro.vehicle_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES palaro.vehicles(id) ON DELETE CASCADE,
  route_name TEXT NOT NULL,
  origin_site_id UUID REFERENCES palaro.sites(id),
  destination_site_id UUID REFERENCES palaro.sites(id),
  scheduled_time TIMESTAMPTZ,
  delegation_id UUID REFERENCES palaro.delegations(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE palaro.vehicle_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES palaro.vehicle_routes(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  site_id UUID REFERENCES palaro.sites(id),
  label TEXT,                           -- free-text fallback when site_id is null
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_route_stops_route_order_uq UNIQUE (route_id, stop_order),
  CONSTRAINT vehicle_route_stops_site_or_label CHECK (site_id IS NOT NULL OR label IS NOT NULL)
);

CREATE INDEX idx_vehicle_route_stops_route ON palaro.vehicle_route_stops(route_id, stop_order);

-- A vehicle_dispatch is the umbrella TRIP record for a bus journey. Trip legs
-- and passenger manifest live in their own tables below. Only one trip per
-- vehicle may be in scheduled or in_transit status at a time (partial index).
CREATE TABLE palaro.vehicle_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES palaro.vehicles(id) ON DELETE CASCADE,
  route_id UUID REFERENCES palaro.vehicle_routes(id) ON DELETE SET NULL,
  origin_site_id UUID REFERENCES palaro.sites(id),
  destination_site_id UUID REFERENCES palaro.sites(id),
  scheduled_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatched_by UUID REFERENCES palaro.profiles(id),
  status palaro.dispatch_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  completed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES palaro.profiles(id),
  force_closed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_dispatches_vehicle ON palaro.vehicle_dispatches(vehicle_id, dispatched_at DESC);
CREATE INDEX idx_vehicle_dispatches_status ON palaro.vehicle_dispatches(status);
CREATE UNIQUE INDEX vehicle_dispatches_one_open_per_vehicle
  ON palaro.vehicle_dispatches(vehicle_id)
  WHERE status IN ('scheduled', 'in_transit');

-- vehicle_logs is the raw scan log. dispatch_id and the snapshot columns
-- exist for legacy ad-hoc scans; the new trip flow writes to
-- vehicle_trip_legs instead.
CREATE TABLE palaro.vehicle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES palaro.vehicles(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES palaro.sites(id),
  direction palaro.vehicle_log_direction NOT NULL,
  scanned_by UUID REFERENCES palaro.profiles(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  passenger_count INTEGER,
  notes TEXT,
  dispatch_id UUID REFERENCES palaro.vehicle_dispatches(id) ON DELETE SET NULL,
  delegation_id UUID REFERENCES palaro.delegations(id),
  sport TEXT,
  team_count INTEGER,
  from_site_id UUID REFERENCES palaro.sites(id),
  to_site_id UUID REFERENCES palaro.sites(id)
);

CREATE INDEX idx_vehicle_logs_vehicle ON palaro.vehicle_logs(vehicle_id, scanned_at DESC);
CREATE INDEX idx_vehicle_logs_site ON palaro.vehicle_logs(site_id, scanned_at DESC);
CREATE INDEX idx_vehicle_logs_dispatch ON palaro.vehicle_logs(dispatch_id);
CREATE INDEX idx_vehicle_logs_delegation ON palaro.vehicle_logs(delegation_id);

-- Per-departure→arrival segments of a trip.
CREATE TABLE palaro.vehicle_trip_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES palaro.vehicle_dispatches(id) ON DELETE CASCADE,
  leg_order INTEGER NOT NULL CHECK (leg_order >= 1),
  from_site_id UUID REFERENCES palaro.sites(id),
  from_label TEXT,
  to_site_id UUID REFERENCES palaro.sites(id),
  to_label TEXT,
  departed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  departed_by UUID REFERENCES palaro.profiles(id),
  arrived_at TIMESTAMPTZ,
  arrived_by UUID REFERENCES palaro.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_trip_legs_order_uq UNIQUE (dispatch_id, leg_order),
  CONSTRAINT vehicle_trip_legs_from_site_or_label CHECK (from_site_id IS NOT NULL OR from_label IS NOT NULL),
  CONSTRAINT vehicle_trip_legs_to_site_or_label CHECK (to_site_id IS NOT NULL OR to_label IS NOT NULL)
);

CREATE INDEX idx_vehicle_trip_legs_dispatch ON palaro.vehicle_trip_legs(dispatch_id, leg_order);
CREATE INDEX idx_vehicle_trip_legs_departed_at ON palaro.vehicle_trip_legs(departed_at DESC);
CREATE UNIQUE INDEX vehicle_trip_legs_one_open_per_dispatch
  ON palaro.vehicle_trip_legs(dispatch_id)
  WHERE arrived_at IS NULL;

-- Passenger groups (delegation + team) carried by a trip. Counts drain
-- across legs as groups drop off.
CREATE TABLE palaro.vehicle_trip_manifest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES palaro.vehicle_dispatches(id) ON DELETE CASCADE,
  delegation_id UUID REFERENCES palaro.delegations(id),
  team_name TEXT NOT NULL,
  total_passengers INTEGER NOT NULL CHECK (total_passengers >= 1),
  dropped_off INTEGER NOT NULL DEFAULT 0 CHECK (dropped_off >= 0 AND dropped_off <= total_passengers),
  boarded_at_leg_id UUID REFERENCES palaro.vehicle_trip_legs(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_trip_manifest_dispatch ON palaro.vehicle_trip_manifest(dispatch_id);
CREATE INDEX idx_vehicle_trip_manifest_delegation ON palaro.vehicle_trip_manifest(delegation_id);

-- Per-leg per-group dropoff events (history + reporting).
CREATE TABLE palaro.vehicle_trip_dropoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id UUID NOT NULL REFERENCES palaro.vehicle_trip_legs(id) ON DELETE CASCADE,
  manifest_id UUID NOT NULL REFERENCES palaro.vehicle_trip_manifest(id) ON DELETE CASCADE,
  count INTEGER NOT NULL CHECK (count >= 1),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES palaro.profiles(id),
  notes TEXT
);

CREATE INDEX idx_vehicle_trip_dropoffs_leg ON palaro.vehicle_trip_dropoffs(leg_id);
CREATE INDEX idx_vehicle_trip_dropoffs_manifest ON palaro.vehicle_trip_dropoffs(manifest_id);

-- Fuel consumption inventory per vehicle.
CREATE TABLE palaro.vehicle_fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES palaro.vehicles(id) ON DELETE CASCADE,
  refilled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  liters NUMERIC(10, 2) NOT NULL CHECK (liters >= 0),
  cost_php NUMERIC(12, 2) CHECK (cost_php IS NULL OR cost_php >= 0),
  odometer_km INTEGER CHECK (odometer_km IS NULL OR odometer_km >= 0),
  station TEXT,
  logged_by UUID REFERENCES palaro.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_fuel_logs_vehicle ON palaro.vehicle_fuel_logs(vehicle_id, refilled_at DESC);


-- =====================
-- PERSONNEL, DUTY & ATTENDANCE
-- =====================

-- palaro.personnel = the people we issue ID cards to and scan for attendance.
-- They are NOT auth users (no email, never sign in). System users live in
-- palaro.profiles; the two are deliberately separate populations.
CREATE TABLE palaro.personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  designation TEXT,                              -- job title, e.g. "Lifeguard"
  committee TEXT NOT NULL,                       -- e.g. "Medical Committee"
  area_assigned TEXT,                            -- free-text granular detail
  site_id UUID REFERENCES palaro.sites(id),
  agency TEXT,
  contact_number TEXT,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_personnel_committee ON palaro.personnel(committee);
CREATE INDEX idx_personnel_site ON palaro.personnel(site_id);
CREATE INDEX idx_personnel_active ON palaro.personnel(is_active);
CREATE INDEX idx_personnel_full_name ON palaro.personnel(full_name);

CREATE TABLE palaro.duty_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES palaro.personnel(id) ON DELETE CASCADE,
  site_id UUID REFERENCES palaro.sites(id),
  duty_start TIMESTAMPTZ NOT NULL,
  duty_end TIMESTAMPTZ NOT NULL,
  shift_label TEXT,                -- 'morning', 'evening'
  notes TEXT,
  created_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_duty_personnel_time ON palaro.duty_schedules(personnel_id, duty_start);

CREATE TABLE palaro.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES palaro.personnel(id) ON DELETE CASCADE,
  site_id UUID REFERENCES palaro.sites(id),
  type palaro.attendance_type NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scanned_by UUID REFERENCES palaro.profiles(id),  -- system user who scanned
  notes TEXT
);

CREATE INDEX idx_attendance_personnel ON palaro.attendance_logs(personnel_id, scanned_at DESC);


-- =====================
-- GARBAGE COLLECTION (Phase 3)
-- =====================

CREATE TABLE palaro.garbage_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES palaro.sites(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  collected_at TIMESTAMPTZ,
  status palaro.garbage_collection_status NOT NULL DEFAULT 'scheduled',
  is_special_request BOOLEAN NOT NULL DEFAULT FALSE,
  collector_name TEXT,
  notes TEXT,
  logged_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================
-- FOOD SUPPLY (Phase 3)
-- =====================

CREATE TABLE palaro.food_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  contact_number TEXT,
  email TEXT,
  cuisine_type TEXT,
  capacity_meals_per_day INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE palaro.food_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bq_id UUID NOT NULL REFERENCES palaro.sites(id),
  supplier_id UUID REFERENCES palaro.food_suppliers(id),
  meal_type TEXT,                   -- 'breakfast', 'lunch', 'dinner'
  quantity_meals INTEGER NOT NULL,
  required_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  requested_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================
-- NOTIFICATIONS (universal)
-- =====================

CREATE TABLE palaro.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES palaro.profiles(id),    -- NULL = broadcast
  recipient_role palaro.user_role,                      -- target by role
  title TEXT NOT NULL,
  body TEXT,
  category TEXT NOT NULL,           -- 'incident', 'referral', 'vip', 'heat_index', 'system'
  severity TEXT,                    -- 'info', 'warning', 'critical'
  reference_type TEXT,
  reference_id UUID,
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON palaro.notifications(recipient_id, is_read);
CREATE INDEX idx_notifications_role ON palaro.notifications(recipient_role);
CREATE INDEX idx_notifications_created ON palaro.notifications(created_at DESC);


-- =====================
-- AUDIT LOG (compliance)
-- =====================

CREATE TABLE palaro.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES palaro.profiles(id),
  action TEXT NOT NULL,             -- 'create', 'update', 'delete', 'view'
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON palaro.audit_logs(user_id);
CREATE INDEX idx_audit_entity ON palaro.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON palaro.audit_logs(created_at DESC);


-- =====================
-- TRIGGERS: auto-update updated_at
-- =====================

CREATE OR REPLACE FUNCTION palaro.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON palaro.profiles FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();
CREATE TRIGGER trg_delegations_updated BEFORE UPDATE ON palaro.delegations FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();
CREATE TRIGGER trg_sites_updated BEFORE UPDATE ON palaro.sites FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();
CREATE TRIGGER trg_incidents_updated BEFORE UPDATE ON palaro.incidents FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();
CREATE TRIGGER trg_referrals_updated BEFORE UPDATE ON palaro.referrals FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();
CREATE TRIGGER trg_clinic_patients_updated BEFORE UPDATE ON palaro.clinic_patients FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();
CREATE TRIGGER trg_supplies_updated BEFORE UPDATE ON palaro.medical_supplies FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();
CREATE TRIGGER trg_vip_movements_updated BEFORE UPDATE ON palaro.vip_movements FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();
CREATE TRIGGER trg_venue_schedules_updated BEFORE UPDATE ON palaro.venue_schedules FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON palaro.vehicles FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();


-- =====================
-- AUTO-NUMBER FUNCTIONS
-- =====================

CREATE SEQUENCE palaro.incident_seq START 1;
CREATE SEQUENCE palaro.referral_seq START 1;
CREATE SEQUENCE palaro.patient_seq START 1;

CREATE OR REPLACE FUNCTION palaro.generate_incident_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.incident_number := 'INC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('palaro.incident_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION palaro.generate_referral_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.referral_number := 'REF-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('palaro.referral_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION palaro.generate_patient_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.patient_number := 'PT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('palaro.patient_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incident_number BEFORE INSERT ON palaro.incidents FOR EACH ROW WHEN (NEW.incident_number IS NULL) EXECUTE FUNCTION palaro.generate_incident_number();
CREATE TRIGGER trg_referral_number BEFORE INSERT ON palaro.referrals FOR EACH ROW WHEN (NEW.referral_number IS NULL) EXECUTE FUNCTION palaro.generate_referral_number();
CREATE TRIGGER trg_patient_number BEFORE INSERT ON palaro.clinic_patients FOR EACH ROW WHEN (NEW.patient_number IS NULL) EXECUTE FUNCTION palaro.generate_patient_number();


-- =====================
-- AUTH: Google OAuth + invitation-based authorization
-- =====================

-- Invite-only access enforced at the database + app layer.
-- When Supabase Auth tries to insert a row into auth.users (i.e. a user just completed Google OAuth),
-- this trigger:
--   1. Looks up an active, role-assigned profile by email (a profile a super_admin pre-invited).
--   2. If found and clean: links auth_user_id to auth.users.id and stamps activated_at.
--   3. If found but stale (already linked / suspended / roleless): RAISES — the auth.users INSERT
--      aborts so we surface a useful message instead of silently letting the user in.
--   4. If NOT found: returns NEW silently so the auth.users INSERT proceeds. PPDMS access for
--      unknown emails is still blocked at the app layer by checkAccess()
--      (src/lib/auth/access-check.ts), which returns `not_authorized` when no profile exists.
--      The silent-pass behavior exists so co-tenant apps sharing this Supabase project
--      (e.g. SUMMIT, which has its own auth.users trigger) can sign up their own users
--      without our RAISE aborting the transaction.
-- Function lives in the `palaro` schema and the trigger is prefixed `palaro_` so they
-- never collide with other apps that may share this Supabase instance and have their
-- own `handle_new_auth_user` / `on_auth_user_created` objects.
-- Email match is case-insensitive + whitespace-tolerant. Google normalizes
-- auth.users.email to lowercase, but profile rows can drift to mixed case
-- (admin paste / CSV import). Comparing with LOWER(TRIM(...)) on both sides
-- prevents legitimate invitees from being rejected with the cryptic Supabase
-- "Database error saving new user" message.
CREATE OR REPLACE FUNCTION palaro.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  matched_profile RECORD;
  normalized_email TEXT := LOWER(TRIM(NEW.email));
BEGIN
  SELECT id, status, roles, auth_user_id
  INTO matched_profile
  FROM palaro.profiles
  WHERE LOWER(TRIM(email)) = normalized_email
  LIMIT 1;

  -- Not a PPDMS user. Let the auth.users insert proceed so other apps sharing
  -- this Supabase project can handle their own users. App-level checkAccess()
  -- will block them from PPDMS.
  IF matched_profile.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF matched_profile.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email % is already linked to a different account. Contact your administrator.', NEW.email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF matched_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Account for % is %. Contact your administrator.', NEW.email, matched_profile.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF matched_profile.roles IS NULL OR cardinality(matched_profile.roles) = 0 THEN
    RAISE EXCEPTION 'Account for % has no role assigned. Contact your administrator.', NEW.email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE palaro.profiles
  SET auth_user_id = NEW.id,
      activated_at = NOW(),
      full_name = COALESCE(full_name, NEW.raw_user_meta_data->>'full_name'),
      avatar_url = COALESCE(avatar_url, NEW.raw_user_meta_data->>'avatar_url')
  WHERE id = matched_profile.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = palaro, public;

-- Drop our prior trigger (idempotent — safe if absent). We only ever drop the
-- palaro-prefixed trigger, never anyone else's.
DROP TRIGGER IF EXISTS palaro_on_auth_user_created ON auth.users;

CREATE TRIGGER palaro_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION palaro.handle_new_auth_user();


-- =====================
-- SEED: Super admin (Berl)
-- =====================
-- Pre-create Berl's profile so first Google sign-in instantly activates as super_admin.
-- auth_user_id is NULL until he signs in; the trigger will fill it.

INSERT INTO palaro.profiles (email, full_name, roles, status, invited_at)
VALUES ('berlcamp@gmail.com', 'Berl Camp', ARRAY['super_admin']::palaro.user_role[], 'active', NOW())
ON CONFLICT (email) DO UPDATE
  SET roles = ARRAY['super_admin']::palaro.user_role[], status = 'active';


-- =====================
-- ROW LEVEL SECURITY (basic — refine per role)
-- =====================

ALTER TABLE palaro.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE palaro.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE palaro.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE palaro.clinic_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE palaro.clinic_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE palaro.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's roles array (looks up by auth_user_id).
CREATE OR REPLACE FUNCTION palaro.current_user_roles()
RETURNS palaro.user_role[] AS $$
  SELECT roles FROM palaro.profiles
  WHERE auth_user_id = auth.uid() AND status = 'active';
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = palaro, public;

-- Convenience predicate for RLS readability.
CREATE OR REPLACE FUNCTION palaro.current_user_has_role(target palaro.user_role)
RETURNS BOOLEAN AS $$
  SELECT target = ANY(palaro.current_user_roles());
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = palaro, public;

-- Helper function: get current user's profile id
CREATE OR REPLACE FUNCTION palaro.current_profile_id()
RETURNS UUID AS $$
  SELECT id FROM palaro.profiles
  WHERE auth_user_id = auth.uid() AND status = 'active';
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = palaro, public;

-- IMPORTANT: Expose the palaro schema to the API
-- In Supabase Dashboard: Settings → API → Exposed schemas, add 'palaro'.
-- Without this, the JS client cannot query .schema('palaro').

-- Profiles: read own, super_admin and command_center read all
CREATE POLICY "Users can read own profile" ON palaro.profiles FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Super admin reads all profiles" ON palaro.profiles FOR SELECT USING (palaro.current_user_has_role('super_admin'));
CREATE POLICY "Command center reads all profiles" ON palaro.profiles FOR SELECT USING (palaro.current_user_has_role('command_center'));

-- Incidents: any authenticated active user can read; medical+admin roles can edit
CREATE POLICY "Authenticated reads incidents" ON palaro.incidents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Reporters create incidents" ON palaro.incidents FOR INSERT WITH CHECK (reported_by = palaro.current_profile_id());
CREATE POLICY "Admins update incidents" ON palaro.incidents FOR UPDATE USING (
  palaro.current_user_roles() && ARRAY[
    'super_admin', 'command_center',
    'medical_field', 'medical_ucf', 'medical_hospital'
  ]::palaro.user_role[]
);

-- Notifications: recipient sees own, plus role broadcasts
CREATE POLICY "User sees own notifications" ON palaro.notifications FOR SELECT USING (
  recipient_id = palaro.current_profile_id() OR recipient_role = ANY(palaro.current_user_roles())
);


-- =====================
-- GRANTS (so the API roles can access the palaro schema)
-- =====================

GRANT USAGE ON SCHEMA palaro TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA palaro TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA palaro TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA palaro TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA palaro
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA palaro
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA palaro
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- (Add more policies as you build out features.)

-- =====================
-- DONE — apply with `supabase db push` or paste into SQL editor
-- =====================
