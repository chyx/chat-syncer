// ==UserScript==
// @name         ChatGPT Supabase Syncer (Unified)
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @updateURL    https://raw.githubusercontent.com/chyx/chat-syncer/main/chat-syncer-unified.js
// @downloadURL  https://raw.githubusercontent.com/chyx/chat-syncer/main/chat-syncer-unified.js
// @description  Unified script: Sync ChatGPT conversations to Supabase & Config helper for Supabase dashboard
// @author       You
// @match        https://chatgpt.com/c/*
// @match        https://chat.openai.com/c/*
// @match        https://chatgpt.com/share/*
// @match        https://chat.openai.com/share/*
// @match        https://chatgpt.com/
// @match        https://chat.openai.com/
// @match        https://supabase.com/dashboard/project/*
// @match        https://app.supabase.com/project/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

// ===============================
// SHARED CONFIGURATION & UTILITIES
// ===============================

// Theme support for dark backgrounds
const injectThemeCSS = () => {
    if (document.getElementById('chat-syncer-theme')) return;

    const style = document.createElement('style');
    style.id = 'chat-syncer-theme';
    style.textContent = `
        :root {
            --surface-primary: white;
            --surface-secondary: #f9fafb;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --text-error: #dc2626;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --surface-primary: #1f2937;
                --surface-secondary: #374151;
                --text-primary: #f9fafb;
                --text-secondary: #d1d5db;
                --text-error: #fca5a5;
            }
        }

        /* ChatGPT dark theme detection */
        [data-theme="dark"], .dark, html[data-theme="dark"] {
            --surface-primary: #2d2d30;
            --surface-secondary: #3e3e42;
            --text-primary: #e4e4e7;
            --text-secondary: #a1a1aa;
            --text-error: #fca5a5;
        }

        /* Supabase dark theme detection */
        .sbui-dark, [data-theme="dark"].sb, body[data-theme="dark"] {
            --surface-primary: #1f2937;
            --surface-secondary: #374151;
            --text-primary: #f9fafb;
            --text-secondary: #d1d5db;
            --text-error: #fca5a5;
        }
    `;
    document.head.appendChild(style);
};

// Storage keys
const STORAGE_KEYS = {
    url: 'chat_syncer.supabase_url',
    key: 'chat_syncer.supabase_key',
    table: 'chat_syncer.table'
};

// Configuration object
const CONFIG = {
    SUPABASE_URL: null,
    SUPABASE_ANON_KEY: null,
    TABLE_NAME: 'chat_logs',
    get: function(key) {
        if (this[key] !== null) return this[key];

        // Map keys to GM storage keys
        let gmKey;
        if (key === 'SUPABASE_URL') gmKey = STORAGE_KEYS.url;
        else if (key === 'SUPABASE_ANON_KEY') gmKey = STORAGE_KEYS.key;
        else if (key === 'TABLE_NAME') gmKey = STORAGE_KEYS.table;

        // Try GM storage first
        if (gmKey) {
            const stored = GM_getValue(gmKey, '');
            if (stored) {
                this[key] = stored;
                return stored;
            }
        }

        // Fallback to localStorage for migration
        const stored = localStorage.getItem(`chatsyncer_${key.toLowerCase()}`);
        if (stored) {
            this[key] = stored;
            // Migrate to GM storage
            if (gmKey) {
                GM_setValue(gmKey, stored);
                // Clean up old localStorage
                localStorage.removeItem(`chatsyncer_${key.toLowerCase()}`);
            }
            return stored;
        }

        return null;
    },
    set: function(key, value) {
        this[key] = value;

        // Map keys to GM storage keys
        let gmKey;
        if (key === 'SUPABASE_URL') gmKey = STORAGE_KEYS.url;
        else if (key === 'SUPABASE_ANON_KEY') gmKey = STORAGE_KEYS.key;
        else if (key === 'TABLE_NAME') gmKey = STORAGE_KEYS.table;

        if (gmKey) {
            GM_setValue(gmKey, value);
        }
        // Also save to localStorage for backward compatibility
        localStorage.setItem(`chatsyncer_${key.toLowerCase()}`, value);
    }
};

// Page detection
const PageDetector = {
    isChatGPTPage() {
        return /chatgpt\.com|chat\.openai\.com/.test(location.href);
    },

    isChatGPTHomePage() {
        const url = location.href;
        return (url === 'https://chatgpt.com/' || url === 'https://chat.openai.com/' ||
               url === 'https://chatgpt.com' || url === 'https://chat.openai.com');
    },

    isChatGPTConversationPage() {
        return this.isChatGPTPage() && !this.isChatGPTHomePage();
    },

    isSupabasePage() {
        return /supabase\.com/.test(location.href);
    },

    getCurrentPageType() {
        if (this.isChatGPTHomePage()) return 'chatgpt_home';
        if (this.isChatGPTConversationPage()) return 'chatgpt_conversation';
        if (this.isSupabasePage()) return 'supabase';
        return 'unknown';
    }
};


