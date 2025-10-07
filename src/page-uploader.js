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

            // Copy URL to clipboard
            try {
                await navigator.clipboard.writeText(pageUrl);
                this.showUploadStatus('✅ 上传成功！URL 已复制到剪贴板', 'success');
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

        // Create update script button
        const updateButton = UIHelpers.createUpdateScriptButton(container);
        updateButton.style.position = 'relative';
        updateButton.style.bottom = 'auto';
        updateButton.style.right = 'auto';

        container.appendChild(uploadButton);
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
