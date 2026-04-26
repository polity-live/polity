alter table "public"."event" drop column "description_content";

alter table "public"."event" alter column "description" set data type jsonb using "description"::jsonb;

alter table "public"."group" drop column "description_content";

alter table "public"."group" alter column "description" set data type jsonb using "description"::jsonb;

alter table "public"."user" drop column "about_content";

alter table "public"."user" alter column "about" set data type jsonb using "about"::jsonb;


