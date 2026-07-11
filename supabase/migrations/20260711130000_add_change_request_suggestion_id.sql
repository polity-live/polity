alter table public.change_request
  add column if not exists suggestion_id text;

comment on column public.change_request.suggestion_id is
  'Durable ID of the document suggestion represented by this change request.';

create index if not exists idx_change_request_suggestion_id
  on public.change_request (suggestion_id)
  where suggestion_id is not null;