// ===============================
// CHATGPT MODULE
// ===============================

const ChatGPTModule = {
    // UI Components
    UI: {
        createSyncButton() {
            const button = document.createElement('button');
            button.innerHTML = 'Sync → Supabase';
            button.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 20px;
                z-index: 10000;
                background: #10a37f;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                transition: all 0.2s ease;
            `;

            button.onmouseover = () => {
                button.style.background = '#0d8f6b';
                button.style.transform = 'translateY(-1px)';
            };

            button.onmouseout = () => {
                button.style.background = '#10a37f';
                button.style.transform = 'translateY(0)';
            };

            button.onclick = () => ChatGPTModule.ChatSyncer.syncConversation();
            return button;
        },

        createBatchSyncButton() {
            const container = document.createElement('div');
            container.id = 'batch-sync-container';
            container.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 20px;
                z-index: 10000;
            `;

            const button = document.createElement('button');
            button.innerHTML = '📚 批量同步最近20条';
            button.id = 'batch-sync-btn';
            button.style.cssText = `
                background: #7c3aed;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(124,58,237,0.3);
                transition: all 0.2s ease;
                min-width: 180px;
                text-align: center;
                display: block;
            `;

            const optionsMenu = document.createElement('div');
            optionsMenu.id = 'batch-sync-options';
            optionsMenu.style.cssText = `
                position: absolute;
                bottom: 100%;
                right: 0;
                margin-bottom: 8px;
                background: var(--surface-primary, white);
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                min-width: 200px;
                opacity: 0;
                visibility: hidden;
                transition: all 0.2s ease;
                overflow: hidden;
            `;

            const options = [
                { label: '批量同步最近50条', limit: 50 },
                { label: '批量同步最近100条', limit: 100 },
                { label: '批量同步最近200条', limit: 200 }
            ];

            options.forEach((opt, idx) => {
                const optionBtn = document.createElement('button');
                optionBtn.textContent = opt.label;
                optionBtn.style.cssText = `
                    width: 100%;
                    padding: 12px 16px;
                    border: none;
                    background: transparent;
                    color: var(--text-primary, #374151);
                    text-align: left;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.15s ease;
                    ${idx < options.length - 1 ? 'border-bottom: 1px solid #f3f4f6;' : ''}
                `;

                optionBtn.onmouseover = () => {
                    optionBtn.style.background = '#f3f4f6';
                };

                optionBtn.onmouseout = () => {
                    optionBtn.style.background = 'transparent';
                };

                optionBtn.onclick = (e) => {
                    e.stopPropagation();
                    optionsMenu.style.opacity = '0';
                    optionsMenu.style.visibility = 'hidden';
                    ChatGPTModule.BatchSyncer.startBatchSync(opt.limit);
                };

                optionsMenu.appendChild(optionBtn);
            });

            container.appendChild(optionsMenu);
            container.appendChild(button);

            let hoverTimer = null;

            container.onmouseover = () => {
                clearTimeout(hoverTimer);
                button.style.background = '#6d28d9';
                button.style.transform = 'translateY(-2px)';
                button.style.boxShadow = '0 6px 16px rgba(124,58,237,0.4)';

                hoverTimer = setTimeout(() => {
                    optionsMenu.style.opacity = '1';
                    optionsMenu.style.visibility = 'visible';
                }, 300);
            };

            container.onmouseout = () => {
                clearTimeout(hoverTimer);
                button.style.background = '#7c3aed';
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = '0 4px 12px rgba(124,58,237,0.3)';
                optionsMenu.style.opacity = '0';
                optionsMenu.style.visibility = 'hidden';
            };

            button.onclick = () => ChatGPTModule.BatchSyncer.startBatchSync(20);
            return container;
        },

        createProgressModal() {
            const overlay = document.createElement('div');
            overlay.id = 'batch-sync-modal';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                z-index: 10003;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: var(--surface-primary, white);
                color: var(--text-primary, #000);
                border-radius: 16px;
                padding: 24px;
                max-width: 480px;
                width: 90%;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            `;

            modal.innerHTML = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: var(--text-primary, #1f2937);">批量同步进行中</h3>
                    <p style="margin: 0; font-size: 14px; color: var(--text-secondary, #6b7280);">正在同步最近的对话到 Supabase...</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <div style="background: #f3f4f6; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div id="progress-bar" style="background: #7c3aed; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                    </div>
                    <div id="progress-text" style="text-align: center; margin-top: 8px; font-size: 14px; color: var(--text-secondary, #6b7280);">准备中...</div>
                </div>

                <div id="sync-results" style="margin-bottom: 16px; font-size: 14px;">
                    <div>✅ <span id="success-count">0</span> 条成功</div>
                    <div>❌ <span id="error-count">0</span> 条失败</div>
                    <div>⏭️ <span id="skip-count">0</span> 条跳过</div>
                </div>

                <div id="error-details" style="margin-bottom: 16px; max-height: 120px; overflow-y: auto; background: #fef2f2; border-radius: 6px; padding: 8px; font-size: 12px; display: none;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: var(--text-error, #dc2626);">失败详情：</div>
                    <div id="error-list" style="line-height: 1.4;"></div>
                </div>

                <div style="text-align: center;">
                    <button id="cancel-batch" style="padding: 8px 16px; border: 1px solid #d1d5db; background: var(--surface-secondary, white); color: var(--text-primary, #374151); border-radius: 6px; font-size: 14px; cursor: pointer; margin-right: 8px;">取消</button>
                    <button id="close-modal" style="padding: 8px 16px; border: none; background: #7c3aed; color: white; border-radius: 6px; font-size: 14px; cursor: pointer; display: none;">关闭</button>
                </div>
            `;

            overlay.appendChild(modal);
            return overlay;
        },

        showStatus(message, type = 'info') {
            const status = document.createElement('div');
            status.textContent = message;
            status.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10001;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                max-width: 300px;
                word-wrap: break-word;
                background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
                color: white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;

            document.body.appendChild(status);
            setTimeout(() => {
                if (status.parentNode) {
                    status.parentNode.removeChild(status);
                }
            }, 3000);
        },

        promptConfig() {
            return new Promise((resolve) => {
                this.showConfigModal(resolve);
            });
        },

        showConfigModal(callback) {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10002;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: var(--surface-primary, white);
                color: var(--text-primary, #000);
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                max-height: 80vh;
                overflow-y: auto;
            `;

            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: var(--text-primary, #1f2937);">配置 Supabase 连接</h2>
                    <p style="margin: 0; font-size: 14px; color: var(--text-secondary, #6b7280);">请填入您的 Supabase 项目信息</p>
                </div>

                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 1.5;">
                    <strong>📋 如何获取 Supabase 密钥：</strong><br>
                    1. 登录 <a href="https://supabase.com" target="_blank" style="color: #10a37f;">Supabase</a> 并进入您的项目<br>
                    2. 在左侧菜单点击 "Settings" → "API"<br>
                    3. 复制 "Project URL" 和 "anon public" 密钥<br>
                    4. 确保在 "Authentication" → "Policies" 中设置了正确的 RLS 策略
                </div>

                <form id="supabaseConfigForm">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: var(--text-primary, #374151); margin-bottom: 6px;">
                            Supabase URL *
                        </label>
                        <input type="url" id="supabaseUrl" placeholder="https://your-project.supabase.co"
                               style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
                               value="${CONFIG.get('SUPABASE_URL') || ''}" required>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: var(--text-primary, #374151); margin-bottom: 6px;">
                            匿名密钥 (anon key) *
                        </label>
                        <textarea id="supabaseKey" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." rows="3"
                                  style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; resize: vertical; box-sizing: border-box;"
                                  required>${CONFIG.get('SUPABASE_ANON_KEY') || ''}</textarea>
                    </div>

                    <div style="margin-bottom: 24px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: var(--text-primary, #374151); margin-bottom: 6px;">
                            表名
                        </label>
                        <input type="text" id="tableName" placeholder="chat_logs"
                               style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
                               value="${CONFIG.get('TABLE_NAME') || 'chat_logs'}">
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" id="cancelConfig"
                                style="padding: 10px 16px; border: 1px solid #d1d5db; background: var(--surface-secondary, white); color: var(--text-primary, #374151); border-radius: 6px; font-size: 14px; cursor: pointer;">
                            取消
                        </button>
                        <button type="submit" id="saveConfig"
                                style="padding: 10px 16px; border: none; background: #10a37f; color: white; border-radius: 6px; font-size: 14px; cursor: pointer;">
                            保存配置
                        </button>
                    </div>
                </form>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const form = modal.querySelector('#supabaseConfigForm');
            const cancelBtn = modal.querySelector('#cancelConfig');

            form.addEventListener('submit', (e) => {
                e.preventDefault();

                const url = document.getElementById('supabaseUrl').value.trim();
                const key = document.getElementById('supabaseKey').value.trim();
                const table = document.getElementById('tableName').value.trim() || 'chat_logs';

                if (!url || !key) {
                    alert('请填写完整的配置信息');
                    return;
                }

                CONFIG.set('SUPABASE_URL', url);
                CONFIG.set('SUPABASE_ANON_KEY', key);
                CONFIG.set('TABLE_NAME', table);

                document.body.removeChild(overlay);
                callback(true);
            });

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                callback(false);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    callback(false);
                }
            });

            setTimeout(() => {
                document.getElementById('supabaseUrl').focus();
            }, 100);
        }
    },

    // Batch conversation fetcher
    BatchFetcher: {
        async getConversationsList(limit = 20) {
            const token = await this.getAccessToken();
            if (!token) {
                throw new Error('无法获取访问令牌');
            }

            const apiBase = location.origin + '/backend-api';
            const url = `${apiBase}/conversations?offset=0&limit=${limit}&order=updated`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    onload: function(response) {
                        if (response.status !== 200) {
                            reject(new Error(`获取对话列表失败: ${response.status}`));
                            return;
                        }
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data.items || []);
                        } catch (e) {
                            reject(new Error('解析响应数据失败'));
                        }
                    },
                    onerror: function(error) {
                        reject(new Error('网络请求失败'));
                    }
                });
            });
        },

        async getConversationDetail(conversationId) {
            const token = await this.getAccessToken();
            if (!token) {
                throw new Error('无法获取访问令牌');
            }

            const apiBase = location.origin + '/backend-api';
            const url = `${apiBase}/conversation/${conversationId}`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    onload: function(response) {
                        if (response.status !== 200) {
                            reject(new Error(`获取对话详情失败: ${response.status}`));
                            return;
                        }
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data);
                        } catch (e) {
                            reject(new Error('解析对话数据失败'));
                        }
                    },
                    onerror: function(error) {
                        reject(new Error('网络请求失败'));
                    }
                });
            });
        },

        async getAccessToken() {
            // 从页面上下文获取访问令牌
            try {
                const ctx = window.__remixContext?.state?.loaderData?.root?.clientBootstrap?.session?.accessToken;
                if (ctx) return ctx;
            } catch {}
            try {
                const nextUser = window.__NEXT_DATA__?.props?.pageProps?.accessToken;
                if (nextUser) return nextUser;
            } catch {}

            // 从API获取
            try {
                const response = await fetch('/api/auth/session');
                if (!response.ok) return null;
                const data = await response.json();
                return data?.accessToken || null;
            } catch {
                return null;
            }
        }
    },

    // Data extraction utilities
    DataExtractor: {
        getChatId() {
            const url = window.location.href;
            const match = url.match(/\/c\/([a-f0-9-]+)/);
            return match ? match[1] : null;
        },

        extractViaDOM() {
            const messages = [];
            const chatElements = document.querySelectorAll('[data-message-author-role]');

            chatElements.forEach((element, index) => {
                const role = element.getAttribute('data-message-author-role');
                const clonedElement = element.cloneNode(true);

                // Remove buttons, SVGs, and other UI elements
                const uiElements = clonedElement.querySelectorAll('button, svg, [role="button"], [data-testid*="copy"], [data-testid*="edit"]');
                uiElements.forEach(el => el.remove());

                const text = clonedElement.innerText.trim();
                const html = clonedElement.innerHTML;

                if (text && (role === 'user' || role === 'assistant')) {
                    messages.push({
                        idx: index,
                        role: role,
                        text: text,
                        html: html
                    });
                }
            });

            return messages;
        },

        generateHash(text) {
            let hash = 0;
            for (let i = 0; i < text.length; i++) {
                const char = text.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash).toString(16);
        },

        normalizeConversation(conv) {
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
                    text = JSON.stringify(msg.content);
                }
                items.push({ id: msg.id, ts: msg.create_time || 0, role, text });
            }
            items.sort((a,b) => (a.ts||0) - (b.ts||0));
            return items.map((m, idx) => ({ idx, role: m.role, text: m.text, html: '' }));
        }
    },

    // Main syncer class
    ChatSyncer: {
        async syncConversation() {
            try {
                // 检查配置
                const url = CONFIG.get('SUPABASE_URL');
                const key = CONFIG.get('SUPABASE_ANON_KEY');

                console.log('Debug - 检查配置:', {
                    url: url ? '已设置' : '未设置',
                    key: key ? '已设置' : '未设置',
                    gmUrl: GM_getValue('chat_syncer.supabase_url', ''),
                    gmKey: GM_getValue('chat_syncer.supabase_key', '')
                });

                if (!url || !key) {
                    ChatGPTModule.UI.showStatus('需要配置 Supabase 信息', 'error');
                    const configResult = await ChatGPTModule.UI.promptConfig();
                    if (!configResult) {
                        ChatGPTModule.UI.showStatus('配置取消', 'error');
                        return;
                    }
                }

                ChatGPTModule.UI.showStatus('正在提取对话数据...', 'info');

                // 提取对话数据
                const chatId = ChatGPTModule.DataExtractor.getChatId();
                const messages = ChatGPTModule.DataExtractor.extractViaDOM();

                if (messages.length === 0) {
                    ChatGPTModule.UI.showStatus('未找到对话消息', 'error');
                    return;
                }

                // 创建上传记录
                const record = {
                    collected_at: new Date().toISOString(),
                    started_at: null, // 单个同步无法获取创建时间
                    chat_id: chatId,
                    chat_url: window.location.href,
                    chat_title: document.title,
                    page_title: document.querySelector('h1, h2, h3')?.textContent?.trim() || '',
                    messages: messages,
                    meta: {
                        user_agent: navigator.userAgent,
                        language: navigator.language,
                        viewport: {
                            width: window.innerWidth,
                            height: window.innerHeight
                        },
                        source: 'unified_script',
                        version: '1.1.5'
                    }
                };

                ChatGPTModule.UI.showStatus('正在上传到 Supabase...', 'info');

                // 上传到 Supabase
                await this.uploadToSupabase(record);

                ChatGPTModule.UI.showStatus('✅ 对话已成功同步到 Supabase!', 'success');

            } catch (error) {
                console.error('同步失败:', error);
                ChatGPTModule.UI.showStatus('❌ 同步失败: ' + error.message, 'error');
            }
        },

        async uploadToSupabase(record) {
            const url = `${CONFIG.get('SUPABASE_URL')}/rest/v1/${CONFIG.get('TABLE_NAME')}`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: {
                        'apikey': CONFIG.get('SUPABASE_ANON_KEY'),
                        'Authorization': `Bearer ${CONFIG.get('SUPABASE_ANON_KEY')}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    data: JSON.stringify(record),
                    onload: function(response) {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response);
                        } else {
                            let errorMessage = `HTTP ${response.status}`;

                            // 尝试解析错误响应
                            try {
                                const errorData = JSON.parse(response.responseText);
                                if (errorData.message) {
                                    errorMessage += `: ${errorData.message}`;
                                } else if (errorData.hint) {
                                    errorMessage += `: ${errorData.hint}`;
                                } else if (errorData.details) {
                                    errorMessage += `: ${errorData.details}`;
                                } else {
                                    errorMessage += `: ${response.responseText}`;
                                }
                            } catch (e) {
                                // 如果解析失败，使用原始响应文本
                                errorMessage += `: ${response.responseText}`;
                            }

                            reject(new Error(errorMessage));
                        }
                    },
                    onerror: function(error) {
                        reject(new Error('网络错误 - 无法连接到 Supabase 服务器'));
                    }
                });
            });
        }
    },

    // Batch syncer class
    BatchSyncer: {
        isRunning: false,
        shouldCancel: false,

        // 安全地转换时间戳为ISO字符串
        safeTimestampToISO(timestamp) {
            // 只排除 null、undefined 和 NaN，但保留有效的 0
            if (timestamp == null || isNaN(timestamp)) return null;
            try {
                const date = new Date(timestamp * 1000);
                if (isNaN(date.getTime())) return null;
                return date.toISOString();
            } catch (error) {
                console.warn('时间戳转换失败:', timestamp, error);
                return null;
            }
        },

        async startBatchSync(limit = 20) {
            if (this.isRunning) {
                ChatGPTModule.UI.showStatus('批量同步正在进行中...', 'info');
                return;
            }

            // 检查配置
            const url = CONFIG.get('SUPABASE_URL');
            const key = CONFIG.get('SUPABASE_ANON_KEY');

            if (!url || !key) {
                ChatGPTModule.UI.showStatus('需要先配置 Supabase 信息', 'error');
                const configResult = await ChatGPTModule.UI.promptConfig();
                if (!configResult) return;
            }

            this.isRunning = true;
            this.shouldCancel = false;

            const modal = ChatGPTModule.UI.createProgressModal();
            document.body.appendChild(modal);

            const cancelBtn = modal.querySelector('#cancel-batch');
            const closeBtn = modal.querySelector('#close-modal');
            const progressBar = modal.querySelector('#progress-bar');
            const progressText = modal.querySelector('#progress-text');
            const successCount = modal.querySelector('#success-count');
            const errorCount = modal.querySelector('#error-count');
            const skipCount = modal.querySelector('#skip-count');
            const errorDetails = modal.querySelector('#error-details');
            const errorList = modal.querySelector('#error-list');

            let stats = { success: 0, error: 0, skip: 0 };
            let errorMessages = [];

            cancelBtn.onclick = () => {
                this.shouldCancel = true;
                cancelBtn.textContent = '正在取消...';
                cancelBtn.disabled = true;
            };

            closeBtn.onclick = () => {
                document.body.removeChild(modal);
                this.isRunning = false;
            };

            try {
                // 获取对话列表
                progressText.textContent = `正在获取最近${limit}条对话...`;
                const conversations = await ChatGPTModule.BatchFetcher.getConversationsList(limit);

                if (conversations.length === 0) {
                    progressText.textContent = '没有找到对话';
                    cancelBtn.style.display = 'none';
                    closeBtn.style.display = 'inline-block';
                    return;
                }

                progressText.textContent = `找到 ${conversations.length} 条对话，开始同步...`;

                // 批量处理
                for (let i = 0; i < conversations.length; i++) {
                    if (this.shouldCancel) {
                        progressText.textContent = '同步已取消';
                        break;
                    }

                    const conv = conversations[i];
                    const progress = ((i + 1) / conversations.length) * 100;
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `正在处理: ${conv.title || 'Untitled'} (${i + 1}/${conversations.length})`;

                    try {
                        await this.syncSingleConversation(conv);
                        stats.success++;
                        successCount.textContent = stats.success;
                    } catch (error) {
                        console.error(`同步对话 ${conv.id} 失败:`, error);
                        if (error.message.includes('已存在')) {
                            stats.skip++;
                            skipCount.textContent = stats.skip;
                        } else {
                            stats.error++;
                            errorCount.textContent = stats.error;

                            // 记录失败详情
                            const errorDetail = `• "${conv.title || 'Untitled'}": ${error.message}`;
                            errorMessages.push(errorDetail);

                            // 显示错误详情区域
                            errorDetails.style.display = 'block';
                            errorList.innerHTML = errorMessages.join('<br>');
                        }
                    }

                    // 添加延迟避免API限流
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (!this.shouldCancel) {
                    progressText.textContent = `同步完成！成功 ${stats.success} 条，失败 ${stats.error} 条，跳过 ${stats.skip} 条`;
                }

            } catch (error) {
                console.error('批量同步失败:', error);
                progressText.textContent = '同步失败: ' + error.message;
                stats.error++;
                errorCount.textContent = stats.error;

                // 显示批量同步失败的具体原因
                const errorDetail = `• 批量同步失败: ${error.message}`;
                errorMessages.push(errorDetail);
                errorDetails.style.display = 'block';
                errorList.innerHTML = errorMessages.join('<br>');
            } finally {
                cancelBtn.style.display = 'none';
                closeBtn.style.display = 'inline-block';
                this.isRunning = false;
            }
        },

        async syncSingleConversation(conversationInfo) {
            // 获取详细对话内容
            const conv = await ChatGPTModule.BatchFetcher.getConversationDetail(conversationInfo.id);
            const messages = ChatGPTModule.DataExtractor.normalizeConversation(conv);

            if (messages.length === 0) {
                throw new Error('对话无有效消息');
            }

            // 创建上传记录
            const record = {
                collected_at: new Date().toISOString(),
                started_at: this.safeTimestampToISO(conversationInfo.create_time),
                chat_id: conv.id || conversationInfo.id,
                chat_url: `https://chatgpt.com/c/${conversationInfo.id}`,
                chat_title: conv.title || conversationInfo.title || 'Untitled',
                page_title: conv.title || conversationInfo.title || '',
                messages: messages,
                meta: {
                    user_agent: navigator.userAgent,
                    language: navigator.language,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    source: 'batch_sync',
                    version: '1.1.5',
                    batch_sync: true,
                    conversation_create_time: conversationInfo.create_time,
                    conversation_update_time: conversationInfo.update_time
                }
            };

            // 检查是否已存在
            const textForHash = messages.map(m => `${m.role}:${m.text}`).join('\n');
            const curHash = this.generateHash(textForHash);
            const hashKey = `chat_syncer.lasthash::${record.chat_id}`;
            const lastHash = GM_getValue(hashKey, '');

            if (lastHash === curHash) {
                throw new Error('对话已存在，跳过');
            }

            // 上传到 Supabase
            await ChatGPTModule.ChatSyncer.uploadToSupabase(record);
            GM_setValue(hashKey, curHash);
        },

        generateHash(text) {
            return ChatGPTModule.DataExtractor.generateHash(text);
        }
    },

    // Keyboard shortcut handler
    setupKeyboardShortcut() {
        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
                event.preventDefault();
                ChatGPTModule.ChatSyncer.syncConversation();
            }
        });
    },

    // Initialize ChatGPT functionality
    init() {
        console.log('ChatGPT Module initializing...');

        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }

        // Inject theme CSS for dark mode support
        injectThemeCSS();

        const pageType = PageDetector.getCurrentPageType();

        if (pageType === 'chatgpt_home') {
            // 主页：显示批量同步按钮
            const batchSyncButton = this.UI.createBatchSyncButton();
            document.body.appendChild(batchSyncButton);
            console.log('ChatGPT 主页批量同步功能已加载');
        } else if (pageType === 'chatgpt_conversation') {
            // 对话页：显示普通同步按钮
            const syncButton = this.UI.createSyncButton();
            document.body.appendChild(syncButton);

            // Setup keyboard shortcut
            this.setupKeyboardShortcut();
            console.log('ChatGPT 对话页同步功能已加载');
        }
    }
};


