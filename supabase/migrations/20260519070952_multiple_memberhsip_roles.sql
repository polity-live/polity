drop policy "service_role_all" on "public"."event_position";

drop policy "service_role_all" on "public"."event_position_holder";

drop policy "service_role_all" on "public"."position";

drop policy "service_role_all" on "public"."position_holder_history";

revoke delete on table "public"."event_position" from "anon";

revoke insert on table "public"."event_position" from "anon";

revoke references on table "public"."event_position" from "anon";

revoke select on table "public"."event_position" from "anon";

revoke trigger on table "public"."event_position" from "anon";

revoke truncate on table "public"."event_position" from "anon";

revoke update on table "public"."event_position" from "anon";

revoke delete on table "public"."event_position" from "authenticated";

revoke insert on table "public"."event_position" from "authenticated";

revoke references on table "public"."event_position" from "authenticated";

revoke select on table "public"."event_position" from "authenticated";

revoke trigger on table "public"."event_position" from "authenticated";

revoke truncate on table "public"."event_position" from "authenticated";

revoke update on table "public"."event_position" from "authenticated";

revoke delete on table "public"."event_position" from "service_role";

revoke insert on table "public"."event_position" from "service_role";

revoke references on table "public"."event_position" from "service_role";

revoke select on table "public"."event_position" from "service_role";

revoke trigger on table "public"."event_position" from "service_role";

revoke truncate on table "public"."event_position" from "service_role";

revoke update on table "public"."event_position" from "service_role";

revoke delete on table "public"."event_position_holder" from "anon";

revoke insert on table "public"."event_position_holder" from "anon";

revoke references on table "public"."event_position_holder" from "anon";

revoke select on table "public"."event_position_holder" from "anon";

revoke trigger on table "public"."event_position_holder" from "anon";

revoke truncate on table "public"."event_position_holder" from "anon";

revoke update on table "public"."event_position_holder" from "anon";

revoke delete on table "public"."event_position_holder" from "authenticated";

revoke insert on table "public"."event_position_holder" from "authenticated";

revoke references on table "public"."event_position_holder" from "authenticated";

revoke select on table "public"."event_position_holder" from "authenticated";

revoke trigger on table "public"."event_position_holder" from "authenticated";

revoke truncate on table "public"."event_position_holder" from "authenticated";

revoke update on table "public"."event_position_holder" from "authenticated";

revoke delete on table "public"."event_position_holder" from "service_role";

revoke insert on table "public"."event_position_holder" from "service_role";

revoke references on table "public"."event_position_holder" from "service_role";

revoke select on table "public"."event_position_holder" from "service_role";

revoke trigger on table "public"."event_position_holder" from "service_role";

revoke truncate on table "public"."event_position_holder" from "service_role";

revoke update on table "public"."event_position_holder" from "service_role";

revoke delete on table "public"."position" from "anon";

revoke insert on table "public"."position" from "anon";

revoke references on table "public"."position" from "anon";

revoke select on table "public"."position" from "anon";

revoke trigger on table "public"."position" from "anon";

revoke truncate on table "public"."position" from "anon";

revoke update on table "public"."position" from "anon";

revoke delete on table "public"."position" from "authenticated";

revoke insert on table "public"."position" from "authenticated";

revoke references on table "public"."position" from "authenticated";

revoke select on table "public"."position" from "authenticated";

revoke trigger on table "public"."position" from "authenticated";

revoke truncate on table "public"."position" from "authenticated";

revoke update on table "public"."position" from "authenticated";

revoke delete on table "public"."position" from "service_role";

revoke insert on table "public"."position" from "service_role";

revoke references on table "public"."position" from "service_role";

revoke select on table "public"."position" from "service_role";

revoke trigger on table "public"."position" from "service_role";

revoke truncate on table "public"."position" from "service_role";

revoke update on table "public"."position" from "service_role";

revoke delete on table "public"."position_holder_history" from "anon";

revoke insert on table "public"."position_holder_history" from "anon";

revoke references on table "public"."position_holder_history" from "anon";

revoke select on table "public"."position_holder_history" from "anon";

revoke trigger on table "public"."position_holder_history" from "anon";

revoke truncate on table "public"."position_holder_history" from "anon";

revoke update on table "public"."position_holder_history" from "anon";

