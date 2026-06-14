-- Track entity notification read state independently per user.

ALTER TABLE public.notification_read
  DROP CONSTRAINT IF EXISTS notification_read_notification_id_entity_type_entity_id_key;

ALTER TABLE public.notification_read
  DROP CONSTRAINT IF EXISTS notification_read_per_user_key;

ALTER TABLE public.notification_read
  ADD CONSTRAINT notification_read_per_user_key
  UNIQUE (notification_id, entity_type, entity_id, read_by_user_id);
