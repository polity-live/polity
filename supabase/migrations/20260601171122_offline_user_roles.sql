
  create table "public"."group_offline_membership" (
    "id" uuid not null default gen_random_uuid(),
    "group_offline_member_id" uuid not null,
    "group_id" uuid not null,
    "status" text,
    "visibility" text not null default 'public'::text,
    "source" text not null default 'direct'::text,
    "source_group_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_offline_membership" enable row level security;


  create table "public"."group_offline_membership_role" (
    "id" uuid not null default gen_random_uuid(),
    "group_offline_membership_id" uuid not null,
    "role_id" uuid not null,
    "assigned_at" timestamp with time zone not null default now(),
    "assigned_by_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."group_offline_membership_role" enable row level security;

CREATE UNIQUE INDEX group_offline_membership_group_offline_member_id_group_id_key ON public.group_offline_membership USING btree (group_offline_member_id, group_id);

CREATE UNIQUE INDEX group_offline_membership_pkey ON public.group_offline_membership USING btree (id);

CREATE UNIQUE INDEX group_offline_membership_role_group_offline_membership_id_r_key ON public.group_offline_membership_role USING btree (group_offline_membership_id, role_id);

CREATE UNIQUE INDEX group_offline_membership_role_pkey ON public.group_offline_membership_role USING btree (id);

CREATE INDEX idx_group_offline_membership_group ON public.group_offline_membership USING btree (group_id);

CREATE INDEX idx_group_offline_membership_member ON public.group_offline_membership USING btree (group_offline_member_id);

CREATE INDEX idx_group_offline_membership_role_assigned_by ON public.group_offline_membership_role USING btree (assigned_by_id);

CREATE INDEX idx_group_offline_membership_role_membership ON public.group_offline_membership_role USING btree (group_offline_membership_id);

CREATE INDEX idx_group_offline_membership_role_role ON public.group_offline_membership_role USING btree (role_id);

CREATE INDEX idx_group_offline_membership_source_group ON public.group_offline_membership USING btree (source_group_id);

alter table "public"."group_offline_membership" add constraint "group_offline_membership_pkey" PRIMARY KEY using index "group_offline_membership_pkey";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_pkey" PRIMARY KEY using index "group_offline_membership_role_pkey";

alter table "public"."group_offline_membership" add constraint "group_offline_membership_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership" validate constraint "group_offline_membership_group_id_fkey";

alter table "public"."group_offline_membership" add constraint "group_offline_membership_group_offline_member_id_fkey" FOREIGN KEY (group_offline_member_id) REFERENCES public.group_offline_member(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership" validate constraint "group_offline_membership_group_offline_member_id_fkey";

alter table "public"."group_offline_membership" add constraint "group_offline_membership_group_offline_member_id_group_id_key" UNIQUE using index "group_offline_membership_group_offline_member_id_group_id_key";

alter table "public"."group_offline_membership" add constraint "group_offline_membership_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership" validate constraint "group_offline_membership_source_group_id_fkey";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_assigned_by_id_fkey" FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id) ON DELETE SET NULL not valid;

alter table "public"."group_offline_membership_role" validate constraint "group_offline_membership_role_assigned_by_id_fkey";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_group_offline_membership_id_fkey" FOREIGN KEY (group_offline_membership_id) REFERENCES public.group_offline_membership(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership_role" validate constraint "group_offline_membership_role_group_offline_membership_id_fkey";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_group_offline_membership_id_r_key" UNIQUE using index "group_offline_membership_role_group_offline_membership_id_r_key";

alter table "public"."group_offline_membership_role" add constraint "group_offline_membership_role_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.role(id) ON DELETE CASCADE not valid;

alter table "public"."group_offline_membership_role" validate constraint "group_offline_membership_role_role_id_fkey";

grant delete on table "public"."group_offline_membership" to "anon";

grant insert on table "public"."group_offline_membership" to "anon";

grant references on table "public"."group_offline_membership" to "anon";

grant select on table "public"."group_offline_membership" to "anon";

grant trigger on table "public"."group_offline_membership" to "anon";

grant truncate on table "public"."group_offline_membership" to "anon";

grant update on table "public"."group_offline_membership" to "anon";

grant delete on table "public"."group_offline_membership" to "authenticated";

grant insert on table "public"."group_offline_membership" to "authenticated";

grant references on table "public"."group_offline_membership" to "authenticated";

grant select on table "public"."group_offline_membership" to "authenticated";

grant trigger on table "public"."group_offline_membership" to "authenticated";

grant truncate on table "public"."group_offline_membership" to "authenticated";

grant update on table "public"."group_offline_membership" to "authenticated";

grant delete on table "public"."group_offline_membership" to "service_role";

grant insert on table "public"."group_offline_membership" to "service_role";

grant references on table "public"."group_offline_membership" to "service_role";

grant select on table "public"."group_offline_membership" to "service_role";

grant trigger on table "public"."group_offline_membership" to "service_role";

grant truncate on table "public"."group_offline_membership" to "service_role";

grant update on table "public"."group_offline_membership" to "service_role";

grant delete on table "public"."group_offline_membership_role" to "anon";

grant insert on table "public"."group_offline_membership_role" to "anon";

grant references on table "public"."group_offline_membership_role" to "anon";

grant select on table "public"."group_offline_membership_role" to "anon";

grant trigger on table "public"."group_offline_membership_role" to "anon";

grant truncate on table "public"."group_offline_membership_role" to "anon";

grant update on table "public"."group_offline_membership_role" to "anon";

grant delete on table "public"."group_offline_membership_role" to "authenticated";

grant insert on table "public"."group_offline_membership_role" to "authenticated";

grant references on table "public"."group_offline_membership_role" to "authenticated";

grant select on table "public"."group_offline_membership_role" to "authenticated";

grant trigger on table "public"."group_offline_membership_role" to "authenticated";

grant truncate on table "public"."group_offline_membership_role" to "authenticated";

grant update on table "public"."group_offline_membership_role" to "authenticated";

grant delete on table "public"."group_offline_membership_role" to "service_role";

grant insert on table "public"."group_offline_membership_role" to "service_role";

grant references on table "public"."group_offline_membership_role" to "service_role";

grant select on table "public"."group_offline_membership_role" to "service_role";

grant trigger on table "public"."group_offline_membership_role" to "service_role";

grant truncate on table "public"."group_offline_membership_role" to "service_role";

grant update on table "public"."group_offline_membership_role" to "service_role";


  create policy "service_role_all"
  on "public"."group_offline_membership"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."group_offline_membership_role"
  as permissive
  for all
  to service_role
using (true);



