ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS settle_mode text NOT NULL DEFAULT 'anytime',
  ADD COLUMN IF NOT EXISTS settle_frequency text,
  ADD COLUMN IF NOT EXISTS settle_anchor date,
  ADD COLUMN IF NOT EXISTS confirm_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS multicurrency boolean NOT NULL DEFAULT false;