revoke delete on table "public"."position_holder_history" from "authenticated";

revoke insert on table "public"."position_holder_history" from "authenticated";

revoke references on table "public"."position_holder_history" from "authenticated";

revoke select on table "public"."position_holder_history" from "authenticated";

revoke trigger on table "public"."position_holder_history" from "authenticated";

revoke truncate on table "public"."position_holder_history" from "authenticated";

revoke update on table "public"."position_holder_history" from "authenticated";

revoke delete on table "public"."position_holder_history" from "service_role";

revoke insert on table "public"."position_holder_history" from "service_role";

revoke references on table "public"."position_holder_history" from "service_role";

revoke select on table "public"."position_holder_history" from "service_role";

revoke trigger on table "public"."position_holder_history" from "service_role";

revoke truncate on table "public"."position_holder_history" from "service_role";

revoke update on table "public"."position_holder_history" from "service_role";

alter table "public"."event_participant" drop constraint "event_participant_role_id_fkey";

alter table "public"."event_position" drop constraint "event_position_event_id_fkey";

alter table "public"."event_position_holder" drop constraint "event_position_holder_position_id_fkey";

alter table "public"."event_position_holder" drop constraint "event_position_holder_user_id_fkey";

alter table "public"."group_membership" drop constraint "group_membership_role_id_fkey";

alter table "public"."position" drop constraint "position_group_id_fkey";

alter table "public"."position_holder_history" drop constraint "position_holder_history_position_id_fkey";

alter table "public"."position_holder_history" drop constraint "position_holder_history_user_id_fkey";

alter table "public"."event_position" drop constraint "event_position_pkey";

alter table "public"."event_position_holder" drop constraint "event_position_holder_pkey";

alter table "public"."position" drop constraint "position_pkey";

alter table "public"."position_holder_history" drop constraint "position_holder_history_pkey";

drop index if exists "public"."event_position_holder_pkey";

drop index if exists "public"."event_position_pkey";

drop index if exists "public"."idx_event_position_event";

drop index if exists "public"."idx_event_position_holder_position";

drop index if exists "public"."idx_position_group";

drop index if exists "public"."idx_position_holder_history_position";

drop index if exists "public"."idx_position_holder_history_user";

drop index if exists "public"."position_holder_history_pkey";

drop index if exists "public"."position_pkey";

drop table "public"."event_position";

drop table "public"."event_position_holder";

drop table "public"."position";

