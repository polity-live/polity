alter table "public"."role" add column "default_invite_role" boolean not null default false;

alter table "public"."role" add column "default_request_role" boolean not null default false;


