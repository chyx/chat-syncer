# chat-syncer

A Tampermonkey userscript for syncing ChatGPT conversations to Supabase database.

## Overview

This userscript allows you to capture and sync ChatGPT conversations directly from the web interface to your Supabase database with a single click. It uses ChatGPT's backend API for reliable data extraction and includes fallback DOM scraping.

## Features

- 🚀 One-click sync to Supabase
- 📚 Batch sync up to 20 recent conversations from homepage
- 🔄 API-first approach with DOM fallback
- ⌨️ Keyboard shortcut support (Ctrl/⌘+Shift+S)
- 🔒 Duplicate detection and prevention
- 📱 Support for regular and shared ChatGPT links
- 🎯 Clean data extraction (removes UI clutter)
- 🌙 Dark mode support

## Quick Start

1. **Set up Supabase database** (see SQL schema below)
2. **Install the userscript** in Tampermonkey/Violentmonkey
3. **Configure** your Supabase credentials on first use
4. **Sync** conversations with the button or keyboard shortcut

## Installation

### Direct Install (Recommended)
Install directly from the raw GitHub URL in your userscript manager:
- **Direct install**: `https://raw.githubusercontent.com/chyx/chat-syncer/main/chat-syncer-unified.js`
- **Auto-updates**: Enabled via @updateURL and @downloadURL directives

The unified script includes both ChatGPT syncing and Supabase config helper functionality.

## Usage

### Easy Configuration (Recommended)
1. Install the unified userscript
2. Go to your Supabase project → Settings → API
3. Click the "🚀 配置 ChatGPT Syncer" button (top-right)
4. Click "🚀 直接保存配置" - no copying needed!
5. Go to ChatGPT and start syncing

### Single Conversation Sync
- Navigate to any ChatGPT conversation
- Click the "Sync → Supabase" button (bottom-right corner)
- Or use keyboard shortcut: `Ctrl/⌘ + Shift + S`

### Batch Sync (20 Recent Conversations)
- Go to ChatGPT homepage (https://chatgpt.com/)
- Click the "📚 批量同步最近20条" button (bottom-right corner)
- Monitor progress in the popup modal
- Duplicate conversations are automatically skipped

### Manual Configuration
If auto-detection fails, you can manually configure:
- Click sync button on any ChatGPT page
- Fill in Supabase URL, API key, and table name in the modal

## Database Schema

### Initial Setup

Run this SQL in your Supabase project:

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
create policy "anon can insert" on public.chat_logs
  for insert to anon with check (true);
create policy "anon can update" on public.chat_logs
  for update to anon using (true) with check (true);
```

### Migration: Add Unique Constraint for UPSERT

**If you already have data**, run this migration to prevent duplicates:

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
| `started_at` | timestamptz | When conversation was started (from ChatGPT API) |
| `chat_id` | text | ChatGPT conversation ID |
| `chat_url` | text | Full URL of the conversation |
| `chat_title` | text | Conversation title |
| `page_title` | text | HTML page title |
| `messages` | jsonb | Array of conversation messages |
| `meta` | jsonb | Client metadata (UA, source, batch_sync, etc.) |

### Indexes Created
- `chat_logs_created_at_idx`: B-tree on created_at (DESC) for time-based queries
- `chat_logs_chat_id_idx`: B-tree on chat_id for conversation lookups
- `chat_logs_gin_msgs`: GIN index on messages JSONB for full-text search

### Security Policies
- RLS enabled with anonymous insert-only access
- Prevents unauthorized data access while allowing sync operations

## Development

### Project Structure
```
src/
├── config.js       - Theme, CONFIG, PageDetector
├── chatgpt.js      - ChatGPT module (UI, batch sync, data extraction)
├── supabase.js     - Supabase module (config helper, auto-detection)
└── main.js         - Initialization logic

build.js            - Build script to generate chat-syncer-unified.js
```

### Building
```bash
npm run build       # Generate chat-syncer-unified.js from source files
npm test           # Run test suite
```

The `chat-syncer-unified.js` file is generated from source files in `src/`. Always edit source files, not the generated file.

### Version Management
Version is managed in `package.json` and automatically injected into the userscript header during build.

## License

MIT