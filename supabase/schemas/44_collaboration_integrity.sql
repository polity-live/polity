ALTER TABLE public.collaboration_document ADD COLUMN integrity_error text;
ALTER TABLE public.collaboration_document ADD COLUMN integrity_checked_at bigint;
