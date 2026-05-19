CREATE INDEX idx_role_event ON public.role USING btree (event_id);

CREATE INDEX idx_role_scope ON public.role USING btree (scope);


