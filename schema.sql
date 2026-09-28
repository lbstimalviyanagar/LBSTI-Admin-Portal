-- =====================================================================
-- LBSTIMN Admissions CRM — Supabase schema
-- Run this once in Supabase: Project -> SQL Editor -> New query -> Run.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.
--
-- Design note: `enquiries.assigned_to` stores the counselor's NAME (text),
-- matching `profiles.full_name` -- not a uuid foreign key. This matches
-- how the existing frontend already works (a plain Counselor dropdown of
-- names). Keep each counselor's `full_name` here identical to what you
-- put in js/config.js -> COUNSELORS, and to what they're assigned as in
-- the app, so the "counselors only see their own leads" rule below
-- actually matches rows correctly (it's a case-sensitive text compare).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES  (one row per Supabase Auth user; holds role + display name)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'counselor' check (role in ('admin', 'counselor')),
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up in Supabase Auth.
-- New users default to 'counselor' — promote someone to 'admin' manually:
--   update public.profiles set role = 'admin' where id = '<their-user-uuid>';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. ENQUIRIES  (the leads table — this is Model.normalize()'s source)
-- ---------------------------------------------------------------------
create table if not exists public.enquiries (
  id               bigint generated always as identity primary key,
  name             text not null,
  phone            text not null,
  city             text default '',
  course           text default '',
  batch            text default '',
  source           text default '',
  status           text not null default 'New'
                     check (status in ('New', 'No Response', 'Counseling Scheduled', 'Counseling done', 'Confirmed', 'Dropped')),
  assigned_to      text default '',   -- counselor's full_name (matches profiles.full_name)
  follow_up_date   date,
  notes            text default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists enquiries_status_idx        on public.enquiries (status);
create index if not exists enquiries_assigned_to_idx    on public.enquiries (assigned_to);
create index if not exists enquiries_follow_up_date_idx on public.enquiries (follow_up_date);
create index if not exists enquiries_created_at_idx     on public.enquiries (created_at desc);
create index if not exists enquiries_course_idx         on public.enquiries (course);

-- keep updated_at current on every edit
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists enquiries_set_updated_at on public.enquiries;
create trigger enquiries_set_updated_at
  before update on public.enquiries
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. REMARKS  (the activity timeline on each lead — one row per entry)
-- ---------------------------------------------------------------------
create table if not exists public.remarks (
  id           bigint generated always as identity primary key,
  enquiry_id   bigint not null references public.enquiries (id) on delete cascade,
  author_id    uuid references public.profiles (id) on delete set null,
  text         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists remarks_enquiry_id_idx on public.remarks (enquiry_id);

-- ---------------------------------------------------------------------
-- 4. Helper: the current user's own counselor name, for RLS comparisons
-- ---------------------------------------------------------------------
create or replace function public.my_full_name()
returns text
language sql stable security definer set search_path = public
as $$
  select full_name from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
--    Admins: full access to every enquiry/remark.
--    Counselors: only enquiries assigned to them (and remarks on those).
--    Everyone: can read their own profile; admins can read all profiles.
-- ---------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.enquiries enable row level security;
alter table public.remarks   enable row level security;

-- helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles ------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

-- enquiries -------------------------------------------------------------
drop policy if exists "enquiries_select" on public.enquiries;
create policy "enquiries_select"
  on public.enquiries for select
  using (public.is_admin() or assigned_to = public.my_full_name());

drop policy if exists "enquiries_insert" on public.enquiries;
create policy "enquiries_insert"
  on public.enquiries for insert
  with check (auth.uid() is not null);

drop policy if exists "enquiries_update" on public.enquiries;
create policy "enquiries_update"
  on public.enquiries for update
  using (public.is_admin() or assigned_to = public.my_full_name());

drop policy if exists "enquiries_delete" on public.enquiries;
create policy "enquiries_delete"
  on public.enquiries for delete
  using (public.is_admin());

-- remarks ---------------------------------------------------------------
drop policy if exists "remarks_select" on public.remarks;
create policy "remarks_select"
  on public.remarks for select
  using (
    public.is_admin()
    or exists (select 1 from public.enquiries e where e.id = enquiry_id and e.assigned_to = public.my_full_name())
  );

drop policy if exists "remarks_insert" on public.remarks;
create policy "remarks_insert"
  on public.remarks for insert
  with check (
    auth.uid() is not null
    and (
      public.is_admin()
      or exists (select 1 from public.enquiries e where e.id = enquiry_id and e.assigned_to = public.my_full_name())
    )
  );

-- ---------------------------------------------------------------------
-- 6. REALTIME — let the frontend subscribe to live inserts/updates/deletes
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.enquiries;
alter publication supabase_realtime add table public.remarks;

-- ---------------------------------------------------------------------
-- 7. FEES  (payments recorded against a lead — a separate section in the UI)
-- ---------------------------------------------------------------------
create table if not exists public.fees (
  id             bigint generated always as identity primary key,
  enquiry_id     bigint not null references public.enquiries (id) on delete cascade,
  amount         numeric(10, 2) not null check (amount > 0),
  payment_date   date not null default current_date,
  mode           text not null default 'Cash' check (mode in ('Cash', 'Online', 'Card', 'Cheque', 'UPI')),
  notes          text default '',
  received_by    uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists fees_enquiry_id_idx    on public.fees (enquiry_id);
create index if not exists fees_payment_date_idx  on public.fees (payment_date);

alter table public.fees enable row level security;

drop policy if exists "fees_select" on public.fees;
create policy "fees_select"
  on public.fees for select
  using (
    public.is_admin()
    or exists (select 1 from public.enquiries e where e.id = enquiry_id and e.assigned_to = public.my_full_name())
  );

drop policy if exists "fees_insert" on public.fees;
create policy "fees_insert"
  on public.fees for insert
  with check (
    auth.uid() is not null
    and (
      public.is_admin()
      or exists (select 1 from public.enquiries e where e.id = enquiry_id and e.assigned_to = public.my_full_name())
    )
  );

drop policy if exists "fees_delete" on public.fees;
create policy "fees_delete"
  on public.fees for delete
  using (public.is_admin());

alter publication supabase_realtime add table public.fees;

-- ---------------------------------------------------------------------
-- 8. Optional demo rows so the dashboard isn't empty on first load. 
-- ---------------------------------------------------------------------
insert into public.enquiries (name, phone, city, course, source, status, follow_up_date, notes)
select * from (values
  ('Aarav Sharma', '9811111111', 'Lucknow', 'ADCA (12 Months)', 'Website', 'New', current_date + 1, ''),
  ('Riya Verma',   '9822222222', 'Kanpur',  'Full Stack Developer (8 Months)', 'Meta Ads', 'Counseling Scheduled', current_date, '')
) as v(name, phone, city, course, source, status, follow_up_date, notes)
where not exists (select 1 from public.enquiries);
