create table "public"."app_tutorial_run" (
  "id" uuid not null,
  "user_id" uuid not null,
  "status" text not null default 'active'::text,
  "current_checkpoint_id" text not null,
  "fixture_version" integer not null,
  "revision" integer not null default 0,
  "started_at" timestamp with time zone not null default now(),
  "last_activity_at" timestamp with time zone not null default now(),
  "expires_at" timestamp with time zone not null default (now() + '30 days'::interval)
);

alter table "public"."app_tutorial_run" enable row level security;

create table "public"."app_tutorial_checkpoint_effect" (
  "run_id" uuid not null,
  "checkpoint_id" text not null,
  "effect_key" text not null,
  "applied_at" timestamp with time zone not null default now()
);

alter table "public"."app_tutorial_checkpoint_effect" enable row level security;

create table "public"."app_tutorial_entity" (
  "run_id" uuid not null,
  "alias" text not null,
  "entity_type" text not null,
  "entity_id" uuid not null
);

alter table "public"."app_tutorial_entity" enable row level security;

alter table "public"."user_preference"
  drop constraint if exists "user_preference_app_onboarding_completed_steps_array";
alter table "public"."user_preference"
  drop column if exists "app_onboarding_completed_steps";
alter table "public"."user_preference"
  drop column if exists "app_onboarding_completed_at";
alter table "public"."user_preference"
  add column "app_tutorial_completed_at" timestamp with time zone;

update public."user"
set first_name = 'Assistent Aria',
    last_name = '& Kai',
    bio = 'Assistent Aria & Kai helps you navigate Polity.'
where id = 'a12a0000-0000-4000-a000-000000000001';

create or replace function public.ensure_aria_kai_user()
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  assistant_user_id constant uuid :=
    'a12a0000-0000-4000-a000-000000000001'::uuid;
begin
  insert into public."user" (
    id, email, handle, first_name, last_name, bio, visibility
  )
  values (
    assistant_user_id,
    'aria-kai-assistants@polity.com',
    'aria-kai',
    'Assistent Aria',
    '& Kai',
    'Assistent Aria & Kai helps you navigate Polity.',
    'public'
  )
  on conflict (id) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      bio = excluded.bio;

  insert into public.notification_setting (user_id)
  values (assistant_user_id)
  on conflict (user_id) do nothing;

  insert into public.user_preference (user_id)
  values (assistant_user_id)
  on conflict (user_id) do nothing;

  return assistant_user_id;
end;
$$;

create or replace function public.ensure_assistant_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  assistant_user_id uuid;
  assistant_conversation_id uuid;
  welcome_message constant text :=
    'Hey! Assistent Aria & Kai is here to help you navigate Polity. How can I help?';
begin
  assistant_user_id := public.ensure_aria_kai_user();

  select id
  into assistant_conversation_id
  from public.conversation
  where assistant_for_user_id = target_user_id
  limit 1;

  if assistant_conversation_id is null then
    insert into public.conversation (
      type, name, status, last_message_at, assistant_for_user_id, requested_by_id
    )
    values (
      'direct',
      'Assistent Aria & Kai',
      'accepted',
      now(),
      target_user_id,
      assistant_user_id
    )
    returning id into assistant_conversation_id;
  else
    update public.conversation
    set name = 'Assistent Aria & Kai'
    where id = assistant_conversation_id;
  end if;

  insert into public.conversation_participant (
    conversation_id, user_id, joined_at, last_read_at, left_at
  )
  values (
    assistant_conversation_id, target_user_id, now(), null, null
  )
  on conflict (conversation_id, user_id) do nothing;

  insert into public.conversation_participant (
    conversation_id, user_id, joined_at, last_read_at, left_at
  )
  values (
    assistant_conversation_id, assistant_user_id, now(), now(), null
  )
  on conflict (conversation_id, user_id) do nothing;

  if not exists (
    select 1
    from public.message
    where conversation_id = assistant_conversation_id
      and sender_id = assistant_user_id
  ) then
    insert into public.message (
      conversation_id, sender_id, content, is_read,
      created_at, updated_at, deleted_at
    )
    values (
      assistant_conversation_id, assistant_user_id, welcome_message, false,
      now(), now(), null
    );
  end if;

  update public.conversation
  set last_message_at = coalesce(
    (
      select max(created_at)
      from public.message
      where conversation_id = assistant_conversation_id
    ),
    last_message_at,
    now()
  )
  where id = assistant_conversation_id;

  return assistant_conversation_id;
