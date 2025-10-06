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
