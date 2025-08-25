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

### Option 1: ChatGPT Syncer (Main Script)
Copy the complete userscript from `userscript.js` and paste it into your userscript manager.

### Option 2: Supabase Config Helper (Optional)
For easier configuration, also install `supabase-config.js` - this adds a helpful config export button directly on your Supabase dashboard.

## Usage

### Easy Configuration (Recommended)
1. Install both userscripts (`userscript.js` + `supabase-config.js`)
2. Go to your Supabase project → Settings → API
3. Click the "🚀 配置 ChatGPT Syncer" button (top-right)
4. Click "🚀 直接保存配置" - no copying needed!
5. Go to ChatGPT and sync your first conversation

### Manual Configuration
- Navigate to any ChatGPT conversation
- Click the "Sync → Supabase" button (bottom-right corner)
- Or use keyboard shortcut: `Ctrl/⌘ + Shift + S`
- Fill in the configuration form with your Supabase URL, API key, and table name

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
create index if not exists chat_logs_gin_msgs on public.chat_logs using gin (messages);

-- Enable RLS and allow anonymous inserts only
alter table public.chat_logs enable row level security;
create policy "anon can insert" on public.chat_logs
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

## Table Schema Details

The `chat_logs` table structure:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key, auto-generated |
| `created_at` | timestamptz | Record creation timestamp |
| `collected_at` | timestamptz | When conversation was captured |
| `chat_id` | text | ChatGPT conversation ID |
| `chat_url` | text | Full URL of the conversation |
| `chat_title` | text | Conversation title |
| `page_title` | text | HTML page title |
| `messages` | jsonb | Array of conversation messages |
| `meta` | jsonb | Client metadata (UA, source, etc.) |

### Indexes Created
- `chat_logs_created_at_idx`: B-tree on created_at (DESC) for time-based queries
- `chat_logs_chat_id_idx`: B-tree on chat_id for conversation lookups
- `chat_logs_gin_msgs`: GIN index on messages JSONB for full-text search

### Security Policies
- RLS enabled with anonymous insert-only access
- Prevents unauthorized data access while allowing sync operations

## Development

See `gpt.md` for detailed implementation notes and upgrade history.

## License

MIT