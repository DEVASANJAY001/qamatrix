-- ============================================================
-- QA MATRIX APPLICATION - FULL DATABASE SCHEMA
-- Generated: 2026-04-16
-- ============================================================

-- ============================================================
-- TABLE 1: defect_data
-- Stores raw defect data uploaded from Excel/CSV
-- ============================================================
CREATE TABLE public.defect_data (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  defect_code TEXT NOT NULL DEFAULT ''::text,
  defect_location_code TEXT NOT NULL DEFAULT ''::text,
  defect_description_details TEXT NOT NULL DEFAULT ''::text,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  gravity TEXT DEFAULT ''::text
);

ALTER TABLE public.defect_data ADD PRIMARY KEY (id);

-- ============================================================
-- TABLE 2: dvx_defects
-- Stores DVX defect records (filtered: gravity S/P/A only)
-- Used for dual pairing (code-based & semantic AI matching)
-- ============================================================
CREATE TABLE public.dvx_defects (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  location_code TEXT NOT NULL DEFAULT ''::text,
  location_details TEXT NOT NULL DEFAULT ''::text,
  defect_code TEXT NOT NULL DEFAULT ''::text,
  defect_description TEXT NOT NULL DEFAULT ''::text,
  defect_description_details TEXT NOT NULL DEFAULT ''::text,
  gravity TEXT NOT NULL DEFAULT ''::text,
  quantity INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT ''::text,
  responsible TEXT NOT NULL DEFAULT ''::text,
  pof_family TEXT NOT NULL DEFAULT ''::text,
  pof_code TEXT NOT NULL DEFAULT ''::text,
  pairing_status TEXT NOT NULL DEFAULT 'not_paired'::text,
  pairing_method TEXT,
  match_score REAL,
  qa_matrix_sno INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dvx_defects ADD PRIMARY KEY (id);

-- Performance indexes for pairing operations
CREATE INDEX idx_dvx_defects_defect_code ON public.dvx_defects USING btree (defect_code);
CREATE INDEX idx_dvx_defects_location_code ON public.dvx_defects USING btree (location_code);
CREATE INDEX idx_dvx_defects_pairing_status ON public.dvx_defects USING btree (pairing_status);
CREATE INDEX idx_dvx_defects_gravity ON public.dvx_defects USING btree (gravity);

-- ============================================================
-- TABLE 3: final_defect
-- Stores final/resolved defect records
-- ============================================================
CREATE TABLE public.final_defect (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  defect_code TEXT NOT NULL DEFAULT ''::text,
  defect_location_code TEXT NOT NULL DEFAULT ''::text,
  defect_description_details TEXT NOT NULL DEFAULT ''::text,
  source TEXT NOT NULL DEFAULT ''::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  gravity TEXT DEFAULT ''::text
);

ALTER TABLE public.final_defect ADD PRIMARY KEY (id);

-- ============================================================
-- TABLE 4: qa_matrix_entries
-- Core QA Matrix table with 38+ columns
-- Stores trim/chassis/final scores, control ratings,
-- guaranteed quality, statuses, and action items
-- ============================================================
CREATE TABLE public.qa_matrix_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  s_no INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT ''::text,
  operation_station TEXT NOT NULL DEFAULT ''::text,
  designation TEXT NOT NULL DEFAULT ''::text,
  concern TEXT NOT NULL DEFAULT ''::text,
  defect_rating INTEGER NOT NULL DEFAULT 1,
  defect_code TEXT NOT NULL DEFAULT ''::text,
  defect_location_code TEXT NOT NULL DEFAULT ''::text,
  recurrence INTEGER NOT NULL DEFAULT 0,
  weekly_recurrence JSONB NOT NULL DEFAULT '[]'::jsonb,
  recurrence_count_plus_defect INTEGER NOT NULL DEFAULT 0,
  trim JSONB NOT NULL DEFAULT '{}'::jsonb,
  chassis JSONB NOT NULL DEFAULT '{}'::jsonb,
  final JSONB NOT NULL DEFAULT '{}'::jsonb,
  q_control JSONB NOT NULL DEFAULT '{}'::jsonb,
  q_control_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  control_rating JSONB NOT NULL DEFAULT '{}'::jsonb,
  guaranteed_quality JSONB NOT NULL DEFAULT '{}'::jsonb,
  workstation_status TEXT NOT NULL DEFAULT 'NG'::text,
  mfg_status TEXT NOT NULL DEFAULT 'NG'::text,
  plant_status TEXT NOT NULL DEFAULT 'NG'::text,
  mfg_action TEXT NOT NULL DEFAULT ''::text,
  resp TEXT NOT NULL DEFAULT ''::text,
  target TEXT NOT NULL DEFAULT ''::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  repair_time CHARACTER VARYING,
  dvm_pqg CHARACTER,
  dvr_dvt CHARACTER,
  product_audit_sca CHARACTER,
  warranty CHARACTER VARYING,
  reoccurrence_flag CHARACTER VARYING,
  recorded_defect JSONB,
  implementation_date CHARACTER VARYING,
  audit_date_name CHARACTER VARYING,
  detection_flags JSONB DEFAULT '{}'::jsonb,
  outside_process JSONB DEFAULT '{}'::jsonb,
  team_leader CHARACTER VARYING
);

