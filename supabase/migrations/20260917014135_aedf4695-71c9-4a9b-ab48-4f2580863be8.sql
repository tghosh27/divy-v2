ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.funding_requests(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS claim_status text;
CREATE INDEX IF NOT EXISTS deposits_request_id_idx ON public.deposits (request_id);