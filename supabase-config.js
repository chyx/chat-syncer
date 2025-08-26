// ==UserScript==
// @name         Supabase Config Helper for ChatGPT Syncer
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Quick config export from Supabase dashboard for ChatGPT Syncer
// @author       You
// @match        https://supabase.com/dashboard/project/*
// @match        https://app.supabase.com/project/*
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // Helper to extract project info from the current page
    const SupabaseHelper = {
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
    };

    // UI for the config helper
    const ConfigUI = {
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
            const config = SupabaseHelper.extractConfigFromPage();
            
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

            const configJson = JSON.stringify({
                SUPABASE_URL: config.url,
                SUPABASE_ANON_KEY: config.key,
                TABLE_NAME: 'chat_logs'
            }, null, 2);

            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1f2937;">ChatGPT Syncer 配置</h2>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">从当前 Supabase 项目自动提取的配置信息</p>
                </div>

                ${config.url && config.key ? `
                <div style="background: #f0fdf4; border: 1px solid #10b981; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 1.5;">
                    <strong>✅ 配置信息已检测到</strong><br>
                    点击"直接保存配置"按钮，配置将自动保存到浏览器，然后就可以在 ChatGPT 页面直接同步对话了！
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

                <details style="margin-bottom: 16px;">
                    <summary style="cursor: pointer; font-size: 14px; font-weight: 500; color: #374151;">手动复制选项</summary>
                    <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" onclick="navigator.clipboard.writeText('${config.url || ''}')" 
                                style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                            复制URL
                        </button>
                        <button type="button" onclick="navigator.clipboard.writeText('${config.key || ''}')" 
                                style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                            复制密钥
                        </button>
                    </div>
                </details>

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
                // Save using GM API for cross-domain compatibility
                GM_setValue('chat_syncer.supabase_url', config.url);
                GM_setValue('chat_syncer.supabase_key', config.key);
                GM_setValue('chat_syncer.table', 'chat_logs');
                
                // Also save to localStorage for backward compatibility
                localStorage.setItem('chatsyncer_supabase_url', config.url);
                localStorage.setItem('chatsyncer_supabase_anon_key', config.key);
                localStorage.setItem('chatsyncer_table_name', 'chat_logs');
                
                this.showStatus('✅ 配置已保存！现在可以在 ChatGPT 页面直接同步对话', 'success');
            } catch (error) {
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
    };

    // Auto-detection logic
    const AutoDetect = {
        isAPIPage() {
            return window.location.pathname.includes('/settings/api') || 
                   document.querySelector('[data-testid="api-settings"]') ||
                   document.querySelector('h1, h2, h3').textContent.includes('API');
        },

        waitForKeyToLoad() {
            const observer = new MutationObserver((mutations) => {
                const config = SupabaseHelper.extractConfigFromPage();
                if (config.key && config.url) {
                    observer.disconnect();
                    ConfigUI.showStatus('检测到完整配置信息！点击右上角按钮复制', 'success');
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
    };

    // Initialize
    function initialize() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
            return;
        }

        // Add config button
        const configButton = ConfigUI.createConfigButton();
        document.body.appendChild(configButton);

        // Auto-detect if we're on API settings page
        if (AutoDetect.isAPIPage()) {
            AutoDetect.waitForKeyToLoad();
        }

        console.log('Supabase Config Helper loaded');
    }

    // Start the script
    initialize();

})();