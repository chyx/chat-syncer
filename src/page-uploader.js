// ===============================
// PAGE UPLOADER MODULE
// ===============================

const PageUploaderModule = {
    // Get current domain for per-domain settings
    getCurrentDomain() {
        try {
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

            // Upload to Supabase with UPSERT
            // Using onConflict parameter for proper UPSERT behavior
            const response = await fetch(`${supabaseUrl}/rest/v1/page_uploads?on_conflict=page_url`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify({
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
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`上传失败: ${response.status} - ${errorText}`);
            }

            this.showUploadStatus('✅ 上传成功！', 'success');

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
    createUploadButton() {
        const button = document.createElement('button');
        button.id = 'page-upload-button';
        button.innerHTML = '📤 Upload Page';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            background: #10a37f;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
        `;

        button.onmouseover = () => {
            button.style.background = '#0d8f6b';
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
        };

        button.onmouseout = () => {
            button.style.background = '#10a37f';
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        };

        button.onclick = () => {
            this.uploadPage();
        };

        document.body.appendChild(button);
        return button;
    },

    // Toggle upload button visibility (per-domain)
    toggleUploadButton() {
        const storageKey = this.getStorageKey();
        const currentState = GM_getValue(storageKey, false);
        const newState = !currentState;
        GM_setValue(storageKey, newState);

        const button = document.getElementById('page-upload-button');
        const domain = this.getCurrentDomain();

        if (newState) {
            // Show button
            if (!button) {
                this.createUploadButton();
            }
            this.showUploadStatus(`✅ Upload button enabled for ${domain}`, 'success');
        } else {
            // Hide button
            if (button) {
                button.remove();
            }
            this.showUploadStatus(`Upload button disabled for ${domain}`, 'info');
        }

        console.log(`Upload button for ${domain}:`, newState ? 'ON' : 'OFF');
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
        }

        console.log(`Page Uploader Module initialized for ${domain} (button: ${isVisible ? 'ON' : 'OFF'})`);
    }
};
