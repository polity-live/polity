alter table public.ai_skill
  add column if not exists enabled boolean not null default true;