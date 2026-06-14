
  create table "public"."amendment_street_design" (
    "id" uuid not null default gen_random_uuid(),
    "amendment_id" uuid not null,
    "created_by_id" uuid not null,
    "title" text,
    "bbox" jsonb,
    "center_lat" numeric,
    "center_lon" numeric,
    "osm_snapshot" jsonb,
    "design_state" jsonb,
    "currency" text not null default 'EUR'::text,
    "estimated_total_cost_minor" integer not null default 0,
    "cost_catalog_version" text,
    "cost_summary" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."amendment_street_design" enable row level security;

CREATE UNIQUE INDEX amendment_street_design_pkey ON public.amendment_street_design USING btree (id);

CREATE INDEX idx_amendment_street_design_amendment ON public.amendment_street_design USING btree (amendment_id);

CREATE INDEX idx_amendment_street_design_created_by ON public.amendment_street_design USING btree (created_by_id);

CREATE INDEX idx_amendment_street_design_updated_at ON public.amendment_street_design USING btree (updated_at DESC);

alter table "public"."amendment_street_design" add constraint "amendment_street_design_pkey" PRIMARY KEY using index "amendment_street_design_pkey";

alter table "public"."amendment_street_design" add constraint "amendment_street_design_amendment_id_fkey" FOREIGN KEY (amendment_id) REFERENCES public.amendment(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_street_design" validate constraint "amendment_street_design_amendment_id_fkey";

alter table "public"."amendment_street_design" add constraint "amendment_street_design_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_street_design" validate constraint "amendment_street_design_created_by_id_fkey";

grant delete on table "public"."amendment_street_design" to "anon";

grant insert on table "public"."amendment_street_design" to "anon";

grant references on table "public"."amendment_street_design" to "anon";

grant select on table "public"."amendment_street_design" to "anon";

grant trigger on table "public"."amendment_street_design" to "anon";

grant truncate on table "public"."amendment_street_design" to "anon";

grant update on table "public"."amendment_street_design" to "anon";

grant delete on table "public"."amendment_street_design" to "authenticated";

grant insert on table "public"."amendment_street_design" to "authenticated";

grant references on table "public"."amendment_street_design" to "authenticated";

grant select on table "public"."amendment_street_design" to "authenticated";

grant trigger on table "public"."amendment_street_design" to "authenticated";

grant truncate on table "public"."amendment_street_design" to "authenticated";

grant update on table "public"."amendment_street_design" to "authenticated";

grant delete on table "public"."amendment_street_design" to "service_role";

grant insert on table "public"."amendment_street_design" to "service_role";

grant references on table "public"."amendment_street_design" to "service_role";

grant select on table "public"."amendment_street_design" to "service_role";

grant trigger on table "public"."amendment_street_design" to "service_role";

grant truncate on table "public"."amendment_street_design" to "service_role";

grant update on table "public"."amendment_street_design" to "service_role";


  create policy "service_role_all"
  on "public"."amendment_street_design"
  as permissive
  for all
  to service_role
using (true);



