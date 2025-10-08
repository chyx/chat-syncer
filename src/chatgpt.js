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
            customButton.style.minWidth = '180px';
            customButton.style.textAlign = 'center';
            customButton.style.fontWeight = '600';
            UIHelpers.makeButtonHoverable(customButton);

            // 更新脚本按钮（hover显示）
            const updateButton = UIHelpers.createUpdateScriptButton();
            updateButton.style.minWidth = '180px';
            updateButton.style.textAlign = 'center';
            updateButton.style.fontWeight = '600';

            // Setup hover behavior for all hoverable buttons
            UIHelpers.setupHoverBehavior(container, [customButton, updateButton]);

            // 因为使用 column-reverse，按正常顺序添加即可（最后添加的会显示在最下面）
            container.appendChild(quickButton);
            container.appendChild(customButton);
            container.appendChild(updateButton);
            return container;
        },

        createPasteButton() {
            const button = UIHelpers.createButton({
                text: '📥 获取远程内容',
                onClick: async () => {
                    await this.handlePaste();
                },
                position: {},
                color: 'blue'
            });
            button.id = 'paste-button';
            button.style.minWidth = '180px';
            button.style.textAlign = 'center';
            button.style.fontWeight = '600';
            UIHelpers.makeButtonHoverable(button);

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
                    version: '1.8.5',
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
