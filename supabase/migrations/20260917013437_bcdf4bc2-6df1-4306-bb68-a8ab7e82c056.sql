ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS added_by uuid;

UPDATE public.expenses e
SET added_by = m.profile_id
FROM public.group_members m
WHERE e.payer_member_id = m.id AND e.added_by IS NULL;