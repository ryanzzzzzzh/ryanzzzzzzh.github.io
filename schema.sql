-- Before running: replace every occurrence of 70c26e5d-8ab8-4b94-824d-520f4ba11fcd
-- with the site owner's UUID from Supabase Authentication > Users.
-- Run this once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 200),
  category text not null default 'Journal' check (char_length(category) <= 80),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  body text not null check (char_length(body) between 1 and 200000),
  created_at timestamptz not null default now()
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  body text not null check (char_length(body) between 1 and 3000),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;

grant select on public.posts, public.comments, public.attachments to anon, authenticated;
grant insert on public.comments to anon, authenticated;
grant insert, update, delete on public.posts, public.attachments to authenticated;
grant update, delete on public.comments to authenticated;

create policy "Public can read posts" on public.posts for select to anon, authenticated using (true);
create policy "Only owner can create posts" on public.posts for insert to authenticated
  with check ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid and author_id = (select auth.uid()));
create policy "Only owner can edit posts" on public.posts for update to authenticated
  using ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid)
  with check ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid and author_id = (select auth.uid()));
create policy "Only owner can delete posts" on public.posts for delete to authenticated
  using ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid);

create policy "Public can read approved comments" on public.comments for select to anon, authenticated using (approved = true);
create policy "Owner can read pending comments" on public.comments for select to authenticated
  using ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid);
create policy "Visitors can submit comments for review" on public.comments for insert to anon, authenticated with check (approved = false);
create policy "Only owner can moderate comments" on public.comments for update to authenticated
  using ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid)
  with check ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid);
create policy "Only owner can delete comments" on public.comments for delete to authenticated
  using ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid);

create policy "Public can read attachments" on public.attachments for select to anon, authenticated using (true);
create policy "Only owner can add attachments" on public.attachments for insert to authenticated
  with check ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid);
create policy "Only owner can edit attachments" on public.attachments for update to authenticated
  using ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid)
  with check ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid);
create policy "Only owner can delete attachments" on public.attachments for delete to authenticated
  using ((select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid);

insert into storage.buckets (id, name, public, file_size_limit)
values ('post-attachments', 'post-attachments', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = 10485760;

create policy "Only owner can upload post attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-attachments' and (select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid);
create policy "Only owner can remove post attachments" on storage.objects for delete to authenticated
  using (bucket_id = 'post-attachments' and (select auth.uid()) = '70c26e5d-8ab8-4b94-824d-520f4ba11fcd'::uuid);


