create table messages (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  user_id uuid references auth.users not null,
  user_email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table messages enable row level security;
create policy "Users can view all messages." on messages for select using (true);
create policy "Users can insert their own messages." on messages for insert with check (auth.uid() = user_id);

alter publication supabase_realtime add table messages;
