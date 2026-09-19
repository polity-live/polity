ALTER TABLE public.collaboration_control ADD COLUMN activated_at bigint;
ALTER TABLE public.collaboration_checkpoint ADD COLUMN branch_id uuid;
ALTER TABLE public.collaboration_checkpoint DROP CONSTRAINT collaboration_checkpoint_pkey;
ALTER TABLE public.collaboration_checkpoint ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.collaboration_checkpoint ADD CONSTRAINT collaboration_checkpoint_reference UNIQUE NULLS NOT DISTINCT(migration_id,kind,entity_id,branch_id);
CREATE TABLE public.collaboration_migration_attempt (
  id uuid PRIMARY KEY,
  status text NOT NULL CHECK(status IN ('prepared','aborted','active','compatibility')),
  source_manifest jsonb NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
-- Verified legacy archives. Missing historical evidence blocks conversion;
-- the converter never substitutes today's content for an earlier ballot.
CREATE TABLE public.collaboration_legacy_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid REFERENCES public.vote(id),
  kind text NOT NULL,
  entity_id uuid NOT NULL,
  branch_id uuid,
  version_id uuid REFERENCES public.document_version(id),
  projection jsonb NOT NULL,
  checksum text NOT NULL,
  provenance text NOT NULL CHECK(length(provenance)>0),
  UNIQUE NULLS NOT DISTINCT(vote_id,kind,entity_id,branch_id)
);
ALTER TABLE public.collaboration_migration_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_legacy_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collaboration_migration_attempt,public.collaboration_legacy_snapshot FROM anon,authenticated;
GRANT ALL ON public.collaboration_migration_attempt,public.collaboration_legacy_snapshot TO service_role;

CREATE OR REPLACE FUNCTION public.collaboration_immutable_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('polity.collaboration_clear_staging',true)='on' AND
     EXISTS(SELECT 1 FROM collaboration_control WHERE singleton AND phase<>'active' AND activated_at IS NULL) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'collaboration_revision_immutable' USING ERRCODE='55000';
END $$;
CREATE TRIGGER collaboration_legacy_snapshot_immutable BEFORE UPDATE OR DELETE ON public.collaboration_legacy_snapshot FOR EACH ROW EXECUTE FUNCTION public.collaboration_immutable_revision();
