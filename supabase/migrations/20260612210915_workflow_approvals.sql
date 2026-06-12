
  create table "public"."group_workflow_approval" (
    "id" uuid not null default gen_random_uuid(),
    "workflow_id" uuid not null,
    "group_id" uuid not null,
    "requested_by_group_id" uuid not null,
    "status" text not null default 'pending'::text,
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."group_workflow_approval" enable row level security;

alter table "public"."group_workflow" add column "start_group_id" uuid;

CREATE UNIQUE INDEX group_workflow_approval_pkey ON public.group_workflow_approval USING btree (id);

CREATE INDEX idx_group_workflow_approval_group ON public.group_workflow_approval USING btree (group_id);

CREATE INDEX idx_group_workflow_approval_requested_by ON public.group_workflow_approval USING btree (requested_by_group_id);

CREATE INDEX idx_group_workflow_approval_status ON public.group_workflow_approval USING btree (status);

CREATE UNIQUE INDEX idx_group_workflow_approval_unique ON public.group_workflow_approval USING btree (workflow_id, group_id);

CREATE INDEX idx_group_workflow_approval_workflow ON public.group_workflow_approval USING btree (workflow_id);

CREATE INDEX idx_group_workflow_start_group ON public.group_workflow USING btree (start_group_id);

alter table "public"."group_workflow_approval" add constraint "group_workflow_approval_pkey" PRIMARY KEY using index "group_workflow_approval_pkey";

alter table "public"."group_workflow" add constraint "group_workflow_start_group_id_fkey" FOREIGN KEY (start_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow" validate constraint "group_workflow_start_group_id_fkey";

alter table "public"."group_workflow_approval" add constraint "group_workflow_approval_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow_approval" validate constraint "group_workflow_approval_group_id_fkey";

alter table "public"."group_workflow_approval" add constraint "group_workflow_approval_requested_by_group_id_fkey" FOREIGN KEY (requested_by_group_id) REFERENCES public."group"(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow_approval" validate constraint "group_workflow_approval_requested_by_group_id_fkey";

alter table "public"."group_workflow_approval" add constraint "group_workflow_approval_workflow_id_fkey" FOREIGN KEY (workflow_id) REFERENCES public.group_workflow(id) ON DELETE CASCADE not valid;

alter table "public"."group_workflow_approval" validate constraint "group_workflow_approval_workflow_id_fkey";

grant delete on table "public"."group_workflow_approval" to "anon";

grant insert on table "public"."group_workflow_approval" to "anon";

grant references on table "public"."group_workflow_approval" to "anon";

grant select on table "public"."group_workflow_approval" to "anon";

grant trigger on table "public"."group_workflow_approval" to "anon";

grant truncate on table "public"."group_workflow_approval" to "anon";

grant update on table "public"."group_workflow_approval" to "anon";

grant delete on table "public"."group_workflow_approval" to "authenticated";

grant insert on table "public"."group_workflow_approval" to "authenticated";

grant references on table "public"."group_workflow_approval" to "authenticated";

grant select on table "public"."group_workflow_approval" to "authenticated";

grant trigger on table "public"."group_workflow_approval" to "authenticated";

grant truncate on table "public"."group_workflow_approval" to "authenticated";

grant update on table "public"."group_workflow_approval" to "authenticated";

grant delete on table "public"."group_workflow_approval" to "service_role";

grant insert on table "public"."group_workflow_approval" to "service_role";

grant references on table "public"."group_workflow_approval" to "service_role";

grant select on table "public"."group_workflow_approval" to "service_role";

grant trigger on table "public"."group_workflow_approval" to "service_role";

grant truncate on table "public"."group_workflow_approval" to "service_role";

grant update on table "public"."group_workflow_approval" to "service_role";


  create policy "service_role_all"
  on "public"."group_workflow_approval"
  as permissive
  for all
  to service_role
using (true);



