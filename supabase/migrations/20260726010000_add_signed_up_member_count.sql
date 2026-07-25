ALTER TABLE public."group"
ADD COLUMN IF NOT EXISTS signed_up_member_count integer NOT NULL DEFAULT 0;

UPDATE public."group" AS target_group
SET signed_up_member_count = (
  SELECT count(DISTINCT membership.user_id)::integer
  FROM public.group_membership AS membership
  WHERE membership.group_id = target_group.id
    AND membership.status IN ('active', 'member', 'admin')
);
