alter table public.groups add column if not exists payment_opens date;
alter table public.groups add column if not exists payment_due date;