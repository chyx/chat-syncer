# Setup Guide

Complete database setup guide for chat-syncer userscript.

## Table of Contents

- [ChatGPT Sync Setup](#chatgpt-sync-setup)
- [Page Upload Setup](#page-upload-setup)
- [Troubleshooting](#troubleshooting)

---

## ChatGPT Sync Setup

### Initial Setup

Run this SQL in your Supabase project to create the `chat_logs` table:

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

create table if not exists public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  collected_at timestamptz,
  started_at timestamptz,
  chat_id text,
  chat_url text not null,
  chat_title text,
  page_title text,
  messages jsonb not null,
  meta jsonb
);

-- Indexes for better performance
create index if not exists chat_logs_created_at_idx on public.chat_logs (created_at desc);
create index if not exists chat_logs_chat_id_idx on public.chat_logs (chat_id);
create index if not exists chat_logs_gin_msgs on public.chat_logs using gin (messages);

-- Enable RLS and allow anonymous inserts and updates
alter table public.chat_logs enable row level security;

-- Drop existing policies if they exist
drop policy if exists "anon can insert" on public.chat_logs;
drop policy if exists "anon can update" on public.chat_logs;

-- Create new policies
create policy "anon can insert" on public.chat_logs
  for insert to anon with check (true);

create policy "anon can update" on public.chat_logs
  for update to anon using (true) with check (true);
```

### Migration: Add Unique Constraint for UPSERT

**If you already have data**, run this migration to enable UPSERT and prevent duplicates:

```sql
-- Step 1: Remove duplicate chat_ids (keep the newest record for each chat_id)
DELETE FROM public.chat_logs a
USING public.chat_logs b
WHERE a.chat_id = b.chat_id
  AND a.chat_id IS NOT NULL
  AND a.created_at < b.created_at;

-- Step 2: Add unique constraint on chat_id
ALTER TABLE public.chat_logs
ADD CONSTRAINT chat_logs_chat_id_unique UNIQUE (chat_id);
```

After this migration, the syncer will automatically:
- **Insert** new conversations
- **Update** existing conversations (based on chat_id)
- Prevent duplicate entries

---

## Page Upload Setup

### Initial Setup

Run this SQL to create the `page_uploads` table for storing web page content:

```sql
-- Enable UUID generation (if not already enabled)
create extension if not exists "pgcrypto";

-- Create table for storing uploaded web pages
create table if not exists public.page_uploads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  page_url text not null,
  page_title text,
  page_content text not null,
  meta jsonb
);

-- Create index on page_url for faster lookups
create index if not exists page_uploads_page_url_idx on public.page_uploads (page_url);

-- Create unique constraint on page_url for UPSERT
create unique index if not exists page_uploads_page_url_unique on public.page_uploads (page_url);

-- Enable RLS and allow anonymous inserts and updates
alter table public.page_uploads enable row level security;

-- Drop existing policies if they exist
drop policy if exists "anon can insert" on public.page_uploads;
drop policy if exists "anon can update" on public.page_uploads;
drop policy if exists "anon can select" on public.page_uploads;

-- Create new policies
-- Note: SELECT permission is required for UPSERT operations
create policy "anon can select" on public.page_uploads
  for select to anon using (true);

create policy "anon can insert" on public.page_uploads
  for insert to anon with check (true);

create policy "anon can update" on public.page_uploads
  for update to anon using (true) with check (true);
```

### Why SELECT Policy is Required

When using UPSERT (via `Prefer: resolution=merge-duplicates`), Supabase needs to:
1. **SELECT** - Check if a record with the same `page_url` exists
2. **INSERT** - If not exists, insert new record
3. **UPDATE** - If exists, update the existing record

Without the SELECT policy, you'll get a 401 error:
```
new row violates row-level security policy for table "page_uploads"
```

---

## Troubleshooting

### Common Issues

#### 1. UPSERT fails with 401 error

**Error message:**
```
401 - new row violates row-level security policy
```

**Solution:**
Make sure you have all three policies for UPSERT:
- `SELECT` - To check for duplicates
- `INSERT` - To insert new records
- `UPDATE` - To update existing records

#### 2. Duplicate entries in chat_logs

**Solution:**
Run the migration to add unique constraint on `chat_id` (see ChatGPT Sync Setup section above).

#### 3. Cannot connect to Supabase

**Check:**
- Supabase URL format: `https://[project-id].supabase.co`
- Using the **anon** key (not service_role key)
- RLS policies are properly configured

---

## Query Examples

### ChatGPT Conversations

```sql
-- Get conversations from today (with timezone conversion)
SELECT
    created_at AT TIME ZONE 'Asia/Shanghai' as real_chat_time,
    chat_title,
    COALESCE(
        CASE
            WHEN messages->0->>'role' = 'user' AND LENGTH(TRIM(messages->0->>'text')) > 0
            THEN LEFT(messages->0->>'text', 50)
            WHEN messages->1->>'role' = 'user' AND LENGTH(TRIM(messages->1->>'text')) > 0
            THEN LEFT(messages->1->>'text', 50)
            ELSE NULL
        END,
        '(无用户问题)'
    ) as first_question
FROM chat_logs
WHERE DATE(created_at AT TIME ZONE 'Asia/Shanghai') = CURRENT_DATE
ORDER BY created_at DESC;
```

### Uploaded Pages

```sql
-- Get recently uploaded pages
SELECT
    page_title,
    page_url,
    created_at,
    updated_at,
    LENGTH(page_content) as content_length
FROM page_uploads
ORDER BY updated_at DESC
LIMIT 20;

-- Search page content
SELECT
    page_title,
    page_url,
    LEFT(page_content, 200) as preview
FROM page_uploads
WHERE page_content ILIKE '%search term%'
ORDER BY updated_at DESC;
```

---

## Security Notes

- Uses Supabase **anon** key (public, RLS-protected)
- Only allows INSERT/UPDATE/SELECT operations from web clients
- No sensitive data is exposed in the userscript
- RLS policies prevent unauthorized access while allowing sync operations

---

## Migration History

| Version | Migration | Description |
|---------|-----------|-------------|
| 1.0.0 | Initial setup | Created chat_logs table |
| 1.2.0 | Add unique constraint | Added chat_id unique constraint for UPSERT |
| 1.5.0 | Page uploads | Created page_uploads table with full UPSERT support |
| 1.5.0 | Fix RLS | Added SELECT policy for page_uploads UPSERT |
