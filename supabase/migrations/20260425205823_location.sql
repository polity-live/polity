alter table "public"."event" drop column "location_address";

alter table "public"."event" add column "city" text;

alter table "public"."event" add column "country" text;

alter table "public"."event" add column "house_number" text;

alter table "public"."event" add column "post_code" text;

alter table "public"."event" add column "region" text;

alter table "public"."event" add column "street" text;

alter table "public"."event_exception" drop column "new_location_address";

alter table "public"."event_exception" add column "new_city" text;

alter table "public"."event_exception" add column "new_country" text;

alter table "public"."event_exception" add column "new_house_number" text;

alter table "public"."event_exception" add column "new_post_code" text;

alter table "public"."event_exception" add column "new_region" text;

alter table "public"."event_exception" add column "new_street" text;

alter table "public"."group" drop column "location";

alter table "public"."group" add column "city" text;

alter table "public"."group" add column "country" text;

alter table "public"."group" add column "house_number" text;

alter table "public"."group" add column "post_code" text;

alter table "public"."group" add column "region" text;

alter table "public"."group" add column "street" text;

alter table "public"."user" drop column "location";

alter table "public"."user" add column "city" text;

alter table "public"."user" add column "country" text;

alter table "public"."user" add column "house_number" text;

alter table "public"."user" add column "post_code" text;

alter table "public"."user" add column "region" text;

alter table "public"."user" add column "street" text;


