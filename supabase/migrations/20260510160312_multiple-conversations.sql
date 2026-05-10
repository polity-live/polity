drop index if exists "public"."idx_conversation_assistant_for_user_unique";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ensure_assistant_conversation(target_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;


