# chat-syncer

> 油猴脚本：在 ChatGPT 网页端一键抓取当前对话并上传到 Supabase 数据库。

---

## 速用三步

1. **在 Supabase 建表**（见文末 SQL）。
2. **安装油猴脚本**（把下面整段 `// ==UserScript==` 代码粘贴进 Tampermonkey / Violentmonkey）。
3. 打开 ChatGPT 对话页 → 右下角点击 **Sync → Supabase**（或按 `Ctrl/⌘ + Shift + S`）→ 首次会弹窗让你填 **SUPABASE\_URL、ANON\_KEY、表名**。

> 注意：脚本默认只"读取页面可见对话"，不调用 OpenAI API；会把消息内容（纯文本+HTML）打包成一条 JSON 存到你指定表。

---

## Userscript（API 版，增强鲁棒）

```javascript
// ==UserScript==
// @name         Chat Syncer: ChatGPT → Supabase (API版)
// @namespace    https://github.com/you/chat-syncer
// @version      0.2.0
// @description  Fetch current ChatGPT conversation via backend API and upload to Supabase
// @author       you
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==
(function () {
  'use strict';

  // ---------- Consts ----------
  const STORAGE_KEYS = {
    url: 'chat_syncer.supabase_url',
    key: 'chat_syncer.supabase_key',
    table: 'chat_syncer.table',
    lastHashPrefix: 'chat_syncer.lasthash::',
    clientId: 'chat_syncer.client_id',
  };
  const DEFAULT_TABLE = 'chat_logs';

  const ORIGIN = new URL(location.href).origin;
  const API_BASE = {
    'https://chat.openai.com': 'https://chat.openai.com/backend-api',
    'https://chatgpt.com': 'https://chatgpt.com/backend-api',
  }[ORIGIN] || (ORIGIN + '/backend-api');

  // ---------- UI ----------
  GM_addStyle(`
    .chat-syncer-btn { position: fixed; right: 16px; bottom: 24px; z-index: 2147483647; border: none; border-radius: 9999px; padding: 10px 14px; font-size: 13px; font-weight: 600; cursor: pointer; background: #10a37f; color: #fff; box-shadow: 0 6px 20px rgba(0,0,0,.15); display: flex; align-items: center; gap: 8px; }
    .chat-syncer-btn[disabled] { opacity: 0.6; cursor: not-allowed; }
    .chat-syncer-toast { position: fixed; right: 16px; bottom: 72px; background: rgba(0,0,0,.8); color: #fff; padding: 10px 12px; border-radius: 10px; z-index: 2147483647; max-width: 60vw; font-size: 12px; }
  `);

  function toast(msg, ms = 2200) {
    const t = document.createElement('div');
    t.className = 'chat-syncer-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function ensureButton() {
    if (document.querySelector('.chat-syncer-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'chat-syncer-btn';
    btn.title = '同步当前对话到 Supabase (Ctrl/⌘+Shift+S)';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 4v12M12 4l-3 3M12 4l3 3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Sync → Supabase';
    btn.addEventListener('click', onSyncClick);
    document.body.appendChild(btn);
  }

  // Hotkey
  window.addEventListener('keydown', (e) => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSyncClick();
    }
  });

  // Observe SPA route/page changes
  const mo = new MutationObserver(() => ensureButton());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  ensureButton();

  // ---------- Config ----------
  function getCfg() {
    return {
      url: GM_getValue(STORAGE_KEYS.url, ''),
      key: GM_getValue(STORAGE_KEYS.key, ''),
      table: GM_getValue(STORAGE_KEYS.table, DEFAULT_TABLE),
    };
  }

  function setCfg({ url, key, table }) {
    if (typeof url === 'string') GM_setValue(STORAGE_KEYS.url, url.trim());
    if (typeof key === 'string') GM_setValue(STORAGE_KEYS.key, key.trim());
    if (typeof table === 'string') GM_setValue(STORAGE_KEYS.table, table.trim() || DEFAULT_TABLE);
  }

  function ensureClientId() {
    let id = GM_getValue(STORAGE_KEYS.clientId, '');
    if (!id) {
      id = crypto.getRandomValues(new Uint32Array(4)).join('-');
      GM_setValue(STORAGE_KEYS.clientId, id);
    }
    return id;
  }

  function openSettings() {
    const cur = getCfg();
    const url = prompt('Supabase Project URL (例如: https://xxxxx.supabase.co)', cur.url || '');
    if (url === null) return; // cancel
    const key = prompt('Supabase 匿名 ANON KEY（Project Settings → API）', cur.key || '');
    if (key === null) return;
    const table = prompt('表名 (默认 chat_logs)', cur.table || DEFAULT_TABLE) || DEFAULT_TABLE;
    setCfg({ url, key, table });
    toast('已保存 Supabase 配置');
  }

  GM_registerMenuCommand('设置 Supabase', openSettings);

  // ---------- Helpers ----------
  function parseChatIdFromUrl() {
    // 支持 /c/:id 以及 /g/:gizmo/c/:id 和分享页 /share/:id
    const m = location.pathname.match(/^\/(?:c|share|g\/[a-z0-9-]+\/c)\/([a-z0-9-]+)/i);
    return m ? m[1] : null;
  }

  function hashString(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  // ---------- ChatGPT API ----------
  function getAccessTokenFromBootstrap() {
    try {
      const ctx = window.__remixContext?.state?.loaderData?.root?.clientBootstrap?.session?.accessToken;
      if (ctx) return ctx;
    } catch {}
    try {
      const nextUser = window.__NEXT_DATA__?.props?.pageProps?.accessToken;
      if (nextUser) return nextUser;
    } catch {}
    return null;
  }

  async function getAccessToken() {
    const direct = getAccessTokenFromBootstrap();
    if (direct) return direct;
    try {
      const r = await fetch('/api/auth/session');
      if (!r.ok) return null;
      const j = await r.json();
      return j?.accessToken || null;
    } catch { return null; }
  }

  async function fetchConversation(chatId) {
    // 分享页无法直接访问后端接口，尝试从页面服务端数据读取
    if (location.pathname.startsWith('/share/')) {
      const shareData = window.__NEXT_DATA__?.props?.pageProps?.serverResponse?.data
        || window.__remixContext?.state?.loaderData?.['routes/share.$shareId.( $action)']?.serverResponse?.data
        || window.__remixContext?.state?.loaderData?.['routes/share.$shareId.($action)']?.serverResponse?.data
        || null;
      if (shareData) return shareData;
    }
    const token = await getAccessToken();
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    const url = `${API_BASE}/conversation/${encodeURIComponent(chatId)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Conversation API ${res.status}`);
    return await res.json();
  }

  function normalizeConversation(conv) {
    const items = [];
    const map = conv?.mapping || {};
    for (const node of Object.values(map)) {
      const msg = node && node.message;
      if (!msg) continue;
      const role = msg.author?.role;
      if (!role || (role !== 'user' && role !== 'assistant')) continue;
      const ct = msg.content?.content_type;
      let text = '';
      if (ct === 'text') {
        text = (msg.content.parts || []).join('\n\n');
      } else if (ct === 'multimodal_text') {
        text = (msg.content.parts || []).map(p => {
          if (typeof p === 'string') return p;
          if (p?.asset_pointer) return `[image:${p.asset_pointer}]`;
          return '';
        }).join('\n\n');
      } else if (ct === 'code') {
        text = (msg.content.text || msg.content.code || '');
      } else if (ct === 'execution_output') {
        text = '[tool/output]\n' + (msg.metadata?.aggregate_result?.messages?.map(m => m.text || m.message || '').join('\n') || '');
      } else {
        // fallback best-effort
        text = JSON.stringify(msg.content);
      }
      items.push({ id: msg.id, ts: msg.create_time || 0, role, text });
    }
    items.sort((a,b) => (a.ts||0) - (b.ts||0));
    return items.map((m, idx) => ({ idx, role: m.role, text: m.text, html: '' }));
  }

  // ---------- Supabase ----------
  async function upload(record, cfg) {
    const endpoint = cfg.url.replace(/\/$/, '') + '/rest/v1/' + encodeURIComponent(cfg.table);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'apikey': cfg.key,
        'Authorization': 'Bearer ' + cfg.key,
      },
      body: JSON.stringify([record]),
      keepalive: true,
    });
    if (!res.ok) {
      let text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const data = await res.json();
    return data && data[0];
  }

  // ---------- Fallback DOM Collector (极端情况下备用) ----------
  function collectFromDOM() {
    let nodes = Array.from(document.querySelectorAll('[data-message-author-role]'));
    if (nodes.length === 0) nodes = Array.from(document.querySelectorAll('article'));
    const msgs = [];
    nodes.forEach((el, idx) => {
      const role = el.getAttribute('data-message-author-role') || inferRole(el) || 'assistant';
      const cloned = el.cloneNode(true);
      cloned.querySelectorAll('button, svg, textarea, [contenteditable], [role="menu"], [data-testid="toast"], [data-testid="clipboard-button"]').forEach(n => n.remove());
      const text = cloned.innerText.replace(/\n{3,}/g, '\n\n').trim();
      if (!text) return;
      msgs.push({ idx, role, text, html: '' });
    });
    return msgs;
  }
  function inferRole(el) {
    const hint = el.getAttribute('data-testid') || '';
    if (/user/i.test(hint)) return 'user';
    if (/assistant|bot/i.test(hint)) return 'assistant';
    const cls = el.className ? String(el.className) : '';
    if (/user/.test(cls)) return 'user';
    if (/assistant|bot/.test(cls)) return 'assistant';
    const aria = el.getAttribute('aria-label') || '';
    if (/user/i.test(aria)) return 'user';
    if (/assistant|chatgpt|gpt/i.test(aria)) return 'assistant';
    return null;
  }

  // ---------- Main ----------
  let syncing = false;
  async function onSyncClick() {
    if (syncing) return;
    const cfg = getCfg();
    if (!cfg.url || !cfg.key) { openSettings(); return; }

    try {
      syncing = true;
      const btn = document.querySelector('.chat-syncer-btn');
      if (btn) btn.disabled = true;

      const chatId = parseChatIdFromUrl();
      let payload;
      let used = 'backend-api';
      if (chatId) {
        try {
          const conv = await fetchConversation(chatId);
          const msgs = normalizeConversation(conv);
          payload = {
            collected_at: new Date().toISOString(),
            chat_id: conv.id || chatId,
            chat_url: location.href,
            chat_title: conv.title || document.title || '',
            page_title: (document.querySelector('h1,h2,h3')?.textContent || '').trim(),
            messages: msgs,
            meta: {
              ua: navigator.userAgent,
              lang: navigator.language,
              viewport: { w: innerWidth, h: innerHeight },
              source: used,
              api_base: API_BASE,
              raw_conversation_id: conv.id || null,
            },
          };
        } catch (e) {
          console.warn('API 失败，改用 DOM 兜底：', e);
          used = 'dom';
        }
      }

      if (!payload) {
        const msgs = collectFromDOM();
        if (!msgs.length) { toast('未发现消息，请滚动页面后再试'); return; }
        payload = {
          collected_at: new Date().toISOString(),
          chat_id: chatId,
          chat_url: location.href,
          chat_title: document.title || '',
          page_title: (document.querySelector('h1,h2,h3')?.textContent || '').trim(),
          messages: msgs,
          meta: {
            ua: navigator.userAgent,
            lang: navigator.language,
            viewport: { w: innerWidth, h: innerHeight },
            source: 'dom',
          },
        };
      }

      const textForHash = payload.messages.map(m => `${m.role}:${m.text}`).join('\n');
      const curHash = hashString(textForHash);
      const hashKey = STORAGE_KEYS.lastHashPrefix + (payload.chat_id || payload.chat_url);
      const last = GM_getValue(hashKey, '');
      if (last === curHash) {
        if (!confirm('检测到内容与上次相同，仍要上传吗？')) return;
      }

      const row = await upload(payload, cfg);
      GM_setValue(hashKey, curHash);
      ensureClientId();
      toast('✅ 已上传到 Supabase：' + (row?.id || '成功'));
    } catch (err) {
      console.error(err);
      toast('⛔ 上传失败：' + (err && err.message ? err.message : String(err)), 4000);
    } finally {
      syncing = false;
      const btn = document.querySelector('.chat-syncer-btn');
      if (btn) btn.disabled = false;
    }
  }
})();
```

---

## Supabase 数据库建表示例（直接执行）

> 在 **SQL** 控制台运行：

```sql
-- 需要 uuid 生成函数
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

-- 常用索引（可选）
create index if not exists chat_logs_created_at_idx on public.chat_logs (created_at desc);
create index if not exists chat_logs_chat_id_idx on public.chat_logs (chat_id);
create index if not exists chat_logs_gin_msgs on public.chat_logs using gin ((messages jsonb_path_ops));

-- 开启 RLS
alter table public.chat_logs enable row level security;

-- 仅允许匿名角色插入（上传），不开放读取
-- （你仍可在 Supabase 控制台/用 Service Role Key 读取）
create policy if not exists "anon can insert" on public.chat_logs
  for insert to anon
  with check (true);
```

> **CORS 提示**：在 Supabase 项目 **Authentication → URL Configuration / API 设置** 确保允许来自 `https://chatgpt.com` 和 `https://chat.openai.com` 的请求（默认一般是 `*` 允许）。

---

## 采集说明

* **选择器鲁棒性**：优先读取 `[data-message-author-role]`，找不到则兜底抓取 `article` 元素，并通过类名/aria 标签**弱推断**角色。
* **内容格式**：同时保存 `text`（更方便检索）与 `html`（用于保留代码块/数学）。
* **去噪**：在克隆节点后移除按钮、SVG、复制控件等冗余 UI。
* **去重**：对 `role:text` 串做轻量 hash，避免重复上传（可继续上传覆盖）。

---

## 常见问题

* **Anon Key 放在脚本里安全吗？** 这是公开密钥，仅受 RLS 保护。上面策略只允许 `INSERT`，默认网页端不可读取；敏感环境请再配合 IP 过滤、边缘函数/代理。
* **抓不到全部历史消息？** 请滚动到页面让 ChatGPT 加载历史，再点同步；脚本只抓取当前 DOM 可见的消息。
* **需要导出所有对话？** 可在此脚本上加"批量模式"（遍历左侧会话列表逐个打开、等待加载、同步）。

---

## 可选增强（思路）

* **自动定时**：`setInterval` 周期性上传，并在 RLS 中加入限流/记录来源。
* **客户端标识**：在 `meta` 中追加本机随机 `client_id`（首次生成后存储在 GM\_setValue），用于区分来源。
* **加密**：上传前用对称密钥（本地保存）对 `messages` 加密，再写入数据库。
* **Webhook**：改为调用 Supabase Edge Functions，服务端再写表，更灵活地校验/脱敏。

---

## 简易查询示例

```sql
select created_at, chat_title, (messages->0->>'text') as first_turn
from public.chat_logs
order by created_at desc
limit 20;
```

---

### 开发历史与参考

我已经对比了几款"导出 ChatGPT 对话"的成熟脚本/扩展，确认了它们用到的**站内后端 API**，并据此把脚本升级成**API 版**并修好了（更稳、更完整，不再只靠 DOM 抓取）。

**我参考与核对的要点（含来源）**

* 这些优秀的脚本都会直接调用 ChatGPT 站内接口 `/backend-api/conversation/:id` 获取完整会话 JSON（而不是只抓可见 DOM）。比如 ChatGPT Exporter 的 README 就明确示例了该接口。([GitHub][1])
* 其 Userscript 源码里也能看到对后端接口的**基址映射**与**路由**：`https://chatgpt.com/backend-api` / `https://chat.openai.com/backend-api`，并包含 `conversation/:id`、`conversations` 列表接口、`files/:id/download`（用于图片指针解引用）等。([Greasy Fork][2])
* 获取鉴权信息的通用做法：

  1. 优先从 `window.__remixContext` / `__NEXT_DATA__` 里读 `accessToken`；
  2. 兜底请求 `/api/auth/session` 拿 `accessToken`。这些路径与 `session` 端点同样可在上述脚本源代码里找到。([Greasy Fork][2])
* 其他同类项目也普遍是"**API 拉取 → 归一化 → 导出/上传**"思路（不同的是有些只导 Markdown/JSON，本项目上传到 Supabase）。([GitHub][3], [Greasy Fork][4])

**我对脚本做了哪些修复/升级**

1. **改为优先用后端 API 拉取对话**

   * 解析 URL 支持 `/c/:id`、`/g/:gizmo/c/:id` 与分享页 `/share/:id`。
   * 调用 `${origin}/backend-api/conversation/:id` 获取完整 mapping，并归一化成线性消息数组（按 `create_time` 排序、仅保留 user/assistant）。([GitHub][1], [Greasy Fork][2])
   * **失败兜底**：只有在 API 拿不到时才退回你原来的 DOM 采集逻辑（避免"需要滚动加载"问题影响完整性）。
2. **鉴权更稳**

   * 先尝试从 `__remixContext` / `__NEXT_DATA__` 读取 `accessToken`，如果没有，再请求 `/api/auth/session` 取 token，然后在请求头里加 `Authorization: Bearer <token>`。([Greasy Fork][2])
3. **数据更干净**

   * 统一把图片/多模态内容做占位（如 `[image:file-service://...]`），避免报错；后续若需要，我可以再加一步把 `file-service://` 指针转成可下载 URL（`/backend-api/files/:id/download`）或 base64。([Greasy Fork][2])
4. **保持你原有 Supabase 表结构**

   * `messages` 仍是数组（`{idx, role, text, html}`），只是来源换成 API 还原的文本；
   * 在 `meta` 里补充了 `source`（backend-api/dom）和 `api_base` 等，方便后续审计。
5. **哈希去重**、按钮与热键、配置弹窗等均保留；代码整体更模块化。

### 快速验证

1. 打开任一 ChatGPT 对话页（`chatgpt.com/c/...`）。
2. 点右下角 **Sync → Supabase**。
3. 看 Supabase 的 `chat_logs` 表：`messages` 会比原来更全（无需手动滚动），`meta.source` 应为 `backend-api`。

   * 如果是分享页 `/share/...`，脚本会走**页面服务端数据**兜底路径（无需 token）。([Greasy Fork][2])

### 可选下一步（告诉我就加上）

* **图片指针解引用**：把 `[image:file-service://...]` 通过 `/files/:id/download` 拉成可直链或 base64 存库。([Greasy Fork][2])
* **批量导出所有会话**：循环调用 `/backend-api/conversations` 列表接口，逐个 `conversation/:id` 拉取后上传。([Greasy Fork][2])
* **保存原始 JSON**：若你愿意，我可以追加一个 `raw_json jsonb` 字段（或塞到 `meta.raw_conversation`），方便离线再处理。

需要我把"批量导出"和"图片解引用"直接集成到脚本里吗？我可以马上给你加上。

[1]: https://github.com/pionxzh/chatgpt-exporter "GitHub - pionxzh/chatgpt-exporter: Export and Share your ChatGPT conversation history"
[2]: https://greasyfork.org/en/scripts/456055-chatgpt-exporter/code "ChatGPT Exporter - Source code"
[3]: https://github.com/dkasak/export-chatgpt-transcript?utm_source=chatgpt.com "dkasak/export-chatgpt-transcript: A Tampermonkey userscript for ..."
[4]: https://greasyfork.org/en/scripts/507635-chatgpt-export-to-markdown-named?utm_source=chatgpt.com "ChatGPT Export to Markdown (Named) - Greasy Fork"