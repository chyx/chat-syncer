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
