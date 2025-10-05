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
                display: block;
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
                        version: '1.2.3'
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
                    version: '1.2.3',
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
