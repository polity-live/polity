alter table "public"."group" drop constraint "group_group_type_check";


  create table "public"."group_guest_access" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "user_id" uuid not null,
    "status" text not null default 'invited'::text,
    "invited_by_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_guest_access" enable row level security;


  create table "public"."group_guest_role" (
    "id" uuid not null default gen_random_uuid(),
    "group_guest_access_id" uuid not null,
    "role_id" uuid not null,
    "assigned_at" timestamp with time zone not null default now(),
    "assigned_by_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_guest_role" enable row level security;


  create table "public"."group_sibling_source" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "source_group_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_sibling_source" enable row level security;

alter table "public"."group" add column "connected_group_id" uuid;

alter table "public"."group" add column "sibling_membership_mode" text;

alter table "public"."group" add column "sibling_role_id" uuid;

alter table "public"."role" add column "assignee_kind" text not null default 'member'::text;

CREATE UNIQUE INDEX group_guest_access_group_id_user_id_key ON public.group_guest_access USING btree (group_id, user_id);

CREATE UNIQUE INDEX group_guest_access_pkey ON public.group_guest_access USING btree (id);

CREATE UNIQUE INDEX group_guest_role_group_guest_access_id_role_id_key ON public.group_guest_role USING btree (group_guest_access_id, role_id);

CREATE UNIQUE INDEX group_guest_role_pkey ON public.group_guest_role USING btree (id);

CREATE UNIQUE INDEX group_sibling_source_group_id_source_group_id_key ON public.group_sibling_source USING btree (group_id, source_group_id);

CREATE UNIQUE INDEX group_sibling_source_pkey ON public.group_sibling_source USING btree (id);

CREATE INDEX idx_group_connected_group ON public."group" USING btree (connected_group_id);

CREATE INDEX idx_group_guest_access_group ON public.group_guest_access USING btree (group_id);

CREATE INDEX idx_group_guest_access_status ON public.group_guest_access USING btree (status);

CREATE INDEX idx_group_guest_access_user ON public.group_guest_access USING btree (user_id);

CREATE INDEX idx_group_guest_role_access ON public.group_guest_role USING btree (group_guest_access_id);

CREATE INDEX idx_group_guest_role_assigned_by ON public.group_guest_role USING btree (assigned_by_id);

CREATE INDEX idx_group_guest_role_role ON public.group_guest_role USING btree (role_id);

CREATE INDEX idx_group_sibling_role ON public."group" USING btree (sibling_role_id);

CREATE INDEX idx_group_sibling_source_group ON public.group_sibling_source USING btree (group_id);

CREATE INDEX idx_group_sibling_source_source ON public.group_sibling_source USING btree (source_group_id);

CREATE INDEX idx_role_assignee_kind ON public.role USING btree (assignee_kind);

alter table "public"."group_guest_access" add constraint "group_guest_access_pkey" PRIMARY KEY using index "group_guest_access_pkey";

alter table "public"."group_guest_role" add constraint "group_guest_role_pkey" PRIMARY KEY using index "group_guest_role_pkey";

alter table "public"."group_sibling_source" add constraint "group_sibling_source_pkey" PRIMARY KEY using index "group_sibling_source_pkey";

alter table "public"."group" add constraint "group_connected_group_id_fkey" FOREIGN KEY (connected_group_id) REFERENCES public."group"(id) ON DELETE SET NULL not valid;

alter table "public"."group" validate constraint "group_connected_group_id_fkey";

alter table "public"."group" add constraint "group_connected_group_not_self_check" CHECK (((connected_group_id IS NULL) OR (connected_group_id <> id))) not valid;

alter table "public"."group" validate constraint "group_connected_group_not_self_check";

alter table "public"."group" add constraint "group_sibling_configuration_check" CHECK ((((group_type = 'sibling'::text) AND (connected_group_id IS NOT NULL) AND (sibling_membership_mode IS NOT NULL) AND (((sibling_membership_mode = 'elected'::text) AND (sibling_role_id IS NOT NULL)) OR ((sibling_membership_mode = ANY (ARRAY['open'::text, 'parliament'::text])) AND (sibling_role_id IS NULL)))) OR ((group_type <> 'sibling'::text) AND (connected_group_id IS NULL) AND (sibling_membership_mode IS NULL) AND (sibling_role_id IS NULL)))) not valid;

alter table "public"."group" validate constraint "group_sibling_configuration_check";

alter table "public"."group" add constraint "group_sibling_membership_mode_check" CHECK ((sibling_membership_mode = ANY (ARRAY['open'::text, 'elected'::text, 'parliament'::text]))) not valid;

alter table "public"."group" validate constraint "group_sibling_membership_mode_check";

alter table "public"."group" add constraint "group_sibling_role_id_fkey" FOREIGN KEY (sibling_role_id) REFERENCES public.role(id) ON DELETE SET NULL not valid;

alter table "public"."group" validate constraint "group_sibling_role_id_fkey";

alter table "public"."group_guest_access" add constraint "group_guest_access_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_guest_access" validate constraint "group_guest_access_group_id_fkey";

alter table "public"."group_guest_access" add constraint "group_guest_access_group_id_user_id_key" UNIQUE using index "group_guest_access_group_id_user_id_key";

alter table "public"."group_guest_access" add constraint "group_guest_access_invited_by_id_fkey" FOREIGN KEY (invited_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_guest_access" validate constraint "group_guest_access_invited_by_id_fkey";

alter table "public"."group_guest_access" add constraint "group_guest_access_status_check" CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'revoked'::text]))) not valid;

alter table "public"."group_guest_access" validate constraint "group_guest_access_status_check";

alter table "public"."group_guest_access" add constraint "group_guest_access_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."group_guest_access" validate constraint "group_guest_access_user_id_fkey";

