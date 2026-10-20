-- VIOLET Avatar Studio: private saved looks table.
-- Apply in the Supabase SQL Editor or through a tracked migration workflow.

create table if not exists public.saved_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Look' check (char_length(name) between 1 and 60),
  rig text not null default 'R15' check (rig in ('R6', 'R15')),
  roblox_user_id bigint,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_outfits_user_updated_idx
  on public.saved_outfits (user_id, updated_at desc);

alter table public.saved_outfits enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.saved_outfits to authenticated;

create policy "Users can read their own saved outfits"
  on public.saved_outfits for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own saved outfits"
  on public.saved_outfits for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved outfits"
  on public.saved_outfits for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saved outfits"
  on public.saved_outfits for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_saved_outfits_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_outfits_updated_at on public.saved_outfits;
create trigger saved_outfits_updated_at
before update on public.saved_outfits
for each row execute function public.set_saved_outfits_updated_at();
