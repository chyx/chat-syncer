# chat-syncer

A Tampermonkey userscript for syncing ChatGPT conversations to Supabase database.

## Overview

This userscript allows you to capture and sync ChatGPT conversations directly from the web interface to your Supabase database with a single click. It uses ChatGPT's backend API for reliable data extraction and includes fallback DOM scraping.

## Features

### ChatGPT Sync
- 🚀 One-click sync to Supabase
- 📚 Batch sync up to 20 recent conversations from homepage
- 🔄 API-first approach with DOM fallback
- ⌨️ Keyboard shortcut support (Ctrl/⌘+Shift+S)
- 🔒 Duplicate detection and prevention
- 📱 Support for regular and shared ChatGPT links
- 🎯 Clean data extraction (removes UI clutter)

### Page Upload (New in v1.5.0)
- 📄 Upload any web page to Supabase as Markdown
- 🔄 HTML to Markdown conversion with structure preservation
- 🌐 Works on all websites via Tampermonkey menu
- 🔁 Auto UPSERT based on page URL

### General
- 🌙 Dark mode support
- 🔧 Easy configuration via Supabase dashboard

## Quick Start

1. **Set up Supabase database** - See [SETUP.md](SETUP.md) for detailed instructions
2. **Install the userscript** in Tampermonkey/Violentmonkey
3. **Configure** your Supabase credentials on first use
4. **Start syncing** conversations or uploading pages

## Installation

### Direct Install (Recommended)
Install directly from the raw GitHub URL in your userscript manager:
- **Direct install**: `https://raw.githubusercontent.com/chyx/chat-syncer/main/chat-syncer-unified.user.js`
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

### Upload Any Web Page
- Navigate to any web page
- Click Tampermonkey icon → "Upload Page"
- Page content is converted to Markdown and uploaded to Supabase
- Same URL = update existing record (UPSERT)

### Manual Configuration
If auto-detection fails, you can manually configure:
- Click sync button on any ChatGPT page
- Fill in Supabase URL, API key, and table name in the modal

## Database Setup

**📖 See [SETUP.md](SETUP.md) for complete database setup instructions**

Quick links:
- [ChatGPT Sync Setup](SETUP.md#chatgpt-sync-setup) - chat_logs table
- [Page Upload Setup](SETUP.md#page-upload-setup) - page_uploads table
- [Troubleshooting](SETUP.md#troubleshooting) - Common issues and solutions
- [Query Examples](SETUP.md#query-examples) - Useful SQL queries

## Data Format

### ChatGPT Conversations (chat_logs)
Each synced conversation is stored as a single row containing:
- **Basic info**: chat_id, chat_url, chat_title, timestamps
- **Messages array**: `[{idx, role, text, html}, ...]`
- **Metadata**: user agent, source method (api/dom), viewport info

### Uploaded Pages (page_uploads)
Each uploaded web page contains:
- **Page info**: page_url (unique), page_title, created_at, updated_at
- **Content**: page_content (Markdown format)
- **Metadata**: user agent, viewport, content length

See [SETUP.md](SETUP.md) for detailed table schemas and security policies.

## Development

### Project Structure
```
src/
├── config.js         - Theme, CONFIG, PageDetector
├── chatgpt.js        - ChatGPT module (UI, batch sync, data extraction)
├── supabase.js       - Supabase module (config helper, auto-detection)
├── page-uploader.js  - Page upload module (HTML→Markdown, upload)
└── main.js           - Initialization logic

build.js              - Build script to generate chat-syncer-unified.user.js
SETUP.md              - Complete database setup guide
```

### Building
```bash
npm run build       # Generate chat-syncer-unified.user.js from source files
npm test           # Run test suite
```

The `chat-syncer-unified.user.js` file is generated from source files in `src/`. Always edit source files, not the generated file.

### Version Management
Version is managed in `package.json` and automatically injected into the userscript header during build.

## License

MIT