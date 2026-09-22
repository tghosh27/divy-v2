ALTER TABLE public.groups
  ADD COLUMN cycle_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  ADD COLUMN cycle_end date NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month - 1 day')::date;