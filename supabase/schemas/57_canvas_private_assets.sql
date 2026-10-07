ALTER TABLE public.studio_asset ADD COLUMN workspace_id uuid REFERENCES public.canvas_proposal(id);
CREATE INDEX studio_asset_workspace ON public.studio_asset(workspace_id) WHERE workspace_id IS NOT NULL;
