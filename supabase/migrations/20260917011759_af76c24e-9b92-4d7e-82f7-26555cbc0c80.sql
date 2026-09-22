ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS receipt_key text,
  ADD COLUMN IF NOT EXISTS recur_freq text,
  ADD COLUMN IF NOT EXISTS recur_next date,
  ADD COLUMN IF NOT EXISTS recur_parent uuid;

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL,
  raised_name text NOT NULL DEFAULT 'Member',
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group disputes" ON public.disputes
  FOR ALL TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_disputes_updated_at ON public.disputes;
CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();