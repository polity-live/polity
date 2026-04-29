
  create table "public"."ai_tool" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "tool_name" text not null,
    "enabled" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_tool" enable row level security;

CREATE UNIQUE INDEX ai_tool_pkey ON public.ai_tool USING btree (id);

CREATE INDEX idx_ai_tool_user ON public.ai_tool USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_tool_user_name ON public.ai_tool USING btree (user_id, tool_name);

alter table "public"."ai_tool" add constraint "ai_tool_pkey" PRIMARY KEY using index "ai_tool_pkey";

alter table "public"."ai_tool" add constraint "ai_tool_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."ai_tool" validate constraint "ai_tool_user_id_fkey";

grant delete on table "public"."ai_tool" to "anon";

grant insert on table "public"."ai_tool" to "anon";

grant references on table "public"."ai_tool" to "anon";

grant select on table "public"."ai_tool" to "anon";

grant trigger on table "public"."ai_tool" to "anon";

grant truncate on table "public"."ai_tool" to "anon";

grant update on table "public"."ai_tool" to "anon";

grant delete on table "public"."ai_tool" to "authenticated";

grant insert on table "public"."ai_tool" to "authenticated";

grant references on table "public"."ai_tool" to "authenticated";

grant select on table "public"."ai_tool" to "authenticated";

grant trigger on table "public"."ai_tool" to "authenticated";

grant truncate on table "public"."ai_tool" to "authenticated";

grant update on table "public"."ai_tool" to "authenticated";

grant delete on table "public"."ai_tool" to "service_role";

grant insert on table "public"."ai_tool" to "service_role";

grant references on table "public"."ai_tool" to "service_role";

grant select on table "public"."ai_tool" to "service_role";

grant trigger on table "public"."ai_tool" to "service_role";

grant truncate on table "public"."ai_tool" to "service_role";

grant update on table "public"."ai_tool" to "service_role";


  create policy "service_role_all"
  on "public"."ai_tool"
  as permissive
  for all
  to service_role
using (true);



