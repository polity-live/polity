create table public.studio_editor_action (
 id uuid primary key,project_id uuid not null references public.studio_project(id) on delete cascade,
 actor_id uuid not null references public."user"(id) on delete cascade,request_id text not null unique,
 name text not null,input jsonb not null,result jsonb,created_at bigint not null
);
alter table public.studio_editor_action enable row level security;
revoke all on public.studio_editor_action from anon,authenticated;
grant all on public.studio_editor_action to service_role;
