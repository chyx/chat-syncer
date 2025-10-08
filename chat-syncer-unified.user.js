// ==UserScript==
// @name         ChatGPT Supabase Syncer (Unified)
// @namespace    http://tampermonkey.net/
// @version      1.7.9
// @updateURL    https://raw.githubusercontent.com/chyx/chat-syncer/refs/heads/main/chat-syncer-unified.user.js
// @downloadURL  https://raw.githubusercontent.com/chyx/chat-syncer/refs/heads/main/chat-syncer-unified.user.js
// @description  Unified script: Sync ChatGPT conversations to Supabase & Config helper for Supabase dashboard
// @author       You
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // Injected version number
    const SCRIPT_VERSION = '1.7.9';

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

        /* Spin animation for loading indicator */
        @keyframes spin {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
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
        const isChatGPT = this.isChatGPTPage();
        const hasConv = url.includes('/c/');
        const hasShare = url.includes('/share/');
        const result = isChatGPT && !hasConv && !hasShare;
        console.log('isChatGPTHomePage check:', { url, isChatGPT, hasConv, hasShare, result });
        return result;
    },

    isChatGPTConversationPage() {
        const result = this.isChatGPTPage() && location.href.includes('/c/');
        console.log('isChatGPTConversationPage check:', { url: location.href, result });
        return result;
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
// UI HELPERS - Shared Button Utilities
// ===============================

const UIHelpers = {
    // Common button styles
    buttonStyles: {
        base: `
            position: fixed;
            z-index: 10000;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        `,
        green: {
            background: '#10a37f',
            hoverBackground: '#0d8f6b',
            boxShadow: '0 4px 12px rgba(16,163,127,0.3)',
            hoverBoxShadow: '0 6px 16px rgba(16,163,127,0.4)'
        },
        blue: {
            background: '#0ea5e9',
            hoverBackground: '#0284c7',
            boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
            hoverBoxShadow: '0 6px 16px rgba(14,165,233,0.4)'
        },
        purple: {
            background: '#8b5cf6',
            hoverBackground: '#7c3aed',
            boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
            hoverBoxShadow: '0 6px 16px rgba(139,92,246,0.4)'
        }
    },

    /**
     * Create a styled button with consistent behavior
     * @param {Object} options - Button configuration
     * @param {string} options.text - Button text/HTML
     * @param {function} options.onClick - Click handler
     * @param {string} options.position - Position object {bottom, right, top, left}
     * @param {string} options.color - Color theme: 'green', 'blue', 'purple'
     * @param {string} options.id - Optional button ID
     * @param {number} options.zIndex - Optional z-index override
     * @returns {HTMLButtonElement} The created button
     */
    createButton({
        text,
        onClick,
        position = { bottom: '20px', right: '20px' },
        color = 'green',
        id = null,
        zIndex = 10000
    }) {
        const button = document.createElement('button');
        if (id) button.id = id;

        const theme = this.buttonStyles[color] || this.buttonStyles.green;

        // Build position CSS
        const positionCss = Object.entries(position)
            .map(([key, value]) => `${key}: ${value};`)
            .join('\n');

        button.style.cssText = `
            ${this.buttonStyles.base}
            ${positionCss}
            z-index: ${zIndex};
            background: ${theme.background};
            box-shadow: ${theme.boxShadow};
        `;

        button.innerHTML = text;

        // Hover effects
        button.onmouseover = () => {
            button.style.background = theme.hoverBackground;
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = theme.hoverBoxShadow;
        };

        button.onmouseout = () => {
            button.style.background = theme.background;
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = theme.boxShadow;
        };

        button.onclick = onClick;

        return button;
    },

    /**
     * Create update script button (visible on hover)
     * @param {HTMLElement} container - Parent container to attach hover listener
     * @returns {HTMLButtonElement} The update button
     */
    createUpdateScriptButton(container) {
        // Get current version (injected during build)
        const version = typeof SCRIPT_VERSION !== 'undefined' ? SCRIPT_VERSION : 'unknown';

        const updateButton = this.createButton({
            text: `🔄 更新脚本 (v${version})`,
            onClick: () => {
                window.open('https://raw.githubusercontent.com/chyx/chat-syncer/refs/heads/main/chat-syncer-unified.user.js', '_blank');
            },
            position: {},
            color: 'blue',
            id: 'update-script-button'
        });

        // Override position to relative for container usage
        updateButton.style.position = 'relative';

        // Initially hidden
        updateButton.style.opacity = '0';
        updateButton.style.visibility = 'hidden';
        updateButton.style.maxHeight = '0';
        updateButton.style.overflow = 'hidden';
        updateButton.style.marginTop = '0';

        // Show on container hover
        if (container) {
            let hoverTimer;

            container.addEventListener('mouseenter', () => {
                hoverTimer = setTimeout(() => {
                    updateButton.style.opacity = '1';
                    updateButton.style.visibility = 'visible';
                    updateButton.style.maxHeight = '100px';
                    updateButton.style.marginTop = '12px';
                }, 300); // 300ms delay
            });

            container.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimer);
                updateButton.style.opacity = '0';
                updateButton.style.visibility = 'hidden';
                updateButton.style.maxHeight = '0';
                updateButton.style.marginTop = '0';
            });
        }

        return updateButton;
    },

    /**
     * Create a button container that can hold multiple buttons
     * @param {Object} position - Position object {bottom, right, top, left}
     * @returns {HTMLDivElement} The container element
     */
    createButtonContainer(position = { bottom: '20px', right: '20px' }) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            ${Object.entries(position).map(([key, value]) => `${key}: ${value};`).join('\n')}
            z-index: 10000;
            display: flex;
            flex-direction: column-reverse;
            gap: 12px;
        `;

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #ff4444;
            color: white;
            border: 2px solid white;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 10;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s, visibility 0.2s;
        `;
        closeButton.onclick = () => {
            container.remove();
        };

        // Show close button on hover
        container.addEventListener('mouseenter', () => {
            setTimeout(() => {
                closeButton.style.opacity = '1';
                closeButton.style.visibility = 'visible';
            }, 300);
        });

        container.addEventListener('mouseleave', () => {
            closeButton.style.opacity = '0';
            closeButton.style.visibility = 'hidden';
        });

        container.appendChild(closeButton);

        return container;
    }
};


