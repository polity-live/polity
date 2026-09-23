SELECT pg_advisory_xact_lock(1886351981);

CREATE TABLE IF NOT EXISTS public.studio_whiteboard_storage_manifest (
  bucket_id text NOT NULL DEFAULT 'studio',
  storage_path text NOT NULL,
  removed_at bigint,
  PRIMARY KEY (bucket_id, storage_path)
);
ALTER TABLE public.studio_whiteboard_storage_manifest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studio_whiteboard_storage_manifest FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_whiteboard_storage_manifest TO service_role;

INSERT INTO public.studio_published_media_archive(id,storage_path,file_name)
SELECT e.id,e.storage_path,e.file_name
FROM public.studio_export e
JOIN public.studio_project p ON p.id=e.project_id
WHERE p.kind='whiteboard' AND e.status='completed'
  AND e.storage_path IS NOT NULL AND e.file_name IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.statement s
    WHERE s.image_url='/api/studio/published-media/' || e.id::text
       OR s.video_url='/api/studio/published-media/' || e.id::text)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.studio_whiteboard_storage_manifest(bucket_id,storage_path)
SELECT 'studio', storage_path FROM public.studio_asset a
JOIN public.studio_project p ON p.id=a.project_id
WHERE p.kind='whiteboard'
UNION
SELECT 'studio', e.storage_path FROM public.studio_export e
JOIN public.studio_project p ON p.id=e.project_id
WHERE p.kind='whiteboard' AND e.storage_path IS NOT NULL
UNION
SELECT 'studio', o.name FROM storage.objects o
JOIN public.studio_project p ON o.bucket_id='studio' AND o.name LIKE p.id::text || '/%'
WHERE p.kind='whiteboard'
ON CONFLICT DO NOTHING;

DELETE FROM public.studio_whiteboard_storage_manifest m
USING public.studio_published_media_archive a
WHERE m.bucket_id='studio' AND m.storage_path=a.storage_path;

DELETE FROM public.canvas_vote v USING public.canvas_proposal cp, public.studio_project p
WHERE v.proposal_id=cp.id AND cp.project_id=p.id AND p.kind='whiteboard';
DELETE FROM public.canvas_comment c USING public.studio_project p
WHERE c.project_id=p.id AND p.kind='whiteboard';
DELETE FROM public.studio_asset a USING public.studio_project p
WHERE a.project_id=p.id AND p.kind='whiteboard';
DELETE FROM public.canvas_proposal cp USING public.studio_project p
WHERE cp.project_id=p.id AND p.kind='whiteboard';
DELETE FROM public.canvas_receipt c USING public.studio_project p
WHERE c.project_id=p.id AND p.kind='whiteboard';
DELETE FROM public.canvas_library c USING public.studio_project p
WHERE c.project_id=p.id AND p.kind='whiteboard';
DELETE FROM public.studio_project WHERE kind='whiteboard';

ALTER TABLE public.studio_project DROP CONSTRAINT studio_project_kind_check;
ALTER TABLE public.studio_project ADD CONSTRAINT studio_project_kind_check
  CHECK (kind IN ('single','event','carousel','story','video','campaign'));
