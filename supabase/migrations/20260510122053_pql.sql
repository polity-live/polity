
  create table "public"."pql_filter" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "group_id" uuid,
    "storage_key" text not null,
    "label" text not null,
    "query" text not null,
    "is_active" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."pql_filter" enable row level security;

CREATE INDEX idx_pql_filter_active_scope ON public.pql_filter USING btree (user_id, storage_key, group_id, is_active);

CREATE INDEX idx_pql_filter_user_scope ON public.pql_filter USING btree (user_id, storage_key, group_id);

CREATE UNIQUE INDEX pql_filter_pkey ON public.pql_filter USING btree (id);

alter table "public"."pql_filter" add constraint "pql_filter_pkey" PRIMARY KEY using index "pql_filter_pkey";

alter table "public"."pql_filter" add constraint "pql_filter_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."pql_filter" validate constraint "pql_filter_group_id_fkey";

alter table "public"."pql_filter" add constraint "pql_filter_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."pql_filter" validate constraint "pql_filter_user_id_fkey";

grant delete on table "public"."pql_filter" to "anon";

grant insert on table "public"."pql_filter" to "anon";

grant references on table "public"."pql_filter" to "anon";

grant select on table "public"."pql_filter" to "anon";

grant trigger on table "public"."pql_filter" to "anon";

grant truncate on table "public"."pql_filter" to "anon";

grant update on table "public"."pql_filter" to "anon";

grant delete on table "public"."pql_filter" to "authenticated";

grant insert on table "public"."pql_filter" to "authenticated";

grant references on table "public"."pql_filter" to "authenticated";

grant select on table "public"."pql_filter" to "authenticated";

grant trigger on table "public"."pql_filter" to "authenticated";

grant truncate on table "public"."pql_filter" to "authenticated";

grant update on table "public"."pql_filter" to "authenticated";

grant delete on table "public"."pql_filter" to "service_role";

grant insert on table "public"."pql_filter" to "service_role";

grant references on table "public"."pql_filter" to "service_role";

grant select on table "public"."pql_filter" to "service_role";

grant trigger on table "public"."pql_filter" to "service_role";

grant truncate on table "public"."pql_filter" to "service_role";

grant update on table "public"."pql_filter" to "service_role";


  create policy "service_role_all"
  on "public"."pql_filter"
  as permissive
  for all
  to service_role
using (true);



