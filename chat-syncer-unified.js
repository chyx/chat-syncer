// ==UserScript==
// @name         ChatGPT Supabase Syncer (Unified) - Deprecated
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @updateURL    https://raw.githubusercontent.com/chyx/chat-syncer/refs/heads/main/chat-syncer-unified.user.js
// @downloadURL  https://raw.githubusercontent.com/chyx/chat-syncer/refs/heads/main/chat-syncer-unified.user.js
// @description  This version is deprecated. Please install the new .user.js version for auto-updates.
// @author       You
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://supabase.com/dashboard/project/*
// @match        https://app.supabase.com/project/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Show update notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        background: #ef4444;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
    `;

    notification.innerHTML = `
        <div style="margin-bottom: 8px;">⚠️ 脚本已过时</div>
        <div style="font-weight: 400; font-size: 13px; margin-bottom: 12px;">
            请安装新版本以获取自动更新功能。
        </div>
        <a href="https://raw.githubusercontent.com/chyx/chat-syncer/refs/heads/main/chat-syncer-unified.user.js"
           target="_blank"
           style="display: inline-block; background: white; color: #ef4444; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            点击安装新版本
        </a>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 15 seconds
    setTimeout(() => {
        notification.remove();
    }, 15000);
})();