end;
$$;

alter table "public"."user" add column "tutorial_run_id" uuid;
alter table "public"."group" add column "tutorial_run_id" uuid;
alter table "public"."event" add column "tutorial_run_id" uuid;
alter table "public"."amendment" add column "tutorial_run_id" uuid;
alter table "public"."blog" add column "tutorial_run_id" uuid;
alter table "public"."statement" add column "tutorial_run_id" uuid;
alter table "public"."todo" add column "tutorial_run_id" uuid;
alter table "public"."notification" add column "tutorial_run_id" uuid;
alter table "public"."conversation" add column "tutorial_run_id" uuid;
alter table "public"."payment" add column "tutorial_run_id" uuid;
alter table "public"."search_document" add column "tutorial_run_id" uuid;

create unique index app_tutorial_run_pkey on public.app_tutorial_run using btree (id);
create unique index app_tutorial_run_one_open_per_user
  on public.app_tutorial_run using btree (user_id)
  where status = any (array['active'::text, 'paused'::text]);
create index app_tutorial_run_expires_at_idx
  on public.app_tutorial_run using btree (expires_at);
create unique index app_tutorial_checkpoint_effect_pkey
  on public.app_tutorial_checkpoint_effect using btree (run_id, checkpoint_id, effect_key);
create unique index app_tutorial_entity_pkey
  on public.app_tutorial_entity using btree (run_id, alias);
create unique index app_tutorial_entity_run_type_id_key
  on public.app_tutorial_entity using btree (run_id, entity_type, entity_id);

alter table "public"."app_tutorial_run"
  add constraint "app_tutorial_run_pkey" primary key using index "app_tutorial_run_pkey";
alter table "public"."app_tutorial_checkpoint_effect"
  add constraint "app_tutorial_checkpoint_effect_pkey"
  primary key using index "app_tutorial_checkpoint_effect_pkey";
alter table "public"."app_tutorial_entity"
  add constraint "app_tutorial_entity_pkey" primary key using index "app_tutorial_entity_pkey";
alter table "public"."app_tutorial_entity"
  add constraint "app_tutorial_entity_run_type_id_key"
  unique using index "app_tutorial_entity_run_type_id_key";
alter table "public"."app_tutorial_run"
  add constraint "app_tutorial_run_status_check"
  check (status = any (array['active'::text, 'paused'::text])) not valid;
alter table "public"."app_tutorial_run" validate constraint "app_tutorial_run_status_check";
alter table "public"."app_tutorial_run"
  add constraint "app_tutorial_run_user_id_fkey"
  foreign key (user_id) references public."user"(id) on delete cascade not valid;
