alter table "public"."user_preference" add column "group_network_layouts" jsonb not null default '{}'::jsonb;


