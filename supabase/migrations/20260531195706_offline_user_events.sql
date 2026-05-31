
  create table "public"."election_offline_tally" (
    "id" uuid not null default gen_random_uuid(),
    "election_id" uuid not null,
    "phase" text not null,
    "candidate_id" uuid not null,
    "count" integer not null default 0,
    "updated_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."election_offline_tally" enable row level security;


  create table "public"."event_offline_participant" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "group_offline_member_id" uuid,
    "source_type" text not null,
    "first_name" text not null,
    "last_name" text not null,
    "reason_not_signed_up" text,
    "connected_user_id" uuid,
    "attendance_status" text not null default 'listed'::text,
    "participation_channel" text not null default 'offline'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."event_offline_participant" enable row level security;


  create table "public"."group_offline_member" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "first_name" text not null,
    "last_name" text not null,
    "reason_not_signed_up" text,
    "connected_user_id" uuid,
    "created_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_offline_member" enable row level security;


  create table "public"."vote_offline_tally" (
    "id" uuid not null default gen_random_uuid(),
    "vote_id" uuid not null,
    "phase" text not null,
    "choice_id" uuid not null,
    "count" integer not null default 0,
    "updated_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."vote_offline_tally" enable row level security;

alter table "public"."election" add column "election_mode" text not null default 'single'::text;

alter table "public"."election" add column "seat_count" integer not null default 1;

alter table "public"."event" add column "attendance_mode" text not null default 'offline'::text;

alter table "public"."event" add column "delegate_election_mode" text not null default 'list'::text;

CREATE UNIQUE INDEX election_offline_tally_election_id_phase_candidate_id_key ON public.election_offline_tally USING btree (election_id, phase, candidate_id);

CREATE UNIQUE INDEX election_offline_tally_pkey ON public.election_offline_tally USING btree (id);

CREATE UNIQUE INDEX event_offline_participant_pkey ON public.event_offline_participant USING btree (id);

CREATE UNIQUE INDEX group_offline_member_pkey ON public.group_offline_member USING btree (id);

CREATE INDEX idx_election_offline_tally_candidate ON public.election_offline_tally USING btree (candidate_id);

CREATE INDEX idx_election_offline_tally_election ON public.election_offline_tally USING btree (election_id);

CREATE INDEX idx_event_offline_participant_connected_user ON public.event_offline_participant USING btree (connected_user_id);

CREATE INDEX idx_event_offline_participant_event ON public.event_offline_participant USING btree (event_id);

CREATE INDEX idx_event_offline_participant_group_offline_member ON public.event_offline_participant USING btree (group_offline_member_id);

CREATE UNIQUE INDEX idx_event_offline_participant_unique_connected_user ON public.event_offline_participant USING btree (event_id, connected_user_id) WHERE (connected_user_id IS NOT NULL);

CREATE INDEX idx_group_offline_member_connected_user ON public.group_offline_member USING btree (connected_user_id);

CREATE INDEX idx_group_offline_member_group ON public.group_offline_member USING btree (group_id);

CREATE UNIQUE INDEX idx_group_offline_member_unique_connected_user ON public.group_offline_member USING btree (group_id, connected_user_id) WHERE (connected_user_id IS NOT NULL);

CREATE INDEX idx_vote_offline_tally_choice ON public.vote_offline_tally USING btree (choice_id);

CREATE INDEX idx_vote_offline_tally_vote ON public.vote_offline_tally USING btree (vote_id);

CREATE UNIQUE INDEX vote_offline_tally_pkey ON public.vote_offline_tally USING btree (id);

CREATE UNIQUE INDEX vote_offline_tally_vote_id_phase_choice_id_key ON public.vote_offline_tally USING btree (vote_id, phase, choice_id);

alter table "public"."election_offline_tally" add constraint "election_offline_tally_pkey" PRIMARY KEY using index "election_offline_tally_pkey";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_pkey" PRIMARY KEY using index "event_offline_participant_pkey";

alter table "public"."group_offline_member" add constraint "group_offline_member_pkey" PRIMARY KEY using index "group_offline_member_pkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_pkey" PRIMARY KEY using index "vote_offline_tally_pkey";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES public.election_candidate(id) ON DELETE CASCADE not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_candidate_id_fkey";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_count_check" CHECK ((count >= 0)) not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_count_check";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_election_id_fkey" FOREIGN KEY (election_id) REFERENCES public.election(id) ON DELETE CASCADE not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_election_id_fkey";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_election_id_phase_candidate_id_key" UNIQUE using index "election_offline_tally_election_id_phase_candidate_id_key";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_phase_check" CHECK ((phase = ANY (ARRAY['indicative'::text, 'final'::text]))) not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_phase_check";

alter table "public"."election_offline_tally" add constraint "election_offline_tally_updated_by_id_fkey" FOREIGN KEY (updated_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."election_offline_tally" validate constraint "election_offline_tally_updated_by_id_fkey";

alter table "public"."event" add constraint "event_attendance_mode_check" CHECK ((attendance_mode = ANY (ARRAY['online'::text, 'hybrid'::text, 'offline'::text]))) not valid;

alter table "public"."event" validate constraint "event_attendance_mode_check";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_attendance_status_check" CHECK ((attendance_status = ANY (ARRAY['listed'::text, 'confirmed'::text]))) not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_attendance_status_check";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_connected_user_id_fkey" FOREIGN KEY (connected_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_connected_user_id_fkey";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_event_id_fkey";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_group_offline_member_id_fkey" FOREIGN KEY (group_offline_member_id) REFERENCES public.group_offline_member(id) ON DELETE SET NULL not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_group_offline_member_id_fkey";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_participation_channel_check" CHECK ((participation_channel = ANY (ARRAY['online'::text, 'offline'::text]))) not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_participation_channel_check";

alter table "public"."event_offline_participant" add constraint "event_offline_participant_source_type_check" CHECK ((source_type = ANY (ARRAY['group_member'::text, 'event_extra'::text]))) not valid;

alter table "public"."event_offline_participant" validate constraint "event_offline_participant_source_type_check";

alter table "public"."group_offline_member" add constraint "group_offline_member_connected_user_id_fkey" FOREIGN KEY (connected_user_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_offline_member" validate constraint "group_offline_member_connected_user_id_fkey";

alter table "public"."group_offline_member" add constraint "group_offline_member_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_offline_member" validate constraint "group_offline_member_created_by_id_fkey";

alter table "public"."group_offline_member" add constraint "group_offline_member_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_member" validate constraint "group_offline_member_group_id_fkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_choice_id_fkey" FOREIGN KEY (choice_id) REFERENCES public.vote_choice(id) ON DELETE CASCADE not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_choice_id_fkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_count_check" CHECK ((count >= 0)) not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_count_check";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_phase_check" CHECK ((phase = ANY (ARRAY['indicative'::text, 'final'::text]))) not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_phase_check";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_updated_by_id_fkey" FOREIGN KEY (updated_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_updated_by_id_fkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_vote_id_fkey" FOREIGN KEY (vote_id) REFERENCES public.vote(id) ON DELETE CASCADE not valid;

alter table "public"."vote_offline_tally" validate constraint "vote_offline_tally_vote_id_fkey";

alter table "public"."vote_offline_tally" add constraint "vote_offline_tally_vote_id_phase_choice_id_key" UNIQUE using index "vote_offline_tally_vote_id_phase_choice_id_key";

grant delete on table "public"."election_offline_tally" to "anon";

grant insert on table "public"."election_offline_tally" to "anon";

grant references on table "public"."election_offline_tally" to "anon";

grant select on table "public"."election_offline_tally" to "anon";

grant trigger on table "public"."election_offline_tally" to "anon";

grant truncate on table "public"."election_offline_tally" to "anon";

grant update on table "public"."election_offline_tally" to "anon";

grant delete on table "public"."election_offline_tally" to "authenticated";

grant insert on table "public"."election_offline_tally" to "authenticated";

grant references on table "public"."election_offline_tally" to "authenticated";

grant select on table "public"."election_offline_tally" to "authenticated";

grant trigger on table "public"."election_offline_tally" to "authenticated";

grant truncate on table "public"."election_offline_tally" to "authenticated";

grant update on table "public"."election_offline_tally" to "authenticated";

grant delete on table "public"."election_offline_tally" to "service_role";

grant insert on table "public"."election_offline_tally" to "service_role";

grant references on table "public"."election_offline_tally" to "service_role";

grant select on table "public"."election_offline_tally" to "service_role";

grant trigger on table "public"."election_offline_tally" to "service_role";

grant truncate on table "public"."election_offline_tally" to "service_role";

grant update on table "public"."election_offline_tally" to "service_role";

grant delete on table "public"."event_offline_participant" to "anon";

grant insert on table "public"."event_offline_participant" to "anon";

grant references on table "public"."event_offline_participant" to "anon";

grant select on table "public"."event_offline_participant" to "anon";

grant trigger on table "public"."event_offline_participant" to "anon";

grant truncate on table "public"."event_offline_participant" to "anon";

grant update on table "public"."event_offline_participant" to "anon";

grant delete on table "public"."event_offline_participant" to "authenticated";

grant insert on table "public"."event_offline_participant" to "authenticated";

grant references on table "public"."event_offline_participant" to "authenticated";

grant select on table "public"."event_offline_participant" to "authenticated";

grant trigger on table "public"."event_offline_participant" to "authenticated";

grant truncate on table "public"."event_offline_participant" to "authenticated";

grant update on table "public"."event_offline_participant" to "authenticated";

grant delete on table "public"."event_offline_participant" to "service_role";

grant insert on table "public"."event_offline_participant" to "service_role";

grant references on table "public"."event_offline_participant" to "service_role";

grant select on table "public"."event_offline_participant" to "service_role";

grant trigger on table "public"."event_offline_participant" to "service_role";

grant truncate on table "public"."event_offline_participant" to "service_role";

grant update on table "public"."event_offline_participant" to "service_role";

grant delete on table "public"."group_offline_member" to "anon";

grant insert on table "public"."group_offline_member" to "anon";

grant references on table "public"."group_offline_member" to "anon";

grant select on table "public"."group_offline_member" to "anon";

grant trigger on table "public"."group_offline_member" to "anon";

grant truncate on table "public"."group_offline_member" to "anon";

grant update on table "public"."group_offline_member" to "anon";

grant delete on table "public"."group_offline_member" to "authenticated";

grant insert on table "public"."group_offline_member" to "authenticated";

grant references on table "public"."group_offline_member" to "authenticated";

grant select on table "public"."group_offline_member" to "authenticated";

grant trigger on table "public"."group_offline_member" to "authenticated";

grant truncate on table "public"."group_offline_member" to "authenticated";

grant update on table "public"."group_offline_member" to "authenticated";

grant delete on table "public"."group_offline_member" to "service_role";

grant insert on table "public"."group_offline_member" to "service_role";

grant references on table "public"."group_offline_member" to "service_role";

grant select on table "public"."group_offline_member" to "service_role";

grant trigger on table "public"."group_offline_member" to "service_role";

grant truncate on table "public"."group_offline_member" to "service_role";

grant update on table "public"."group_offline_member" to "service_role";

grant delete on table "public"."vote_offline_tally" to "anon";

grant insert on table "public"."vote_offline_tally" to "anon";

grant references on table "public"."vote_offline_tally" to "anon";

grant select on table "public"."vote_offline_tally" to "anon";

grant trigger on table "public"."vote_offline_tally" to "anon";

grant truncate on table "public"."vote_offline_tally" to "anon";

grant update on table "public"."vote_offline_tally" to "anon";

grant delete on table "public"."vote_offline_tally" to "authenticated";

grant insert on table "public"."vote_offline_tally" to "authenticated";

grant references on table "public"."vote_offline_tally" to "authenticated";

grant select on table "public"."vote_offline_tally" to "authenticated";

grant trigger on table "public"."vote_offline_tally" to "authenticated";

grant truncate on table "public"."vote_offline_tally" to "authenticated";

grant update on table "public"."vote_offline_tally" to "authenticated";

grant delete on table "public"."vote_offline_tally" to "service_role";

grant insert on table "public"."vote_offline_tally" to "service_role";

grant references on table "public"."vote_offline_tally" to "service_role";

grant select on table "public"."vote_offline_tally" to "service_role";

grant trigger on table "public"."vote_offline_tally" to "service_role";

grant truncate on table "public"."vote_offline_tally" to "service_role";

grant update on table "public"."vote_offline_tally" to "service_role";


  create policy "service_role_all"
  on "public"."election_offline_tally"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."event_offline_participant"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_offline_member"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."vote_offline_tally"
  as permissive
  for all
  to service_role
using (true);



