// ==UserScript==
// @name         ChatGPT to Supabase Syncer
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  Sync ChatGPT conversations to Supabase database with one click
// @author       You
// @match        https://chatgpt.com/c/*
// @match        https://chat.openai.com/c/*
// @match        https://chatgpt.com/share/*
// @match        https://chat.openai.com/share/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration management
    const CONFIG = {
        SUPABASE_URL: null,
        SUPABASE_ANON_KEY: null,
        TABLE_NAME: 'chat_logs',
        get: function(key) {
            if (this[key] !== null) return this[key];
            const stored = localStorage.getItem(`chatsyncer_${key.toLowerCase()}`);
            if (stored) {
                this[key] = stored;
                return stored;
            }
            return null;
        },
        set: function(key, value) {
            this[key] = value;
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
            const url = prompt('请输入 Supabase URL (例如: https://xxx.supabase.co):', '');
            if (!url) return false;
            
            const key = prompt('请输入 Supabase 匿名密钥:', '');
            if (!key) return false;
            
            const table = prompt('请输入表名 (默认: chat_logs):', 'chat_logs');
            
            CONFIG.set('SUPABASE_URL', url.replace(/\/$/, ''));
            CONFIG.set('SUPABASE_ANON_KEY', key);
            CONFIG.set('TABLE_NAME', table || 'chat_logs');
            
            return true;
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
                if (!CONFIG.get('SUPABASE_URL') || !CONFIG.get('SUPABASE_ANON_KEY')) {
                    if (!UI.promptConfig()) {
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