ALTER TABLE public.qa_matrix_entries ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX qa_matrix_entries_s_no_unique ON public.qa_matrix_entries USING btree (s_no);

-- ============================================================
-- TABLE 5: qa_matrix_entries_backup
-- Backup/archive of QA Matrix entries (all columns nullable)
-- ============================================================
CREATE TABLE public.qa_matrix_entries_backup (
  id UUID,
  s_no INTEGER,
  source TEXT,
  operation_station TEXT,
  designation TEXT,
  concern TEXT,
  defect_rating INTEGER,
  defect_code TEXT,
  defect_location_code TEXT,
  recurrence INTEGER,
  weekly_recurrence JSONB,
  recurrence_count_plus_defect INTEGER,
  trim JSONB,
  chassis JSONB,
  final JSONB,
  q_control JSONB,
  q_control_detail JSONB,
  control_rating JSONB,
  guaranteed_quality JSONB,
  workstation_status TEXT,
  mfg_status TEXT,
  plant_status TEXT,
  mfg_action TEXT,
  resp TEXT,
  target TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  repair_time CHARACTER VARYING,
  dvm_pqg CHARACTER,
  dvr_dvt CHARACTER,
  product_audit_sca CHARACTER,
  warranty CHARACTER VARYING,
  reoccurrence_flag CHARACTER VARYING,
  recorded_defect JSONB,
  implementation_date CHARACTER VARYING,
  audit_date_name CHARACTER VARYING,
  detection_flags JSONB,
  outside_process JSONB,
  team_leader CHARACTER VARYING
);

-- ============================================================
-- TABLE 6: qa_matrix_snapshots
-- Weekly/periodic snapshots of the entire QA Matrix state
-- ============================================================
CREATE TABLE public.qa_matrix_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.qa_matrix_snapshots ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX qa_matrix_snapshots_snapshot_date_key ON public.qa_matrix_snapshots USING btree (snapshot_date);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- defect_data
ALTER TABLE public.defect_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read defect_data" ON public.defect_data FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert defect_data" ON public.defect_data FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public delete defect_data" ON public.defect_data FOR DELETE TO public USING (true);

-- dvx_defects
ALTER TABLE public.dvx_defects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read dvx_defects" ON public.dvx_defects FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert dvx_defects" ON public.dvx_defects FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update dvx_defects" ON public.dvx_defects FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete dvx_defects" ON public.dvx_defects FOR DELETE TO public USING (true);

-- final_defect
ALTER TABLE public.final_defect ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read final_defect" ON public.final_defect FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert final_defect" ON public.final_defect FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update final_defect" ON public.final_defect FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete final_defect" ON public.final_defect FOR DELETE TO public USING (true);

-- qa_matrix_entries
ALTER TABLE public.qa_matrix_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read qa_matrix" ON public.qa_matrix_entries FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert qa_matrix" ON public.qa_matrix_entries FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update qa_matrix" ON public.qa_matrix_entries FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete qa_matrix" ON public.qa_matrix_entries FOR DELETE TO public USING (true);

-- qa_matrix_snapshots
ALTER TABLE public.qa_matrix_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all" ON public.qa_matrix_snapshots FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================================
-- END OF SCHEMA
-- ============================================================