alter table "public"."group_guest_role" add constraint "group_guest_role_assigned_by_id_fkey" FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_guest_role" validate constraint "group_guest_role_assigned_by_id_fkey";

alter table "public"."group_guest_role" add constraint "group_guest_role_group_guest_access_id_fkey" FOREIGN KEY (group_guest_access_id) REFERENCES public.group_guest_access(id) ON DELETE CASCADE not valid;

alter table "public"."group_guest_role" validate constraint "group_guest_role_group_guest_access_id_fkey";

alter table "public"."group_guest_role" add constraint "group_guest_role_group_guest_access_id_role_id_key" UNIQUE using index "group_guest_role_group_guest_access_id_role_id_key";

alter table "public"."group_guest_role" add constraint "group_guest_role_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."group_guest_role" validate constraint "group_guest_role_role_id_fkey";

alter table "public"."group_sibling_source" add constraint "group_sibling_source_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_sibling_source" validate constraint "group_sibling_source_group_id_fkey";

alter table "public"."group_sibling_source" add constraint "group_sibling_source_group_id_source_group_id_key" UNIQUE using index "group_sibling_source_group_id_source_group_id_key";

alter table "public"."group_sibling_source" add constraint "group_sibling_source_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_sibling_source" validate constraint "group_sibling_source_source_group_id_fkey";

alter table "public"."role" add constraint "role_assignee_kind_check" CHECK ((assignee_kind = ANY (ARRAY['member'::text, 'guest'::text]))) not valid;

alter table "public"."role" validate constraint "role_assignee_kind_check";

alter table "public"."group" add constraint "group_group_type_check" CHECK ((group_type = ANY (ARRAY['base'::text, 'hierarchical'::text, 'sibling'::text]))) not valid;

alter table "public"."group" validate constraint "group_group_type_check";

grant delete on table "public"."group_guest_access" to "anon";

grant insert on table "public"."group_guest_access" to "anon";

grant references on table "public"."group_guest_access" to "anon";

grant select on table "public"."group_guest_access" to "anon";

grant trigger on table "public"."group_guest_access" to "anon";

grant truncate on table "public"."group_guest_access" to "anon";

grant update on table "public"."group_guest_access" to "anon";

grant delete on table "public"."group_guest_access" to "authenticated";

grant insert on table "public"."group_guest_access" to "authenticated";

grant references on table "public"."group_guest_access" to "authenticated";

grant select on table "public"."group_guest_access" to "authenticated";

grant trigger on table "public"."group_guest_access" to "authenticated";

grant truncate on table "public"."group_guest_access" to "authenticated";

grant update on table "public"."group_guest_access" to "authenticated";

grant delete on table "public"."group_guest_access" to "service_role";

grant insert on table "public"."group_guest_access" to "service_role";

grant references on table "public"."group_guest_access" to "service_role";

grant select on table "public"."group_guest_access" to "service_role";

grant trigger on table "public"."group_guest_access" to "service_role";

grant truncate on table "public"."group_guest_access" to "service_role";

grant update on table "public"."group_guest_access" to "service_role";

grant delete on table "public"."group_guest_role" to "anon";

grant insert on table "public"."group_guest_role" to "anon";

grant references on table "public"."group_guest_role" to "anon";

grant select on table "public"."group_guest_role" to "anon";

grant trigger on table "public"."group_guest_role" to "anon";

grant truncate on table "public"."group_guest_role" to "anon";

grant update on table "public"."group_guest_role" to "anon";

grant delete on table "public"."group_guest_role" to "authenticated";

grant insert on table "public"."group_guest_role" to "authenticated";

grant references on table "public"."group_guest_role" to "authenticated";

grant select on table "public"."group_guest_role" to "authenticated";

grant trigger on table "public"."group_guest_role" to "authenticated";

grant truncate on table "public"."group_guest_role" to "authenticated";

grant update on table "public"."group_guest_role" to "authenticated";

grant delete on table "public"."group_guest_role" to "service_role";

grant insert on table "public"."group_guest_role" to "service_role";

grant references on table "public"."group_guest_role" to "service_role";

grant select on table "public"."group_guest_role" to "service_role";

grant trigger on table "public"."group_guest_role" to "service_role";

grant truncate on table "public"."group_guest_role" to "service_role";

grant update on table "public"."group_guest_role" to "service_role";

grant delete on table "public"."group_sibling_source" to "anon";

grant insert on table "public"."group_sibling_source" to "anon";

grant references on table "public"."group_sibling_source" to "anon";

grant select on table "public"."group_sibling_source" to "anon";

grant trigger on table "public"."group_sibling_source" to "anon";

grant truncate on table "public"."group_sibling_source" to "anon";

grant update on table "public"."group_sibling_source" to "anon";

grant delete on table "public"."group_sibling_source" to "authenticated";

grant insert on table "public"."group_sibling_source" to "authenticated";

grant references on table "public"."group_sibling_source" to "authenticated";

grant select on table "public"."group_sibling_source" to "authenticated";

grant trigger on table "public"."group_sibling_source" to "authenticated";

grant truncate on table "public"."group_sibling_source" to "authenticated";

grant update on table "public"."group_sibling_source" to "authenticated";

grant delete on table "public"."group_sibling_source" to "service_role";

grant insert on table "public"."group_sibling_source" to "service_role";

grant references on table "public"."group_sibling_source" to "service_role";

grant select on table "public"."group_sibling_source" to "service_role";

grant trigger on table "public"."group_sibling_source" to "service_role";

grant truncate on table "public"."group_sibling_source" to "service_role";

grant update on table "public"."group_sibling_source" to "service_role";


  create policy "service_role_all"
  on "public"."group_guest_access"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_guest_role"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_sibling_source"
  as permissive
  for all
  to service_role
using (true);



