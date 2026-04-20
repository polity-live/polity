set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.current_user_has_password()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (
      SELECT NULLIF(u.encrypted_password, '') IS NOT NULL
      FROM auth.users AS u
      WHERE u.id = auth.uid()
    ),
    false
  );
$function$
;

REVOKE ALL ON FUNCTION public.current_user_has_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_password() TO authenticated;


