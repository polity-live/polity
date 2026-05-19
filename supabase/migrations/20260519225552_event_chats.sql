alter table "public"."conversation" add column "event_id" uuid;

CREATE INDEX idx_conversation_event ON public.conversation USING btree (event_id);

alter table "public"."conversation" add constraint "conversation_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.event(id) ON DELETE CASCADE not valid;

alter table "public"."conversation" validate constraint "conversation_event_id_fkey";


