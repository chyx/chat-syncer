# chat-syncer

A Tampermonkey userscript for syncing ChatGPT conversations to Supabase database.

## Overview

This userscript allows you to capture and sync ChatGPT conversations directly from the web interface to your Supabase database with a single click. It uses ChatGPT's backend API for reliable data extraction and includes fallback DOM scraping.

## Features

- 🚀 One-click sync to Supabase
- 🔄 API-first approach with DOM fallback 
- ⌨️ Keyboard shortcut support (Ctrl/⌘+Shift+S)
- 🔒 Duplicate detection and prevention
- 📱 Support for regular and shared ChatGPT links
- 🎯 Clean data extraction (removes UI clutter)

## Quick Start

1. **Set up Supabase database** (see SQL schema below)
2. **Install the userscript** in Tampermonkey/Violentmonkey
3. **Configure** your Supabase credentials on first use
4. **Sync** conversations with the button or keyboard shortcut

## Installation

Copy the complete userscript from `gpt.md` and paste it into your userscript manager.

## Usage

- Navigate to any ChatGPT conversation
- Click the "Sync → Supabase" button (bottom-right corner)
- Or use keyboard shortcut: `Ctrl/⌘ + Shift + S`
- First time will prompt for Supabase URL, API key, and table name

## Database Schema

Run this SQL in your Supabase project:

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

create table if not exists public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  collected_at timestamptz,
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

-- Enable RLS and allow anonymous inserts only
alter table public.chat_logs enable row level security;
create policy if not exists "anon can insert" on public.chat_logs
  for insert to anon with check (true);
```

## Data Format

Each synced conversation is stored as a single row containing:

- **Basic info**: chat_id, chat_url, chat_title, timestamps
- **Messages array**: `[{idx, role, text, html}, ...]` 
- **Metadata**: user agent, source method (api/dom), viewport info

## Security Notes

- Uses Supabase anonymous key (public, RLS-protected)
- Only allows INSERT operations from web clients
- No sensitive data is exposed in the userscript

## Development

See `gpt.md` for detailed implementation notes and upgrade history.

## License

MIT