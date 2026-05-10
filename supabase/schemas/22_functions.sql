-- =============================================================================
-- 22_functions.sql — Database functions and triggers
-- =============================================================================

-- Handle new user creation from Supabase Auth
-- Automatically creates a user profile, default notification settings, and user preferences
CREATE OR REPLACE FUNCTION public.ensure_aria_kai_user()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  assistant_user_id CONSTANT UUID := 'a12a0000-0000-4000-a000-000000000001';
BEGIN
  INSERT INTO public."user" (
    id,
    email,
    handle,
    first_name,
    last_name,
    bio,
    visibility
  )
  VALUES (
    assistant_user_id,
    'aria-kai-assistants@polity.com',
    'aria-kai',
    'Aria & Kai',
    'Assistants',
    'Your personal assistants — here to help you navigate Polity!',
    'public'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_setting (user_id)
  VALUES (assistant_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preference (user_id)
  VALUES (assistant_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN assistant_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_assistant_conversation(target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  assistant_user_id UUID;
  assistant_conversation_id UUID;
  welcome_message CONSTANT TEXT := 'Hey, we are Aria & Kai - your personal assistants! Welcome to Polity! We would love to show you around in the app. Shall we?';
BEGIN
  assistant_user_id := public.ensure_aria_kai_user();

  SELECT id
  INTO assistant_conversation_id
  FROM public.conversation
  WHERE assistant_for_user_id = target_user_id
  LIMIT 1;

  IF assistant_conversation_id IS NULL THEN
    INSERT INTO public.conversation (
      type,
      name,
      status,
      last_message_at,
      assistant_for_user_id,
      requested_by_id
    )
    VALUES (
      'direct',
      'Aria & Kai',
      'accepted',
      now(),
      target_user_id,
      assistant_user_id
    )
    RETURNING id INTO assistant_conversation_id;
  END IF;

  INSERT INTO public.conversation_participant (
    conversation_id,
    user_id,
    joined_at,
    last_read_at,
    left_at
  )
  VALUES (
    assistant_conversation_id,
    target_user_id,
    now(),
    NULL,
    NULL
  )
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO public.conversation_participant (
    conversation_id,
    user_id,
    joined_at,
    last_read_at,
    left_at
  )
  VALUES (
    assistant_conversation_id,
    assistant_user_id,
    now(),
    now(),
    NULL
  )
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.message
    WHERE conversation_id = assistant_conversation_id
      AND sender_id = assistant_user_id
      AND content = welcome_message
  ) THEN
    INSERT INTO public.message (
      conversation_id,
      sender_id,
      content,
      is_read,
      created_at,
      updated_at,
      deleted_at
    )
    VALUES (
      assistant_conversation_id,
      assistant_user_id,
      welcome_message,
      false,
      now(),
      now(),
      NULL
    );
  END IF;

  UPDATE public.conversation
  SET last_message_at = COALESCE(
    (
      SELECT MAX(created_at)
      FROM public.message
      WHERE conversation_id = assistant_conversation_id
    ),
    last_message_at,
    now()
  )
  WHERE id = assistant_conversation_id;

  RETURN assistant_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public."user" (id, email)
  VALUES (NEW.id, NEW.email);

  INSERT INTO public.notification_setting (user_id)
  VALUES (NEW.id);

  INSERT INTO public.user_preference (user_id)
  VALUES (NEW.id);

  PERFORM public.ensure_assistant_conversation(NEW.id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_password()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT NULLIF(u.encrypted_password, '') IS NOT NULL
      FROM auth.users AS u
      WHERE u.id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_password() TO authenticated;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
