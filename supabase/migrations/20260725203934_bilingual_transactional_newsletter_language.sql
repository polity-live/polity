alter table "public"."newsletter_subscription" add column "language" text not null default 'en'::text;

alter table "public"."newsletter_sync_outbox" add column "language" text not null default 'en'::text;

alter table "public"."newsletter_subscription" add constraint "newsletter_subscription_language_check" CHECK ((language = ANY (ARRAY['de'::text, 'en'::text]))) not valid;

alter table "public"."newsletter_subscription" validate constraint "newsletter_subscription_language_check";

alter table "public"."newsletter_sync_outbox" add constraint "newsletter_sync_outbox_language_check" CHECK ((language = ANY (ARRAY['de'::text, 'en'::text]))) not valid;

alter table "public"."newsletter_sync_outbox" validate constraint "newsletter_sync_outbox_language_check";

alter table "public"."user_preference" add constraint "user_preference_language_check" CHECK ((language = ANY (ARRAY['de'::text, 'en'::text]))) not valid;

alter table "public"."user_preference" validate constraint "user_preference_language_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_newsletter_language_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  normalized_language TEXT;
  current_subscription public.newsletter_subscription%ROWTYPE;
BEGIN
  IF NEW.language IS NOT DISTINCT FROM OLD.language THEN
    RETURN NEW;
  END IF;

  normalized_language := CASE WHEN NEW.language IN ('de', 'en') THEN NEW.language ELSE 'en' END;

  UPDATE public.newsletter_subscription
    SET language = normalized_language,
        sync_status = 'pending',
        last_error = NULL,
        updated_at = now()
    WHERE user_id = NEW.user_id
    RETURNING * INTO current_subscription;

  IF FOUND THEN
    INSERT INTO public.newsletter_sync_outbox (
      user_id,
      operation,
      email,
      resend_contact_id,
      language,
      subscribed
    ) VALUES (
      current_subscription.user_id,
      'upsert',
      current_subscription.email,
      current_subscription.resend_contact_id,
      current_subscription.language,
      current_subscription.subscribed
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_newsletter_subscription(target_user_id uuid, target_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_subscription public.newsletter_subscription%ROWTYPE;
  target_language TEXT;
BEGIN
  SELECT CASE WHEN preference.language IN ('de', 'en') THEN preference.language ELSE 'en' END
    INTO target_language
    FROM public.user_preference AS preference
    WHERE preference.user_id = target_user_id;

  target_language := COALESCE(target_language, 'en');

  INSERT INTO public.newsletter_subscription (user_id, email, language)
  VALUES (target_user_id, target_email, target_language)
  ON CONFLICT (user_id) DO UPDATE
    SET email = excluded.email,
        language = excluded.language,
        updated_at = now()
  RETURNING * INTO current_subscription;

  INSERT INTO public.newsletter_sync_outbox (
    user_id,
    operation,
    email,
    resend_contact_id,
    language,
    subscribed
  ) VALUES (
    target_user_id,
    'upsert',
    target_email,
    current_subscription.resend_contact_id,
    current_subscription.language,
    current_subscription.subscribed
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_auth_user_newsletter_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_subscription public.newsletter_subscription%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.email IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
      PERFORM public.enqueue_newsletter_subscription(NEW.id, NEW.email);
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.email_confirmed_at IS NULL
    AND NEW.email_confirmed_at IS NOT NULL
    AND NEW.email IS NOT NULL THEN
    PERFORM public.enqueue_newsletter_subscription(NEW.id, NEW.email);
    RETURN NEW;
  END IF;

  IF NEW.email_confirmed_at IS NOT NULL
    AND NEW.email IS NOT NULL
    AND NEW.email IS DISTINCT FROM OLD.email THEN
    SELECT * INTO current_subscription
      FROM public.newsletter_subscription
      WHERE user_id = NEW.id;

    IF FOUND THEN
      UPDATE public.newsletter_subscription
        SET email = NEW.email,
            resend_contact_id = NULL,
            sync_status = 'pending',
            last_error = NULL,
            updated_at = now()
        WHERE user_id = NEW.id;

      INSERT INTO public.newsletter_sync_outbox (
        user_id,
        operation,
        email,
        previous_email,
        resend_contact_id,
        language,
        subscribed
      ) VALUES (
        NEW.id,
        'replace_email',
        NEW.email,
        OLD.email,
        current_subscription.resend_contact_id,
        current_subscription.language,
        current_subscription.subscribed
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_auth_user_newsletter_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_subscription public.newsletter_subscription%ROWTYPE;
BEGIN
  SELECT * INTO current_subscription
    FROM public.newsletter_subscription
    WHERE user_id = OLD.id;

  IF FOUND THEN
    INSERT INTO public.newsletter_sync_outbox (
      user_id,
      operation,
      email,
      resend_contact_id,
      language,
      subscribed
    ) VALUES (
      OLD.id,
      'delete',
      current_subscription.email,
      current_subscription.resend_contact_id,
      current_subscription.language,
      current_subscription.subscribed
    );
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public."user" (id, email)
  VALUES (NEW.id, NEW.email);

  INSERT INTO public.notification_setting (user_id)
  VALUES (NEW.id);

  INSERT INTO public.user_preference (user_id, language)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.raw_user_meta_data->>'language' IN ('de', 'en')
        THEN NEW.raw_user_meta_data->>'language'
      ELSE 'en'
    END
  );

  PERFORM public.ensure_assistant_conversation(NEW.id);

  RETURN NEW;
END;
$function$
;

CREATE TRIGGER on_user_preference_newsletter_language_changed AFTER UPDATE OF language ON public.user_preference FOR EACH ROW EXECUTE FUNCTION public.handle_newsletter_language_change();

REVOKE ALL ON FUNCTION public.handle_newsletter_language_change() FROM PUBLIC;