// ===============================
// SUPABASE MODULE
// ===============================

const SupabaseModule = {
    // Helper to extract project info from the current page
    SupabaseHelper: {
        getProjectId() {
            const url = window.location.href;
            const match = url.match(/project\/([a-zA-Z0-9-]+)/);
            return match ? match[1] : null;
        },

        getProjectUrl() {
            const projectId = this.getProjectId();
            return projectId ? `https://${projectId}.supabase.co` : null;
        },

        getAnonKey() {
            // Try to find the anon key from the page - support input elements
            const keyElements = document.querySelectorAll('code, span[class*="font-mono"], pre, input[type="text"], input[type="password"], textarea');
            for (const element of keyElements) {
                const text = element.textContent || element.innerText || element.value;
                if (text && text.startsWith('eyJ') && text.includes('.') && text.length > 100) {
                    return text.trim();
                }
            }
            return null;
        },

        extractConfigFromPage() {
            return {
                url: this.getProjectUrl(),
                key: this.getAnonKey(),
                projectId: this.getProjectId()
            };
        }
    },

    // UI for the config helper
    ConfigUI: {
        createConfigButton() {
            const button = document.createElement('button');
            button.innerHTML = '🚀 配置 ChatGPT Syncer';
            button.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: #10a37f;
                color: white;
                border: none;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transition: all 0.2s ease;
                max-width: 200px;
            `;

            button.onmouseover = () => {
                button.style.background = '#0d8f6b';
                button.style.transform = 'translateY(-2px)';
            };

            button.onmouseout = () => {
                button.style.background = '#10a37f';
                button.style.transform = 'translateY(0)';
            };

            button.onclick = () => this.showConfigModal();
            return button;
        },

        showConfigModal() {
            const config = SupabaseModule.SupabaseHelper.extractConfigFromPage();

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: var(--surface-primary, white);
                color: var(--text-primary, #000);
                border-radius: 12px;
                padding: 24px;
                max-width: 600px;
                width: 90%;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                max-height: 80vh;
                overflow-y: auto;
            `;

            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: var(--text-primary, #1f2937);">ChatGPT Syncer 配置</h2>
                    <p style="margin: 0; font-size: 14px; color: var(--text-secondary, #6b7280);">从当前 Supabase 项目自动提取的配置信息</p>
                </div>

                ${config.url && config.key ? `
                <div style="background: #f0fdf4; border: 1px solid #10b981; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 1.5;">
                    <strong>✅ 配置信息已检测到</strong><br>
                    点击"直接保存配置"按钮，配置将自动保存，然后就可以在 ChatGPT 页面直接同步对话了！
                </div>
                ` : `
                <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 1.5;">
                    <strong>⚠️ 配置信息不完整</strong><br>
                    请确保您在 Settings → API 页面，并且页面已完全加载显示密钥信息
                </div>
                `}

                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: var(--text-primary, #374151); margin-bottom: 6px;">
                        项目 ID
                    </label>
                    <input type="text" value="${config.projectId || '未检测到'}" readonly
                           style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #f9fafb; box-sizing: border-box;">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: var(--text-primary, #374151); margin-bottom: 6px;">
                        Supabase URL
                    </label>
                    <input type="text" value="${config.url || '未检测到'}" readonly
                           style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #f9fafb; box-sizing: border-box;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: var(--text-primary, #374151); margin-bottom: 6px;">
                        匿名密钥 (anon key)
                    </label>
                    <textarea readonly rows="3"
                              style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #f9fafb; resize: vertical; box-sizing: border-box;">${config.key || '未检测到 - 请确保在 Settings > API 页面'}</textarea>
                </div>

                <div style="display: flex; gap: 12px; justify-content: center; margin-bottom: 16px;">
                    ${config.url && config.key ? `
                    <button type="button" id="saveConfigBtn"
                            style="padding: 12px 24px; border: none; background: #10a37f; color: white; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 163, 127, 0.3);">
                        🚀 直接保存配置
                    </button>
                    ` : `
                    <button type="button" disabled
                            style="padding: 12px 24px; border: none; background: #9ca3af; color: white; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: not-allowed;">
                        配置信息不完整
                    </button>
                    `}
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" onclick="this.closest('div').parentNode.parentNode.remove()"
                            style="padding: 8px 16px; border: 1px solid #d1d5db; background: var(--surface-secondary, white); color: var(--text-primary, #374151); border-radius: 6px; font-size: 14px; cursor: pointer;">
                        关闭
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Add event listeners after modal is added to DOM
            if (config.url && config.key) {
                const saveBtn = modal.querySelector('#saveConfigBtn');
                saveBtn.addEventListener('click', () => {
                    this.saveConfigToStorage(config);
                    document.body.removeChild(overlay);
                });
            }

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                }
            });
        },

        saveConfigToStorage(config) {
            try {
                console.log('开始保存配置:', config);

                // Check if GM API is available
                if (typeof GM_setValue === 'undefined') {
                    console.error('GM_setValue 不可用');
                    this.showStatus('❌ GM API 不可用，请检查 Tampermonkey 设置', 'error');
                    return;
                }

                // Save using GM API for cross-domain compatibility
                console.log('保存到 GM 存储...');
                GM_setValue('chat_syncer.supabase_url', config.url);
                GM_setValue('chat_syncer.supabase_key', config.key);
                GM_setValue('chat_syncer.table', 'chat_logs');

                // Verify GM storage
                const savedUrl = GM_getValue('chat_syncer.supabase_url', '');
                const savedKey = GM_getValue('chat_syncer.supabase_key', '');
                console.log('GM 存储验证:', {
                    savedUrl: savedUrl ? '✓' : '✗',
                    savedKey: savedKey ? '✓' : '✗'
                });

                // Also save to localStorage for backward compatibility
                console.log('保存到 localStorage...');
                localStorage.setItem('chatsyncer_supabase_url', config.url);
                localStorage.setItem('chatsyncer_supabase_anon_key', config.key);
                localStorage.setItem('chatsyncer_table_name', 'chat_logs');

                if (savedUrl && savedKey) {
                    this.showStatus('✅ 配置已保存！现在可以在 ChatGPT 页面直接同步对话', 'success');
                } else {
                    this.showStatus('⚠️ 配置保存到 localStorage，但 GM 存储可能失败', 'error');
                }
            } catch (error) {
                console.error('保存配置时出错:', error);
                this.showStatus('❌ 保存失败：' + error.message, 'error');
            }
        },

        showStatus(message, type = 'info') {
            const status = document.createElement('div');
            status.textContent = message;
            status.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 10002;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                max-width: 300px;
                background: ${type === 'success' ? '#10b981' : '#3b82f6'};
                color: white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;

            document.body.appendChild(status);
            setTimeout(() => {
                if (status.parentNode) {
                    status.parentNode.removeChild(status);
                }
            }, 3000);
        }
    },

    // Auto-detection logic
    AutoDetect: {
        isAPIPage() {
            return window.location.pathname.includes('/settings/api') ||
                   document.querySelector('[data-testid="api-settings"]') ||
                   document.querySelector('h1, h2, h3')?.textContent?.includes('API');
        },

        waitForKeyToLoad() {
            const observer = new MutationObserver((mutations) => {
                const config = SupabaseModule.SupabaseHelper.extractConfigFromPage();
                if (config.key && config.url) {
                    observer.disconnect();
                    SupabaseModule.ConfigUI.showStatus('检测到完整配置信息！点击右上角按钮保存', 'success');
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });

            // Stop observing after 10 seconds
            setTimeout(() => observer.disconnect(), 10000);
        }
    },

    // Initialize Supabase functionality
    init() {
        console.log('Supabase Module initializing...');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }

        // Inject theme CSS for dark mode support
        injectThemeCSS();

        // Add config button
        const configButton = this.ConfigUI.createConfigButton();
        document.body.appendChild(configButton);

        // Auto-detect if we're on API settings page
        if (this.AutoDetect.isAPIPage()) {
            this.AutoDetect.waitForKeyToLoad();
        }

        console.log('Supabase Config Helper 已加载 (统一版本)');
    }
};


// ===============================
// UNIFIED INITIALIZATION
// ===============================

function initialize() {
    console.log('ChatGPT Supabase Syncer (Unified) 开始初始化...');
    console.log('当前页面:', location.href);
    console.log('页面类型:', PageDetector.getCurrentPageType());

    const pageType = PageDetector.getCurrentPageType();

    switch (pageType) {
        case 'chatgpt_home':
        case 'chatgpt_conversation':
            ChatGPTModule.init();
            break;
        case 'supabase':
            SupabaseModule.init();
            break;
        default:
            console.log('未识别的页面类型，脚本不会激活');
    }
}

// Start initialization
initialize();

// ===============================
// TEST EXPORTS (for testing only)
// ===============================

// Expose objects for testing if in test environment
if (typeof global !== 'undefined' && global.process && global.process.env) {
    global.CONFIG = CONFIG;
    global.PageDetector = PageDetector;
    global.ChatGPTModule = ChatGPTModule;
    global.SupabaseModule = SupabaseModule;

    // Legacy compatibility for old tests
    global.UI = ChatGPTModule.UI;
    global.DataExtractor = ChatGPTModule.DataExtractor;
    global.ChatSyncer = ChatGPTModule.ChatSyncer;
}



})();
