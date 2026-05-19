alter table "public"."event_participant" alter column "visibility" set default 'public'::text;

alter table "public"."event_participant" alter column "visibility" set not null;