// ===============================
// CHATGPT MODULE
// ===============================

const ChatGPTModule = {
    // UI Components
    UI: {
        createBatchSyncButton() {
            // Create container for buttons
            const container = UIHelpers.createButtonContainer({ bottom: '80px', right: '20px' });
            container.id = 'batch-sync-container';

            // 主按钮：批量同步最近20条（主页和对话页统一）
            const quickButton = UIHelpers.createButton({
                text: '📚 批量同步最近20条',
                onClick: () => ChatGPTModule.BatchSyncer.startBatchSync(0, 20),
                position: {},
                color: 'purple'
            });
            quickButton.style.position = 'relative';
            quickButton.style.minWidth = '180px';
            quickButton.style.textAlign = 'center';
            quickButton.style.fontWeight = '600';

            // 自定义同步按钮（hover显示）
            const customButton = UIHelpers.createButton({
                text: '⚙️ 自定义同步',
                onClick: () => this.showCustomSyncModal(),
                position: {},
                color: 'green'
            });
            customButton.style.position = 'relative';
            customButton.style.minWidth = '180px';
            customButton.style.textAlign = 'center';
            customButton.style.fontWeight = '600';
            customButton.style.opacity = '0';
            customButton.style.visibility = 'hidden';
            customButton.style.maxHeight = '0';
            customButton.style.overflow = 'hidden';

            // 更新脚本按钮（hover显示）
            const updateButton = UIHelpers.createUpdateScriptButton(container);
            updateButton.style.minWidth = '180px';
            updateButton.style.textAlign = 'center';
            updateButton.style.fontWeight = '600';

            // Hover 显示/隐藏额外按钮
            let hoverTimer;
            container.addEventListener('mouseenter', () => {
                hoverTimer = setTimeout(() => {
                    customButton.style.opacity = '1';
                    customButton.style.visibility = 'visible';
                    customButton.style.maxHeight = '100px';
                    updateButton.style.opacity = '1';
                    updateButton.style.visibility = 'visible';
                    updateButton.style.maxHeight = '100px';
                }, 300);
            });

            container.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimer);
                customButton.style.opacity = '0';
                customButton.style.visibility = 'hidden';
                customButton.style.maxHeight = '0';
                updateButton.style.opacity = '0';
                updateButton.style.visibility = 'hidden';
                updateButton.style.maxHeight = '0';
            });

            // 因为使用 column-reverse，按正常顺序添加即可（最后添加的会显示在最下面）
            container.appendChild(quickButton);
            container.appendChild(customButton);
            container.appendChild(updateButton);
            return container;
        },

        createPasteButton(container) {
            const button = UIHelpers.createButton({
                text: '📥 获取远程内容',
                onClick: async () => {
                    await this.handlePaste();
                },
                position: {},
                color: 'blue'
            });
            button.id = 'paste-button';
            button.style.position = 'relative';
            button.style.minWidth = '180px';
            button.style.textAlign = 'center';
            button.style.fontWeight = '600';

            // 默认收起
            button.style.opacity = '0';
            button.style.visibility = 'hidden';
            button.style.maxHeight = '0';
            button.style.overflow = 'hidden';

            return button;
        },

        async handlePaste() {
            try {
                this.showStatus('正在获取远程内容...', 'info');

                const clipboardContent = await this.fetchClipboardContent();

                if (!clipboardContent) {
                    this.showStatus('远程内容为空', 'error');
                    return;
                }

                // 查找ChatGPT输入框并填入内容
                const inputBox = this.findChatInputBox();
                if (!inputBox) {
                    this.showStatus('未找到输入框', 'error');
                    return;
                }

                // 填入内容
                this.insertTextToInput(inputBox, clipboardContent);
                this.showStatus('✅ 远程内容已粘贴到输入框', 'success');

            } catch (error) {
                console.error('获取远程内容失败:', error);
                this.showStatus('操作失败: ' + error.message, 'error');
            }
        },

        findChatInputBox() {
            // ChatGPT的输入框选择器（可能需要根据实际情况调整）
            const selectors = [
                '#prompt-textarea',
                'textarea[placeholder*="Message"]',
                'textarea[data-id="root"]',
                'div[contenteditable="true"]',
                'textarea'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    return element;
                }
            }

            return null;
        },

        insertTextToInput(inputElement, text) {
            // 处理不同类型的输入框
            if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
                inputElement.value = text;
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                inputElement.focus();
            } else if (inputElement.contentEditable === 'true') {
                inputElement.textContent = text;
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                inputElement.focus();
            }
        },

        async fetchClipboardContent() {
            // 直接获取 id=1 的记录
            const url = `${CONFIG.get('SUPABASE_URL')}/rest/v1/clipboard?select=content&id=eq.1&limit=1`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'apikey': CONFIG.get('SUPABASE_ANON_KEY'),
                        'Authorization': `Bearer ${CONFIG.get('SUPABASE_ANON_KEY')}`,
                        'Content-Type': 'application/json'
                    },
                    onload: function(response) {
                        if (response.status === 200) {
                            try {
                                const data = JSON.parse(response.responseText);
                                if (data && data.length > 0) {
                                    resolve(data[0].content);
                                } else {
                                    resolve(null);
                                }
                            } catch (e) {
                                reject(new Error('解析剪贴板数据失败'));
                            }
                        } else {
                            reject(new Error(`获取剪贴板内容失败: ${response.status}`));
                        }
                    },
                    onerror: function() {
                        reject(new Error('网络请求失败'));
                    }
                });
            });
        },

        showCustomSyncModal() {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10004;
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
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            `;

            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: var(--text-primary, #1f2937);">自定义批量同步</h3>
                    <p style="margin: 0; font-size: 14px; color: var(--text-secondary, #6b7280);">设置同步的起始位置和数量</p>
                </div>

                <form id="customSyncForm">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: var(--text-primary, #374151); margin-bottom: 6px;">
                            Offset (起始位置)
                        </label>
                        <input type="number" id="syncOffset" value="0" min="0" step="1"
                               style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                        <small style="color: var(--text-secondary, #6b7280); font-size: 12px;">从第几条开始（0表示从最新的开始）</small>
                    </div>

                    <div style="margin-bottom: 24px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: var(--text-primary, #374151); margin-bottom: 6px;">
                            Limit (同步数量)
                        </label>
                        <input type="number" id="syncLimit" value="20" min="1" max="100" step="1"
                               style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                        <small style="color: var(--text-secondary, #6b7280); font-size: 12px;">要同步的对话数量（最多100条）</small>
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" id="cancelCustomSync"
                                style="padding: 10px 16px; border: 1px solid #d1d5db; background: var(--surface-secondary, white); color: var(--text-primary, #374151); border-radius: 6px; font-size: 14px; cursor: pointer;">
                            取消
                        </button>
                        <button type="submit"
                                style="padding: 10px 16px; border: none; background: #059669; color: white; border-radius: 6px; font-size: 14px; cursor: pointer;">
                            开始同步
                        </button>
                    </div>
                </form>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const form = modal.querySelector('#customSyncForm');
            const cancelBtn = modal.querySelector('#cancelCustomSync');

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const offset = parseInt(document.getElementById('syncOffset').value) || 0;
                const limit = parseInt(document.getElementById('syncLimit').value) || 20;
                document.body.removeChild(overlay);
                ChatGPTModule.BatchSyncer.startBatchSync(offset, limit);
            });

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                }
            });

            setTimeout(() => {
                document.getElementById('syncLimit').focus();
            }, 100);
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
                    <div>✅ <span id="success-count">0</span> 条新增</div>
                    <div>🔄 <span id="update-count">0</span> 条更新</div>
                    <div>⏭️ <span id="skip-count">0</span> 条无变化</div>
                    <div>❌ <span id="error-count">0</span> 条失败</div>
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
        async getConversationsList(offset = 0, limit = 20) {
            const token = await this.getAccessToken();
            if (!token) {
                throw new Error('无法获取访问令牌');
            }

            const apiBase = location.origin + '/backend-api';
            const url = `${apiBase}/conversations?offset=${offset}&limit=${limit}&order=updated`;

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

                // 跳过 o1/o3 元数据消息
                if (ct === 'model_editable_context' || ct === 'thoughts' || ct === 'reasoning_recap') {
                    continue;
                }

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
                    // 未知类型：检查是否为搜索查询等元数据
                    const contentStr = JSON.stringify(msg.content);
                    if (contentStr.includes('search_query') || contentStr.includes('content_type')) {
                        continue; // 跳过元数据
                    }
                    text = contentStr;
                }
                items.push({ id: msg.id, ts: msg.create_time || 0, role, text });
            }
            items.sort((a,b) => (a.ts||0) - (b.ts||0));
            return items.map((m, idx) => ({ idx, role: m.role, text: m.text, html: '' }));
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

        async startBatchSync(offset = 0, limit = 20) {
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
            const updateCount = modal.querySelector('#update-count');
            const skipCount = modal.querySelector('#skip-count');
            const errorCount = modal.querySelector('#error-count');
            const errorDetails = modal.querySelector('#error-details');
            const errorList = modal.querySelector('#error-list');

            let stats = { success: 0, update: 0, skip: 0, error: 0 };
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
                const offsetText = offset > 0 ? `从第${offset + 1}条开始，` : '';
                progressText.textContent = `正在获取对话列表（${offsetText}共${limit}条）...`;
                const conversations = await ChatGPTModule.BatchFetcher.getConversationsList(offset, limit);

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
                        const result = await this.syncSingleConversation(conv);
                        if (result.status === 'new') {
                            stats.success++;
                            successCount.textContent = stats.success;
                        } else if (result.status === 'updated') {
                            stats.update++;
                            updateCount.textContent = stats.update;
                        } else if (result.status === 'unchanged') {
                            stats.skip++;
                            skipCount.textContent = stats.skip;
                        }
                    } catch (error) {
                        console.error(`同步对话 ${conv.id} 失败:`, error);
                        stats.error++;
                        errorCount.textContent = stats.error;

                        // 记录失败详情
                        const errorDetail = `• "${conv.title || 'Untitled'}": ${error.message}`;
                        errorMessages.push(errorDetail);

                        // 显示错误详情区域
                        errorDetails.style.display = 'block';
                        errorList.innerHTML = errorMessages.join('<br>');
                    }

                    // 添加延迟避免API限流
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (!this.shouldCancel) {
                    progressText.textContent = `同步完成！新增 ${stats.success} 条，更新 ${stats.update} 条，无变化 ${stats.skip} 条，失败 ${stats.error} 条`;
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

            const chatId = conv.id || conversationInfo.id;

            // 先检查数据库中是否存在该对话
            const existingRecord = await this.fetchExistingRecord(chatId);

            // 创建上传记录
            const createTime = this.safeTimestampToISO(conversationInfo.create_time);
            const record = {
                created_at: createTime || new Date().toISOString(),
                collected_at: new Date().toISOString(),
                started_at: createTime,
                chat_id: chatId,
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
                    version: '1.7.9',
                    batch_sync: true,
                    conversation_create_time: conversationInfo.create_time,
                    conversation_update_time: conversationInfo.update_time
                }
            };

            // 如果存在记录，比较内容是否有变化
            if (existingRecord) {
                const messagesChanged = this.compareMessages(existingRecord.messages, messages);
                if (!messagesChanged) {
                    // 内容完全相同，无需更新
                    return { status: 'unchanged' };
                }
            }

            // 上传到 Supabase (数据库会自动处理重复的chat_id)
            const response = await this.uploadToSupabase(record);

            // 判断操作类型
            if (existingRecord) {
                return { status: 'updated' };
            } else {
                return { status: 'new' };
            }
        },

        // 上传记录到 Supabase
        async uploadToSupabase(record) {
            const url = `${CONFIG.get('SUPABASE_URL')}/rest/v1/${CONFIG.get('TABLE_NAME')}?on_conflict=chat_id`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: {
                        'apikey': CONFIG.get('SUPABASE_ANON_KEY'),
                        'Authorization': `Bearer ${CONFIG.get('SUPABASE_ANON_KEY')}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=representation'
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
        },

        // 从 Supabase 获取现有记录
        async fetchExistingRecord(chatId) {
            const url = `${CONFIG.get('SUPABASE_URL')}/rest/v1/${CONFIG.get('TABLE_NAME')}?chat_id=eq.${chatId}&select=messages`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'apikey': CONFIG.get('SUPABASE_ANON_KEY'),
                        'Authorization': `Bearer ${CONFIG.get('SUPABASE_ANON_KEY')}`,
                        'Content-Type': 'application/json'
                    },
                    onload: function(response) {
                        if (response.status === 200) {
                            try {
                                const data = JSON.parse(response.responseText);
                                resolve(data && data.length > 0 ? data[0] : null);
                            } catch (e) {
                                resolve(null);
                            }
                        } else {
                            resolve(null);
                        }
                    },
                    onerror: function() {
                        resolve(null);
                    }
                });
            });
        },

        // 比较两个消息数组是否相同
        compareMessages(oldMessages, newMessages) {
            if (!oldMessages || !newMessages) return true;
            if (oldMessages.length !== newMessages.length) return true;

            for (let i = 0; i < oldMessages.length; i++) {
                const oldMsg = oldMessages[i];
                const newMsg = newMessages[i];

                // 比较关键字段
                if (oldMsg.role !== newMsg.role || oldMsg.text !== newMsg.text) {
                    return true;
                }
            }

            return false; // 完全相同
        }
    },

    // Initialize ChatGPT functionality
    init() {
        console.log('ChatGPT Module initializing...');
        console.log('Document ready state:', document.readyState);
        console.log('Current URL:', location.href);

        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }

        // Inject theme CSS for dark mode support
        injectThemeCSS();

        const pageType = PageDetector.getCurrentPageType();
        console.log('Detected page type:', pageType);

        if (pageType === 'chatgpt_home' || pageType === 'chatgpt_conversation') {
            // 主页和对话页都显示批量同步按钮
            console.log('Creating batch sync button...');
            const batchSyncButton = this.UI.createBatchSyncButton();
            console.log('Batch sync button created:', batchSyncButton);
            console.log('Appending to body...');
            document.body.appendChild(batchSyncButton);

            if (pageType === 'chatgpt_conversation') {
                console.log('✅ ChatGPT 对话页批量同步功能已加载');
            } else {
                console.log('✅ ChatGPT 主页批量同步功能已加载');
            }
            console.log('Button in DOM:', document.getElementById('batch-sync-container'));
        } else {
            console.log('⚠️ Page type not recognized, no button will be added');
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
            // Create container for buttons
            const container = UIHelpers.createButtonContainer({ top: '20px', right: '20px' });
            container.id = 'supabase-config-button-container';

            // Create config button
            const configButton = UIHelpers.createButton({
                text: '🚀 配置 ChatGPT Syncer',
                onClick: () => this.showConfigModal(),
                position: {},
                color: 'green'
            });

            configButton.style.position = 'relative';
            configButton.style.top = 'auto';
            configButton.style.right = 'auto';
            configButton.style.maxWidth = '200px';

            // Create update script button
            const updateButton = UIHelpers.createUpdateScriptButton(container);
            updateButton.style.position = 'relative';
            updateButton.style.top = 'auto';
            updateButton.style.right = 'auto';

            container.appendChild(configButton);
            container.appendChild(updateButton);

            return container;
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
// PAGE UPLOADER MODULE
// ===============================

const PageUploaderModule = {
    // Timer for periodic time display updates
    updateTimeTimer: null,

    // Get current domain for per-domain settings
    getCurrentDomain() {
        try {
            if (typeof window === 'undefined' || !window.location || !window.location.hostname) {
                return 'unknown';
            }
            const hostname = window.location.hostname;
            // Remove www. prefix for consistency
            return hostname.replace(/^www\./, '');
        } catch (error) {
            console.error('Error getting domain:', error);
            return 'unknown';
        }
    },

    // Get storage key for current domain
    getStorageKey() {
        const domain = this.getCurrentDomain();
        return `page_uploader_button_visible_${domain}`;
    },

    // Convert HTML to Markdown text
    htmlToMarkdown(html) {
        // Create a temporary DOM element
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove script and style elements
        const scripts = temp.querySelectorAll('script, style, noscript');
        scripts.forEach(el => el.remove());

        // Get the text content
        let text = temp.innerText || temp.textContent || '';

        // Basic cleanup
        text = text
            .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
            .trim();

        // Try to preserve some structure
        const result = this.preserveStructure(temp);

        return result || text;
    },

    preserveStructure(element) {
        let markdown = '';

        const processNode = (node, depth = 0) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                    return text + ' ';
                }
                return '';
            }

            if (node.nodeType !== Node.ELEMENT_NODE) {
                return '';
            }

            let result = '';
            const tagName = node.tagName.toLowerCase();

            // Handle different HTML elements
            switch (tagName) {
                case 'h1':
                    result += '\n# ' + node.textContent.trim() + '\n\n';
                    break;
                case 'h2':
                    result += '\n## ' + node.textContent.trim() + '\n\n';
                    break;
                case 'h3':
                    result += '\n### ' + node.textContent.trim() + '\n\n';
                    break;
                case 'h4':
                    result += '\n#### ' + node.textContent.trim() + '\n\n';
                    break;
                case 'h5':
                    result += '\n##### ' + node.textContent.trim() + '\n\n';
                    break;
                case 'h6':
                    result += '\n###### ' + node.textContent.trim() + '\n\n';
                    break;
                case 'p':
                    result += '\n' + Array.from(node.childNodes).map(n => processNode(n, depth)).join('') + '\n';
                    break;
                case 'br':
                    result += '\n';
                    break;
                case 'strong':
                case 'b':
                    result += '**' + node.textContent.trim() + '**';
                    break;
                case 'em':
                case 'i':
                    result += '*' + node.textContent.trim() + '*';
                    break;
                case 'a':
                    const href = node.getAttribute('href');
                    result += '[' + node.textContent.trim() + '](' + (href || '') + ')';
                    break;
                case 'ul':
                case 'ol':
                    result += '\n';
                    Array.from(node.children).forEach((li, index) => {
                        if (li.tagName.toLowerCase() === 'li') {
                            const bullet = tagName === 'ul' ? '-' : `${index + 1}.`;
                            result += bullet + ' ' + li.textContent.trim() + '\n';
                        }
                    });
                    result += '\n';
                    break;
                case 'code':
                    if (node.parentElement?.tagName.toLowerCase() === 'pre') {
                        result += '\n```\n' + node.textContent + '\n```\n';
                    } else {
                        result += '`' + node.textContent + '`';
                    }
                    break;
                case 'pre':
                    if (node.querySelector('code')) {
                        // Will be handled by the code element
                        result += Array.from(node.childNodes).map(n => processNode(n, depth)).join('');
                    } else {
                        result += '\n```\n' + node.textContent + '\n```\n';
                    }
                    break;
                case 'blockquote':
                    const lines = node.textContent.trim().split('\n');
                    result += '\n' + lines.map(line => '> ' + line).join('\n') + '\n\n';
                    break;
                case 'script':
                case 'style':
                case 'noscript':
                    // Skip these elements
                    break;
                default:
                    // Process children for other elements
                    result += Array.from(node.childNodes).map(n => processNode(n, depth)).join('');
                    break;
            }

            return result;
        };

        markdown = processNode(element);

        // Clean up excessive whitespace
        markdown = markdown
            .replace(/\n{3,}/g, '\n\n')
            .replace(/  +/g, ' ')
            .trim();

        return markdown;
    },

    // Get current page content as markdown
    getCurrentPageAsMarkdown() {
        // Clone the body to avoid modifying the actual page
        const body = document.body.cloneNode(true);

        // Remove common UI elements that aren't content
        const selectorsToRemove = [
            'nav',
            'header',
            'footer',
            '[role="banner"]',
            '[role="navigation"]',
            '[role="complementary"]',
            '.navbar',
            '.header',
            '.footer',
            '.sidebar',
            '.menu',
            '#chat-syncer-button',  // Remove our own button
            'script',
            'style',
            'noscript'
        ];

        selectorsToRemove.forEach(selector => {
            body.querySelectorAll(selector).forEach(el => el.remove());
        });

        return this.preserveStructure(body);
    },

    // Upload page to Supabase
    async uploadPage() {
        const supabaseUrl = CONFIG.get('SUPABASE_URL');
        const supabaseKey = CONFIG.get('SUPABASE_ANON_KEY');

        if (!supabaseUrl || !supabaseKey) {
            alert('请先配置 Supabase 连接信息！\n\n请在 ChatGPT 页面点击同步按钮进行配置。');
            return;
        }

        try {
            // Show loading state
            this.showUploadStatus('正在转换页面内容...');

            const pageUrl = window.location.href;
            const pageTitle = document.title;
            const pageContent = this.getCurrentPageAsMarkdown();

            if (!pageContent || pageContent.length < 10) {
                throw new Error('页面内容为空或太短');
            }

            this.showUploadStatus('正在上传到 Supabase...');

            // Upload to Supabase with UPSERT using GM_xmlhttpRequest (bypasses CSP)
            // Using onConflict parameter for proper UPSERT behavior
            await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${supabaseUrl}/rest/v1/page_uploads?on_conflict=page_url`,
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=minimal'
                    },
                    data: JSON.stringify({
                        page_url: pageUrl,
                        page_title: pageTitle,
                        page_content: pageContent,
                        updated_at: new Date().toISOString(),
                        meta: {
                            user_agent: navigator.userAgent,
                            viewport: {
                                width: window.innerWidth,
                                height: window.innerHeight
                            },
                            content_length: pageContent.length
                        }
                    }),
                    onload: function(response) {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`上传失败: ${response.status} - ${response.responseText}`));
                        }
                    },
                    onerror: function(error) {
                        reject(new Error('网络请求失败'));
                    }
                });
            });

            // Copy formatted text to clipboard
            try {
                const clipboardText = `[In Uploaded Table: ${pageUrl}]`;
                await navigator.clipboard.writeText(clipboardText);
                this.showUploadStatus('✅ 上传成功！已复制到剪贴板', 'success');
            } catch (clipboardError) {
                console.warn('Failed to copy to clipboard:', clipboardError);
                this.showUploadStatus('✅ 上传成功！', 'success');
            }

            // Update upload time display on button
            await this.updateUploadTimeDisplay();

            // Start periodic updates with exponential backoff (1s, 2s, 4s, 8s, ...)
            this.startPeriodicTimeUpdate();

            console.log('Page uploaded successfully:', {
                url: pageUrl,
                title: pageTitle,
                contentLength: pageContent.length
            });

        } catch (error) {
            console.error('Upload error:', error);
            this.showUploadStatus('❌ 上传失败: ' + error.message, 'error');
        }
    },

    // Query last upload time for current page
    async queryLastUploadTime() {
        const supabaseUrl = CONFIG.get('SUPABASE_URL');
        const supabaseKey = CONFIG.get('SUPABASE_ANON_KEY');

        if (!supabaseUrl || !supabaseKey) {
            return null;
        }

        const pageUrl = window.location.href;

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${supabaseUrl}/rest/v1/page_uploads?page_url=eq.${encodeURIComponent(pageUrl)}&select=updated_at`,
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data && data.length > 0) {
                                resolve(data[0].updated_at);
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                },
                onerror: function() {
                    resolve(null);
                }
            });
        });
    },

    // Format relative time (e.g., "2小时前", "3天前")
    formatRelativeTime(timestamp) {
        if (!timestamp) return null;

        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffSeconds < 60) {
            return `${diffSeconds}秒前`;
        } else if (diffMinutes < 60) {
            return `${diffMinutes}分钟前`;
        } else if (diffHours < 24) {
            return `${diffHours}小时前`;
        } else if (diffDays < 30) {
            return `${diffDays}天前`;
        } else if (diffMonths < 12) {
            return `${diffMonths}个月前`;
        } else {
            return `${diffYears}年前`;
        }
    },

    // Show upload status
    showUploadStatus(message, type = 'info') {
        // Remove existing status
        const existing = document.getElementById('page-upload-status');
        if (existing) {
            existing.remove();
        }

        const status = document.createElement('div');
        status.id = 'page-upload-status';

        const bgColor = type === 'success' ? '#10a37f' : type === 'error' ? '#dc2626' : '#3b82f6';

        status.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100000;
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            word-wrap: break-word;
        `;

        status.textContent = message;
        document.body.appendChild(status);

        // Auto remove after delay
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                status.style.transition = 'opacity 0.3s';
                status.style.opacity = '0';
                setTimeout(() => status.remove(), 300);
            }, 3000);
        }
    },

    // Create upload button in bottom-right corner
    async createUploadButton() {
        // Create container for buttons
        const container = UIHelpers.createButtonContainer({ bottom: '20px', right: '20px' });
        container.id = 'page-upload-button-container';

        // Create upload button
        const uploadButton = UIHelpers.createButton({
            text: '📤 Upload Page',
            onClick: () => this.uploadPage(),
            position: {}, // Position handled by container
            color: 'green',
            id: 'page-upload-button',
            zIndex: 99999
        });

        // Remove fixed positioning from button since container handles it
        uploadButton.style.position = 'relative';
        uploadButton.style.bottom = 'auto';
        uploadButton.style.right = 'auto';

        // Add loading indicator
        const timeLabel = document.createElement('span');
        timeLabel.id = 'upload-time-label';
        timeLabel.style.cssText = `
            font-size: 12px;
            color: #6b7280;
            margin-left: 8px;
        `;
        timeLabel.innerHTML = `<span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span>`;
        uploadButton.appendChild(timeLabel);

        // Query and display last upload time
        const lastUploadTime = await this.queryLastUploadTime();
        if (lastUploadTime) {
            const relativeTime = this.formatRelativeTime(lastUploadTime);
            timeLabel.textContent = `(${relativeTime})`;
        } else {
            // Remove loading indicator if no upload record found
            timeLabel.remove();
        }

        // Create paste button (from ChatGPTModule, if available)
        let pasteButton = null;
        if (typeof ChatGPTModule !== 'undefined' && ChatGPTModule.UI && ChatGPTModule.UI.createPasteButton) {
            pasteButton = ChatGPTModule.UI.createPasteButton(container);
        }

        // Create update script button
        const updateButton = UIHelpers.createUpdateScriptButton(container);
        updateButton.style.position = 'relative';
        updateButton.style.bottom = 'auto';
        updateButton.style.right = 'auto';

        // Hover 显示/隐藏额外按钮
        let hoverTimer;
        container.addEventListener('mouseenter', () => {
            hoverTimer = setTimeout(() => {
                if (pasteButton) {
                    pasteButton.style.opacity = '1';
                    pasteButton.style.visibility = 'visible';
                    pasteButton.style.maxHeight = '100px';
                }
                updateButton.style.opacity = '1';
                updateButton.style.visibility = 'visible';
                updateButton.style.maxHeight = '100px';
            }, 300);
        });

        container.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimer);
            if (pasteButton) {
                pasteButton.style.opacity = '0';
                pasteButton.style.visibility = 'hidden';
                pasteButton.style.maxHeight = '0';
            }
            updateButton.style.opacity = '0';
            updateButton.style.visibility = 'hidden';
            updateButton.style.maxHeight = '0';
        });

        container.appendChild(uploadButton);
        if (pasteButton) {
            container.appendChild(pasteButton);
        }
        container.appendChild(updateButton);
        document.body.appendChild(container);

        return container;
    },

    // Toggle upload button visibility (per-domain)
    async toggleUploadButton() {
        const storageKey = this.getStorageKey();
        const currentState = GM_getValue(storageKey, false);
        const newState = !currentState;
        GM_setValue(storageKey, newState);

        const container = document.getElementById('page-upload-button-container');
        const domain = this.getCurrentDomain();

        if (newState) {
            // Show button
            if (!container) {
                await this.createUploadButton();
            }
            this.showUploadStatus(`✅ Upload button enabled for ${domain}`, 'success');
        } else {
            // Hide button
            if (container) {
                container.remove();
            }
            this.showUploadStatus(`Upload button disabled for ${domain}`, 'info');
        }

        console.log(`Upload button for ${domain}:`, newState ? 'ON' : 'OFF');
    },

    // Update upload time display
    async updateUploadTimeDisplay() {
        const uploadButton = document.getElementById('page-upload-button');
        if (!uploadButton) return;

        // Remove existing time label if present
        let timeLabel = uploadButton.querySelector('#upload-time-label');
        if (timeLabel) {
            timeLabel.remove();
        }

        // Add loading indicator
        timeLabel = document.createElement('span');
        timeLabel.id = 'upload-time-label';
        timeLabel.style.cssText = `
            font-size: 12px;
            color: #6b7280;
            margin-left: 8px;
        `;
        timeLabel.innerHTML = `<span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span>`;
        uploadButton.appendChild(timeLabel);

        // Query and display new upload time
        const lastUploadTime = await this.queryLastUploadTime();
        if (lastUploadTime) {
            const relativeTime = this.formatRelativeTime(lastUploadTime);
            timeLabel.textContent = `(${relativeTime})`;
        } else {
            // Remove loading indicator if no upload record found
            timeLabel.remove();
        }
    },

    // Start periodic time display updates with exponential backoff
    // Updates at: 1s, 2s, 4s, 8s, 16s, 32s, 64s (max ~1 minute)
    startPeriodicTimeUpdate() {
        // Clear any existing timer
        if (this.updateTimeTimer) {
            clearTimeout(this.updateTimeTimer);
        }

        let delay = 1000; // Start with 1 second
        const maxDelay = 64000; // Max 64 seconds

        const scheduleUpdate = () => {
            this.updateTimeTimer = setTimeout(async () => {
                await this.updateUploadTimeDisplay();

                // Double the delay for next update (exponential backoff)
                delay = Math.min(delay * 2, maxDelay);

                // Schedule next update if we haven't reached max delay
                if (delay <= maxDelay) {
                    scheduleUpdate();
                }
            }, delay);
        };

        scheduleUpdate();
    },

    // Stop periodic time updates
    stopPeriodicTimeUpdate() {
        if (this.updateTimeTimer) {
            clearTimeout(this.updateTimeTimer);
            this.updateTimeTimer = null;
        }
    },

    // Initialize the page uploader
    init() {
        // Register Tampermonkey menu command to toggle button
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('Toggle Upload Button', () => {
                this.toggleUploadButton();
            });
        }

        // Check if button should be visible on page load (per-domain)
        const storageKey = this.getStorageKey();
        const isVisible = GM_getValue(storageKey, false);
        const domain = this.getCurrentDomain();

        if (isVisible) {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.createUploadButton();
                });
            } else {
                this.createUploadButton();
            }

            // Monitor URL changes and update upload time display
            let lastUrl = window.location.href;
            setInterval(() => {
                const currentUrl = window.location.href;
                if (currentUrl !== lastUrl) {
                    lastUrl = currentUrl;
                    this.updateUploadTimeDisplay();
                }
            }, 1000);
        }

        console.log(`Page Uploader Module initialized for ${domain} (button: ${isVisible ? 'ON' : 'OFF'})`);
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
            PageUploaderModule.init();
            break;
        case 'supabase':
            SupabaseModule.init();
            break;
        default:
            // For all other pages, only initialize PageUploaderModule
            PageUploaderModule.init();
            console.log('通用页面，已启用 Page Uploader 功能');
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
    global.PageUploaderModule = PageUploaderModule;

    // Legacy compatibility for old tests
    global.UI = ChatGPTModule.UI;
    global.DataExtractor = ChatGPTModule.DataExtractor;
    global.ChatSyncer = ChatGPTModule.ChatSyncer;
}



})();
