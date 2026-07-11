create index "idx_notification_recipient_amendment" on "public"."notification" using btree ("recipient_amendment_id", "created_at");

create index "idx_notification_recipient_event" on "public"."notification" using btree ("recipient_event_id", "created_at");

create index "idx_notification_recipient_blog" on "public"."notification" using btree ("recipient_blog_id", "created_at");
