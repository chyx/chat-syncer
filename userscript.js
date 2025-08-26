// ==UserScript==
// @name         ChatGPT to Supabase Syncer
// @namespace    http://tampermonkey.net/
// @version      0.3.0
// @description  Sync ChatGPT conversations to Supabase database with one click
// @author       You
// @match        https://chatgpt.com/c/*
// @match        https://chat.openai.com/c/*
// @match        https://chatgpt.com/share/*
// @match        https://chat.openai.com/share/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // Storage keys for GM API
    const STORAGE_KEYS = {
        url: 'chat_syncer.supabase_url',
        key: 'chat_syncer.supabase_key',
        table: 'chat_syncer.table'
    };

    // Configuration management
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

    // UI Components
    const UI = {
        createSyncButton() {
            const button = document.createElement('button');
            button.innerHTML = 'Sync → Supabase';
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
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
            
            button.onclick = () => ChatSyncer.syncConversation();
            return button;
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
                background: white;
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
                    <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1f2937;">配置 Supabase 连接</h2>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">请填入您的 Supabase 项目信息</p>
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
                        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                            Supabase URL *
                        </label>
                        <input type="url" id="supabaseUrl" placeholder="https://your-project.supabase.co" 
                               style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
                               value="${CONFIG.get('SUPABASE_URL') || ''}" required>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                            匿名密钥 (anon key) *
                        </label>
                        <textarea id="supabaseKey" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." rows="3"
                                  style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; resize: vertical; box-sizing: border-box;"
                                  required>${CONFIG.get('SUPABASE_ANON_KEY') || ''}</textarea>
                    </div>

                    <div style="margin-bottom: 24px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                            表名
                        </label>
                        <input type="text" id="tableName" placeholder="chat_logs" 
                               style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
                               value="${CONFIG.get('TABLE_NAME') || 'chat_logs'}">
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" id="cancelConfig" 
                                style="padding: 10px 16px; border: 1px solid #d1d5db; background: white; color: #374151; border-radius: 6px; font-size: 14px; cursor: pointer;">
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
                    alert('请填写 URL 和密钥');
                    return;
                }

                CONFIG.set('SUPABASE_URL', url.replace(/\/$/, ''));
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
    };

    // Data extraction utilities
    const DataExtractor = {
        getChatId() {
            const url = window.location.href;
            const match = url.match(/\/c\/([a-f0-9-]+)/);
            return match ? match[1] : null;
        },

        async extractViaAPI() {
            try {
                const chatId = this.getChatId();
                if (!chatId) throw new Error('无法获取对话 ID');

                const response = await fetch(`/backend-api/conversation/${chatId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.getAccessToken()}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) throw new Error(`API 请求失败: ${response.status}`);
                
                const data = await response.json();
                return this.formatAPIData(data);
            } catch (error) {
                console.warn('API 提取失败，将使用 DOM 方式:', error.message);
                return this.extractViaDOM();
            }
        },

        getAccessToken() {
            // 尝试从各种可能的位置获取访问令牌
            try {
                const session = JSON.parse(localStorage.getItem('__Secure-next-auth.session-token') || '{}');
                return session.accessToken;
            } catch {
                // 如果无法获取令牌，使用现有的 cookies
                return '';
            }
        },

        extractViaDOM() {
            const messages = [];
            const messageElements = document.querySelectorAll('[data-message-author-role]');
            
            messageElements.forEach((element, index) => {
                const role = element.getAttribute('data-message-author-role');
                const textContent = element.querySelector('.markdown, .whitespace-pre-wrap');
                
                if (textContent) {
                    messages.push({
                        idx: index,
                        role: role,
                        text: textContent.innerText || textContent.textContent || '',
                        html: textContent.innerHTML || ''
                    });
                }
            });

            return {
                chat_id: this.getChatId(),
                chat_url: window.location.href,
                chat_title: document.title.replace(' | ChatGPT', '').replace(' - ChatGPT', ''),
                page_title: document.title,
                messages: messages,
                source: 'dom'
            };
        },

        formatAPIData(apiData) {
            const messages = [];
            
            if (apiData.mapping) {
                Object.values(apiData.mapping).forEach((node, index) => {
                    if (node.message && node.message.content && node.message.content.parts) {
                        const role = node.message.author?.role || 'unknown';
                        const parts = node.message.content.parts;
                        
                        messages.push({
                            idx: index,
                            role: role,
                            text: parts.join(' '),
                            html: parts.map(part => `<p>${part}</p>`).join('')
                        });
                    }
                });
            }

            return {
                chat_id: apiData.conversation_id || this.getChatId(),
                chat_url: window.location.href,
                chat_title: apiData.title || document.title.replace(' | ChatGPT', ''),
                page_title: document.title,
                messages: messages,
                source: 'api'
            };
        },

        generateHash(data) {
            const hashString = JSON.stringify({
                chat_id: data.chat_id,
                messages: data.messages.map(m => ({ role: m.role, text: m.text }))
            });
            
            // 简单的哈希函数
            let hash = 0;
            for (let i = 0; i < hashString.length; i++) {
                const char = hashString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash.toString(36);
        }
    };

    // Main syncer class
    const ChatSyncer = {
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
                    UI.showStatus('需要配置 Supabase 信息', 'error');
                    const configResult = await UI.promptConfig();
                    if (!configResult) {
                        UI.showStatus('配置取消', 'error');
                        return;
                    }
                }

                UI.showStatus('正在提取对话数据...', 'info');
                
                // 提取对话数据
                const conversationData = await DataExtractor.extractViaAPI();
                
                if (!conversationData.messages || conversationData.messages.length === 0) {
                    throw new Error('未找到对话消息');
                }

                // 构建完整的数据记录
                const record = {
                    collected_at: new Date().toISOString(),
                    chat_id: conversationData.chat_id,
                    chat_url: conversationData.chat_url,
                    chat_title: conversationData.chat_title,
                    page_title: conversationData.page_title,
                    messages: conversationData.messages,
                    meta: {
                        user_agent: navigator.userAgent,
                        source: conversationData.source,
                        viewport: {
                            width: window.innerWidth,
                            height: window.innerHeight
                        },
                        hash: DataExtractor.generateHash(conversationData),
                        collected_at: new Date().toISOString()
                    }
                };

                // 上传到 Supabase
                await this.uploadToSupabase(record);
                
                UI.showStatus('同步成功!', 'success');
                
            } catch (error) {
                console.error('同步失败:', error);
                UI.showStatus(`同步失败: ${error.message}`, 'error');
            }
        },

        async uploadToSupabase(record) {
            const url = `${CONFIG.get('SUPABASE_URL')}/rest/v1/${CONFIG.get('TABLE_NAME')}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': CONFIG.get('SUPABASE_ANON_KEY'),
                    'Authorization': `Bearer ${CONFIG.get('SUPABASE_ANON_KEY')}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(record)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Supabase 上传失败: ${response.status} - ${errorText}`);
            }
        }
    };

    // 键盘快捷键支持
    function setupKeyboardShortcut() {
        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
                event.preventDefault();
                ChatSyncer.syncConversation();
            }
        });
    }

    // 初始化
    function initialize() {
        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
            return;
        }

        // 添加同步按钮
        const syncButton = UI.createSyncButton();
        document.body.appendChild(syncButton);

        // 设置键盘快捷键
        setupKeyboardShortcut();

        console.log('ChatGPT Supabase Syncer 已加载');
    }

    // 启动脚本
    initialize();

})();