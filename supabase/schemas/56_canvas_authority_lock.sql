-- 56_canvas_authority_lock.sql: canonical current definitions; historical upgrades are not replayed.

CREATE FUNCTION public.canvas_lock_authority() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(1886351981);
 RETURN NULL;
END;
$$;
