drop policy "service_role_all" on "public"."meeting_booking";

drop policy "service_role_all" on "public"."meeting_slot";

revoke delete on table "public"."meeting_booking" from "anon";

revoke insert on table "public"."meeting_booking" from "anon";

revoke references on table "public"."meeting_booking" from "anon";

revoke select on table "public"."meeting_booking" from "anon";

revoke trigger on table "public"."meeting_booking" from "anon";

revoke truncate on table "public"."meeting_booking" from "anon";

revoke update on table "public"."meeting_booking" from "anon";

revoke delete on table "public"."meeting_booking" from "authenticated";

revoke insert on table "public"."meeting_booking" from "authenticated";

revoke references on table "public"."meeting_booking" from "authenticated";

revoke select on table "public"."meeting_booking" from "authenticated";

revoke trigger on table "public"."meeting_booking" from "authenticated";

revoke truncate on table "public"."meeting_booking" from "authenticated";

revoke update on table "public"."meeting_booking" from "authenticated";

revoke delete on table "public"."meeting_booking" from "service_role";

revoke insert on table "public"."meeting_booking" from "service_role";

revoke references on table "public"."meeting_booking" from "service_role";

revoke select on table "public"."meeting_booking" from "service_role";

revoke trigger on table "public"."meeting_booking" from "service_role";

revoke truncate on table "public"."meeting_booking" from "service_role";

revoke update on table "public"."meeting_booking" from "service_role";

revoke delete on table "public"."meeting_slot" from "anon";

revoke insert on table "public"."meeting_slot" from "anon";

revoke references on table "public"."meeting_slot" from "anon";

revoke select on table "public"."meeting_slot" from "anon";

revoke trigger on table "public"."meeting_slot" from "anon";

revoke truncate on table "public"."meeting_slot" from "anon";

revoke update on table "public"."meeting_slot" from "anon";

revoke delete on table "public"."meeting_slot" from "authenticated";

revoke insert on table "public"."meeting_slot" from "authenticated";

revoke references on table "public"."meeting_slot" from "authenticated";

revoke select on table "public"."meeting_slot" from "authenticated";

revoke trigger on table "public"."meeting_slot" from "authenticated";

revoke truncate on table "public"."meeting_slot" from "authenticated";

revoke update on table "public"."meeting_slot" from "authenticated";

revoke delete on table "public"."meeting_slot" from "service_role";

revoke insert on table "public"."meeting_slot" from "service_role";

revoke references on table "public"."meeting_slot" from "service_role";

revoke select on table "public"."meeting_slot" from "service_role";

revoke trigger on table "public"."meeting_slot" from "service_role";

revoke truncate on table "public"."meeting_slot" from "service_role";

revoke update on table "public"."meeting_slot" from "service_role";

alter table "public"."meeting_booking" drop constraint "meeting_booking_slot_id_fkey";

alter table "public"."meeting_booking" drop constraint "meeting_booking_user_id_fkey";

alter table "public"."meeting_slot" drop constraint "meeting_slot_event_id_fkey";

alter table "public"."meeting_slot" drop constraint "meeting_slot_user_id_fkey";

alter table "public"."meeting_booking" drop constraint "meeting_booking_pkey";

alter table "public"."meeting_slot" drop constraint "meeting_slot_pkey";

drop index if exists "public"."idx_meeting_booking_slot";

drop index if exists "public"."idx_meeting_booking_user";

drop index if exists "public"."idx_meeting_slot_event";

drop index if exists "public"."idx_meeting_slot_user";

drop index if exists "public"."meeting_booking_pkey";

drop index if exists "public"."meeting_slot_pkey";

drop table "public"."meeting_booking";

drop table "public"."meeting_slot";

alter table "public"."link" drop column "meeting_slot_id";

alter table "public"."link" add column "event_id" uuid;

CREATE INDEX idx_link_event ON public.link USING btree (event_id);

alter table "public"."link" add constraint "link_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."link" validate constraint "link_event_id_fkey";


