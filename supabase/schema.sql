create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_role text not null check (char_length(target_role) between 2 and 150),
  resume_profile jsonb not null,
  questions jsonb not null,
  answers jsonb not null,
  feedback_report jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists interview_sessions_user_id_created_at_idx
  on public.interview_sessions (user_id, created_at desc);

alter table public.interview_sessions enable row level security;

create policy "Users can view their own interview sessions"
  on public.interview_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own interview sessions"
  on public.interview_sessions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own interview sessions"
  on public.interview_sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);
