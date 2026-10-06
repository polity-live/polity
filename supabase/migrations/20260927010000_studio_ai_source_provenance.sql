SELECT pg_advisory_xact_lock(1886351981);
ALTER TABLE public.studio_project
  ADD COLUMN source_references jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(source_references) = 'array');

UPDATE public.studio_project p SET source_references = (
  SELECT coalesce(jsonb_agg(DISTINCT source.ref), '[]'::jsonb)
  FROM public.canvas_proposal c
  CROSS JOIN LATERAL jsonb_array_elements(c.ai_sources) AS source(ref)
  WHERE c.project_id = p.id AND c.origin = 'ai' AND c.application = 'applied'
);
