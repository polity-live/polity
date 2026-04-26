
  create table "public"."ai_provider_credential" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "provider" text not null,
    "encrypted_key" text not null,
    "key_hint" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "last_used_at" timestamp with time zone
      );


alter table "public"."ai_provider_credential" enable row level security;


  create table "public"."ai_skill" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "slug" text not null,
    "name" text not null,
    "aliases" text not null default ''::text,
    "system_prompt" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_skill" enable row level security;

alter table "public"."message" add column "context_json" text not null default '[]'::text;

CREATE UNIQUE INDEX ai_provider_credential_pkey ON public.ai_provider_credential USING btree (id);

CREATE UNIQUE INDEX ai_skill_pkey ON public.ai_skill USING btree (id);

CREATE INDEX idx_ai_provider_credential_user ON public.ai_provider_credential USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_provider_credential_user_provider ON public.ai_provider_credential USING btree (user_id, provider);

CREATE INDEX idx_ai_skill_user ON public.ai_skill USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_skill_user_slug ON public.ai_skill USING btree (user_id, slug);

alter table "public"."ai_provider_credential" add constraint "ai_provider_credential_pkey" PRIMARY KEY using index "ai_provider_credential_pkey";

alter table "public"."ai_skill" add constraint "ai_skill_pkey" PRIMARY KEY using index "ai_skill_pkey";

alter table "public"."ai_provider_credential" add constraint "ai_provider_credential_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."ai_provider_credential" validate constraint "ai_provider_credential_user_id_fkey";

alter table "public"."ai_skill" add constraint "ai_skill_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE not valid;

alter table "public"."ai_skill" validate constraint "ai_skill_user_id_fkey";

grant delete on table "public"."ai_provider_credential" to "anon";

grant insert on table "public"."ai_provider_credential" to "anon";

grant references on table "public"."ai_provider_credential" to "anon";

grant select on table "public"."ai_provider_credential" to "anon";

grant trigger on table "public"."ai_provider_credential" to "anon";

grant truncate on table "public"."ai_provider_credential" to "anon";

grant update on table "public"."ai_provider_credential" to "anon";

grant delete on table "public"."ai_provider_credential" to "authenticated";

grant insert on table "public"."ai_provider_credential" to "authenticated";

grant references on table "public"."ai_provider_credential" to "authenticated";

grant select on table "public"."ai_provider_credential" to "authenticated";

grant trigger on table "public"."ai_provider_credential" to "authenticated";

grant truncate on table "public"."ai_provider_credential" to "authenticated";

grant update on table "public"."ai_provider_credential" to "authenticated";

grant delete on table "public"."ai_provider_credential" to "service_role";

grant insert on table "public"."ai_provider_credential" to "service_role";

grant references on table "public"."ai_provider_credential" to "service_role";

grant select on table "public"."ai_provider_credential" to "service_role";

grant trigger on table "public"."ai_provider_credential" to "service_role";

grant truncate on table "public"."ai_provider_credential" to "service_role";

grant update on table "public"."ai_provider_credential" to "service_role";

grant delete on table "public"."ai_skill" to "anon";

grant insert on table "public"."ai_skill" to "anon";

grant references on table "public"."ai_skill" to "anon";

grant select on table "public"."ai_skill" to "anon";

grant trigger on table "public"."ai_skill" to "anon";

grant truncate on table "public"."ai_skill" to "anon";

grant update on table "public"."ai_skill" to "anon";

grant delete on table "public"."ai_skill" to "authenticated";

grant insert on table "public"."ai_skill" to "authenticated";

grant references on table "public"."ai_skill" to "authenticated";

grant select on table "public"."ai_skill" to "authenticated";

grant trigger on table "public"."ai_skill" to "authenticated";

grant truncate on table "public"."ai_skill" to "authenticated";

grant update on table "public"."ai_skill" to "authenticated";

grant delete on table "public"."ai_skill" to "service_role";

grant insert on table "public"."ai_skill" to "service_role";

grant references on table "public"."ai_skill" to "service_role";

grant select on table "public"."ai_skill" to "service_role";

grant trigger on table "public"."ai_skill" to "service_role";

grant truncate on table "public"."ai_skill" to "service_role";

grant update on table "public"."ai_skill" to "service_role";


  create policy "service_role_all"
  on "public"."ai_provider_credential"
  as permissive
  for all
  to service_role
using (true);



  create policy "service_role_all"
  on "public"."ai_skill"
  as permissive
  for all
  to service_role
using (true);



