// ==UserScript==
// @name         ChatGPT Supabase Syncer (Unified)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Unified script: Sync ChatGPT conversations to Supabase & Config helper for Supabase dashboard
// @author       You
// @match        https://chatgpt.com/c/*
// @match        https://chat.openai.com/c/*
// @match        https://chatgpt.com/share/*
// @match        https://chat.openai.com/share/*
// @match        https://supabase.com/dashboard/project/*
// @match        https://app.supabase.com/project/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // ===============================
    // SHARED CONFIGURATION & STORAGE
    // ===============================
    
    const STORAGE_KEYS = {
        url: 'chat_syncer.supabase_url',
        key: 'chat_syncer.supabase_key',
        table: 'chat_syncer.table'
    };

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

    // ===============================
    // PAGE DETECTION
    // ===============================
    
    const PageDetector = {
        isChatGPTPage() {
            return /chatgpt\.com|chat\.openai\.com/.test(location.href);
        },
        
        isSupabasePage() {
            return /supabase\.com/.test(location.href);
        },
        
        getCurrentPageType() {
            if (this.isChatGPTPage()) return 'chatgpt';
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
                
                button.onclick = () => ChatGPTModule.ChatSyncer.syncConversation();
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
                            version: '1.0.0'
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
                                reject(new Error(`HTTP ${response.status}: ${response.responseText}`));
                            }
                        },
                        onerror: function(error) {
                            reject(new Error('Network error: ' + error));
                        }
                    });
                });
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

            // Create sync button
            const syncButton = this.UI.createSyncButton();
            document.body.appendChild(syncButton);

            // Setup keyboard shortcut
            this.setupKeyboardShortcut();

            console.log('ChatGPT Supabase Syncer 已加载 (统一版本)');
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
                    background: white;
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
                        <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1f2937;">ChatGPT Syncer 配置</h2>
                        <p style="margin: 0; font-size: 14px; color: #6b7280;">从当前 Supabase 项目自动提取的配置信息</p>
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
                        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                            项目 ID
                        </label>
                        <input type="text" value="${config.projectId || '未检测到'}" readonly
                               style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #f9fafb; box-sizing: border-box;">
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                            Supabase URL
                        </label>
                        <input type="text" value="${config.url || '未检测到'}" readonly
                               style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #f9fafb; box-sizing: border-box;">
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
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
                                style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; color: #374151; border-radius: 6px; font-size: 14px; cursor: pointer;">
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
            case 'chatgpt':
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