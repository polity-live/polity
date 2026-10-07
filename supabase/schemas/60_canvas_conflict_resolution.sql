ALTER TABLE public.canvas_proposal ADD COLUMN resolves_id uuid REFERENCES public.canvas_proposal(id);
ALTER TABLE public.canvas_proposal DROP CONSTRAINT canvas_proposal_application_check;
ALTER TABLE public.canvas_proposal ADD CONSTRAINT canvas_proposal_application_check CHECK(application IN ('pending','applied','conflict','not_applicable','superseded'));
