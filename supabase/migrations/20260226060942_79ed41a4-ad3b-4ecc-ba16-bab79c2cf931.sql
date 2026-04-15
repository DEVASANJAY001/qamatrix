
CREATE TABLE public.dvx_defects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_code TEXT NOT NULL DEFAULT '',
  location_details TEXT NOT NULL DEFAULT '',
  defect_code TEXT NOT NULL DEFAULT '',
  defect_description TEXT NOT NULL DEFAULT '',
  defect_description_details TEXT NOT NULL DEFAULT '',
  gravity TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT '',
  responsible TEXT NOT NULL DEFAULT '',
  pof_family TEXT NOT NULL DEFAULT '',
  pof_code TEXT NOT NULL DEFAULT '',
  pairing_status TEXT NOT NULL DEFAULT 'not_paired',
  pairing_method TEXT,
  match_score REAL,
  qa_matrix_sno INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_dvx_defects_defect_code ON public.dvx_defects (defect_code);
CREATE INDEX idx_dvx_defects_location_code ON public.dvx_defects (location_code);
CREATE INDEX idx_dvx_defects_pairing_status ON public.dvx_defects (pairing_status);
CREATE INDEX idx_dvx_defects_gravity ON public.dvx_defects (gravity);

ALTER TABLE public.dvx_defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read dvx_defects" ON public.dvx_defects FOR SELECT USING (true);
CREATE POLICY "Allow public insert dvx_defects" ON public.dvx_defects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update dvx_defects" ON public.dvx_defects FOR UPDATE USING (true);
CREATE POLICY "Allow public delete dvx_defects" ON public.dvx_defects FOR DELETE USING (true);
