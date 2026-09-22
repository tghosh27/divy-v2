ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS items jsonb,
  ADD COLUMN IF NOT EXISTS shares jsonb;