-- Create an extension for UUIDs
create extension if not exists "uuid-ossp";

-- Create a table for public profiles
create table profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,

  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Create a table for bookmarks
create table bookmarks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  book_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  notes text,

  unique(user_id, book_id)
);

alter table bookmarks enable row level security;

create policy "Users can view their own bookmarks." on bookmarks
  for select using (auth.uid() = user_id);

create policy "Users can insert their own bookmarks." on bookmarks
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own bookmarks." on bookmarks
  for update using (auth.uid() = user_id);

create policy "Users can delete their own bookmarks." on bookmarks
  for delete using (auth.uid() = user_id);

-- Set up Realtime subscriptions for bookmarks
alter publication supabase_realtime add table bookmarks;