alter table "public"."app_tutorial_run" validate constraint "app_tutorial_run_user_id_fkey";
alter table "public"."app_tutorial_checkpoint_effect"
  add constraint "app_tutorial_checkpoint_effect_run_id_fkey"
  foreign key (run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."app_tutorial_checkpoint_effect"
  validate constraint "app_tutorial_checkpoint_effect_run_id_fkey";
alter table "public"."app_tutorial_entity"
  add constraint "app_tutorial_entity_run_id_fkey"
  foreign key (run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."app_tutorial_entity"
  validate constraint "app_tutorial_entity_run_id_fkey";

alter table "public"."user"
  add constraint "user_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."group"
  add constraint "group_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."event"
  add constraint "event_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."amendment"
  add constraint "amendment_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."blog"
  add constraint "blog_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."statement"
  add constraint "statement_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."todo"
  add constraint "todo_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."notification"
  add constraint "notification_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."conversation"
  add constraint "conversation_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."payment"
  add constraint "payment_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;
alter table "public"."search_document"
  add constraint "search_document_tutorial_run_id_fkey"
  foreign key (tutorial_run_id) references public.app_tutorial_run(id) on delete cascade not valid;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user', 'group', 'event', 'amendment', 'blog', 'statement', 'todo',
    'notification', 'conversation', 'payment', 'search_document'
  ]
  loop
    execute format(
      'alter table public.%I validate constraint %I',
      table_name,
      table_name || '_tutorial_run_id_fkey'
    );
    execute format(
      'create index %I on public.%I using btree (tutorial_run_id)',
      table_name || '_tutorial_run_id_idx',
      table_name
    );
  end loop;
end $$;

create or replace function public.tag_app_tutorial_search_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.search_document
  set tutorial_run_id = new.tutorial_run_id
  where entity_type = TG_ARGV[0] and entity_id = new.id;
  return new;
end;
$$;

create trigger zz_tag_user_tutorial_search_document
after insert or update of tutorial_run_id on public."user"
for each row execute function public.tag_app_tutorial_search_document('user');
create trigger zz_tag_group_tutorial_search_document
after insert or update of tutorial_run_id on public."group"
for each row execute function public.tag_app_tutorial_search_document('group');
create trigger zz_tag_event_tutorial_search_document
after insert or update of tutorial_run_id on public.event
for each row execute function public.tag_app_tutorial_search_document('event');
create trigger zz_tag_amendment_tutorial_search_document
after insert or update of tutorial_run_id on public.amendment
for each row execute function public.tag_app_tutorial_search_document('amendment');
create trigger zz_tag_blog_tutorial_search_document
after insert or update of tutorial_run_id on public.blog
for each row execute function public.tag_app_tutorial_search_document('blog');
create trigger zz_tag_statement_tutorial_search_document
after insert or update of tutorial_run_id on public.statement
for each row execute function public.tag_app_tutorial_search_document('statement');
create trigger zz_tag_todo_tutorial_search_document
after insert or update of tutorial_run_id on public.todo
for each row execute function public.tag_app_tutorial_search_document('todo');

create policy "app_tutorial_run_owner_select"
  on "public"."app_tutorial_run" for select to authenticated
  using (user_id = auth.uid());
create policy "app_tutorial_entity_owner_select"
  on "public"."app_tutorial_entity" for select to authenticated
  using (
    exists (
      select 1 from public.app_tutorial_run run
      where run.id = run_id and run.user_id = auth.uid()
    )
  );
create policy "app_tutorial_service_role_all"
  on "public"."app_tutorial_run" for all to service_role
  using (true) with check (true);
create policy "app_tutorial_effect_service_role_all"
  on "public"."app_tutorial_checkpoint_effect" for all to service_role
  using (true) with check (true);
create policy "app_tutorial_entity_service_role_all"
  on "public"."app_tutorial_entity" for all to service_role
  using (true) with check (true);

create or replace function public.cleanup_expired_app_tutorial_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.amendment_process_run process_run
  using public.amendment amendment, public.app_tutorial_run tutorial_run
  where process_run.amendment_id = amendment.id
    and amendment.tutorial_run_id = tutorial_run.id
    and tutorial_run.expires_at <= now();

  delete from public.app_tutorial_run where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_app_tutorial_runs() from public;
grant execute on function public.cleanup_expired_app_tutorial_runs() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'cleanup-expired-app-tutorial-runs'
  ) then
    perform cron.schedule(
      'cleanup-expired-app-tutorial-runs',
      '17 3 * * *',
      'SELECT public.cleanup_expired_app_tutorial_runs();'
    );
  end if;
end
$$;