drop table "public"."position_holder_history";


  create table "public"."event_participant_role" (
    "id" uuid not null default gen_random_uuid(),
    "event_participant_id" uuid not null,
    "role_id" uuid not null,
    "assigned_at" timestamp with time zone not null default now(),
    "assigned_by_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."event_participant_role" enable row level security;


  create table "public"."group_membership_role" (
    "id" uuid not null default gen_random_uuid(),
    "group_membership_id" uuid not null,
    "role_id" uuid not null,
    "assigned_at" timestamp with time zone not null default now(),
    "assigned_by_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_membership_role" enable row level security;


  create table "public"."role_holder_history" (
    "id" uuid not null default gen_random_uuid(),
    "role_id" uuid not null,
    "user_id" uuid not null,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "reason" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."role_holder_history" enable row level security;

alter table "public"."election" drop column "position_id";

alter table "public"."election" add column "role_id" uuid;

alter table "public"."event_participant" drop column "role_id";

alter table "public"."group_membership" drop column "role_id";

alter table "public"."role" add column "assignment_mode" text not null default 'assigned'::text;

alter table "public"."role" add column "is_recurring" boolean not null default false;

alter table "public"."role" add column "recurrence_days" integer[];

alter table "public"."role" add column "recurrence_end_date" timestamp with time zone;

alter table "public"."role" add column "recurrence_interval" integer;

alter table "public"."role" add column "recurrence_pattern" text;

alter table "public"."role" add column "recurrence_rule" text;

alter table "public"."role" add column "scheduled_revote_date" timestamp with time zone;

alter table "public"."role" add column "term_start_date" timestamp with time zone;

alter table "public"."role" add column "visibility" text not null default 'public'::text;

CREATE UNIQUE INDEX event_participant_role_event_participant_id_role_id_key ON public.event_participant_role USING btree (event_participant_id, role_id);

CREATE UNIQUE INDEX event_participant_role_pkey ON public.event_participant_role USING btree (id);

CREATE UNIQUE INDEX group_membership_role_group_membership_id_role_id_key ON public.group_membership_role USING btree (group_membership_id, role_id);

CREATE UNIQUE INDEX group_membership_role_pkey ON public.group_membership_role USING btree (id);

CREATE INDEX idx_election_role_id ON public.election USING btree (role_id);

CREATE INDEX idx_event_participant_role_assigned_by ON public.event_participant_role USING btree (assigned_by_id);

CREATE INDEX idx_event_participant_role_participant ON public.event_participant_role USING btree (event_participant_id);

CREATE INDEX idx_event_participant_role_role ON public.event_participant_role USING btree (role_id);

CREATE UNIQUE INDEX idx_event_participant_unique_event_user ON public.event_participant USING btree (event_id, user_id) WHERE (instance_date IS NULL);

CREATE UNIQUE INDEX idx_event_participant_unique_event_user_instance ON public.event_participant USING btree (event_id, user_id, instance_date) WHERE (instance_date IS NOT NULL);

CREATE INDEX idx_group_membership_role_assigned_by ON public.group_membership_role USING btree (assigned_by_id);

CREATE INDEX idx_group_membership_role_membership ON public.group_membership_role USING btree (group_membership_id);

CREATE INDEX idx_group_membership_role_role ON public.group_membership_role USING btree (role_id);

CREATE INDEX idx_role_holder_history_role ON public.role_holder_history USING btree (role_id);

CREATE INDEX idx_role_holder_history_user ON public.role_holder_history USING btree (user_id);

CREATE UNIQUE INDEX role_holder_history_pkey ON public.role_holder_history USING btree (id);

alter table "public"."event_participant_role" add constraint "event_participant_role_pkey" PRIMARY KEY using index "event_participant_role_pkey";

alter table "public"."group_membership_role" add constraint "group_membership_role_pkey" PRIMARY KEY using index "group_membership_role_pkey";

alter table "public"."role_holder_history" add constraint "role_holder_history_pkey" PRIMARY KEY using index "role_holder_history_pkey";

alter table "public"."election" add constraint "election_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE SET NULL not valid;

alter table "public"."election" validate constraint "election_role_id_fkey";

alter table "public"."event_participant_role" add constraint "event_participant_role_assigned_by_id_fkey" FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."event_participant_role" validate constraint "event_participant_role_assigned_by_id_fkey";

alter table "public"."event_participant_role" add constraint "event_participant_role_event_participant_id_fkey" FOREIGN KEY (event_participant_id) REFERENCES public.event_participant(id) ON DELETE CASCADE not valid;

alter table "public"."event_participant_role" validate constraint "event_participant_role_event_participant_id_fkey";

alter table "public"."event_participant_role" add constraint "event_participant_role_event_participant_id_role_id_key" UNIQUE using index "event_participant_role_event_participant_id_role_id_key";

alter table "public"."event_participant_role" add constraint "event_participant_role_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."event_participant_role" validate constraint "event_participant_role_role_id_fkey";

alter table "public"."group_membership_role" add constraint "group_membership_role_assigned_by_id_fkey" FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_membership_role" validate constraint "group_membership_role_assigned_by_id_fkey";

alter table "public"."group_membership_role" add constraint "group_membership_role_group_membership_id_fkey" FOREIGN KEY (group_membership_id) REFERENCES public.group_membership(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_role" validate constraint "group_membership_role_group_membership_id_fkey";

alter table "public"."group_membership_role" add constraint "group_membership_role_group_membership_id_role_id_key" UNIQUE using index "group_membership_role_group_membership_id_role_id_key";

alter table "public"."group_membership_role" add constraint "group_membership_role_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."group_membership_role" validate constraint "group_membership_role_role_id_fkey";

alter table "public"."role" add constraint "role_assignment_mode_check" CHECK ((assignment_mode = ANY (ARRAY['assigned'::text, 'elected'::text]))) not valid;

alter table "public"."role" validate constraint "role_assignment_mode_check";

alter table "public"."role" add constraint "role_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'authenticated'::text, 'private'::text]))) not valid;

alter table "public"."role" validate constraint "role_visibility_check";

alter table "public"."role_holder_history" add constraint "role_holder_history_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."role_holder_history" validate constraint "role_holder_history_role_id_fkey";

alter table "public"."role_holder_history" add constraint "role_holder_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."role_holder_history" validate constraint "role_holder_history_user_id_fkey";

grant delete on table "public"."event_participant_role" to "anon";

grant insert on table "public"."event_participant_role" to "anon";

grant references on table "public"."event_participant_role" to "anon";

grant select on table "public"."event_participant_role" to "anon";

grant trigger on table "public"."event_participant_role" to "anon";

grant truncate on table "public"."event_participant_role" to "anon";

grant update on table "public"."event_participant_role" to "anon";

grant delete on table "public"."event_participant_role" to "authenticated";

grant insert on table "public"."event_participant_role" to "authenticated";

grant references on table "public"."event_participant_role" to "authenticated";

grant select on table "public"."event_participant_role" to "authenticated";

grant trigger on table "public"."event_participant_role" to "authenticated";

grant truncate on table "public"."event_participant_role" to "authenticated";

grant update on table "public"."event_participant_role" to "authenticated";

grant delete on table "public"."event_participant_role" to "service_role";

grant insert on table "public"."event_participant_role" to "service_role";

grant references on table "public"."event_participant_role" to "service_role";

grant select on table "public"."event_participant_role" to "service_role";

grant trigger on table "public"."event_participant_role" to "service_role";

grant truncate on table "public"."event_participant_role" to "service_role";

grant update on table "public"."event_participant_role" to "service_role";

grant delete on table "public"."group_membership_role" to "anon";

grant insert on table "public"."group_membership_role" to "anon";

grant references on table "public"."group_membership_role" to "anon";

grant select on table "public"."group_membership_role" to "anon";

grant trigger on table "public"."group_membership_role" to "anon";

grant truncate on table "public"."group_membership_role" to "anon";

grant update on table "public"."group_membership_role" to "anon";

grant delete on table "public"."group_membership_role" to "authenticated";

grant insert on table "public"."group_membership_role" to "authenticated";

grant references on table "public"."group_membership_role" to "authenticated";

grant select on table "public"."group_membership_role" to "authenticated";

grant trigger on table "public"."group_membership_role" to "authenticated";

grant truncate on table "public"."group_membership_role" to "authenticated";

grant update on table "public"."group_membership_role" to "authenticated";

grant delete on table "public"."group_membership_role" to "service_role";

grant insert on table "public"."group_membership_role" to "service_role";

grant references on table "public"."group_membership_role" to "service_role";

grant select on table "public"."group_membership_role" to "service_role";

grant trigger on table "public"."group_membership_role" to "service_role";

grant truncate on table "public"."group_membership_role" to "service_role";

grant update on table "public"."group_membership_role" to "service_role";

grant delete on table "public"."role_holder_history" to "anon";

grant insert on table "public"."role_holder_history" to "anon";

grant references on table "public"."role_holder_history" to "anon";

grant select on table "public"."role_holder_history" to "anon";

grant trigger on table "public"."role_holder_history" to "anon";

grant truncate on table "public"."role_holder_history" to "anon";

grant update on table "public"."role_holder_history" to "anon";

grant delete on table "public"."role_holder_history" to "authenticated";

grant insert on table "public"."role_holder_history" to "authenticated";

grant references on table "public"."role_holder_history" to "authenticated";

grant select on table "public"."role_holder_history" to "authenticated";

grant trigger on table "public"."role_holder_history" to "authenticated";

grant truncate on table "public"."role_holder_history" to "authenticated";

grant update on table "public"."role_holder_history" to "authenticated";

grant delete on table "public"."role_holder_history" to "service_role";

grant insert on table "public"."role_holder_history" to "service_role";

grant references on table "public"."role_holder_history" to "service_role";

grant select on table "public"."role_holder_history" to "service_role";

grant trigger on table "public"."role_holder_history" to "service_role";

grant truncate on table "public"."role_holder_history" to "service_role";

grant update on table "public"."role_holder_history" to "service_role";


  create policy "service_role_all"
  on "public"."event_participant_role"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_membership_role"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."role_holder_history"
  as permissive
  for all
  to service_role
using (true);



