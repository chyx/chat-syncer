// ===============================
// UNIFIED INITIALIZATION
// ===============================

function initialize() {
    console.log('ChatGPT Supabase Syncer (Unified) 开始初始化...');
    console.log('当前页面:', location.href);
    console.log('页面类型:', PageDetector.getCurrentPageType());

    const pageType = PageDetector.getCurrentPageType();

    // Initialize page-specific modules
    switch (pageType) {
        case 'chatgpt_home':
        case 'chatgpt_conversation':
            ChatGPTModule.init();
            break;
        case 'supabase':
            SupabaseModule.init();
            break;
        default:
            console.log('通用页面');
    }

    // Page Uploader is available on ALL pages
    PageUploaderModule.init();
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
    global.PageUploaderModule = PageUploaderModule;

    // Legacy compatibility for old tests
    global.UI = ChatGPTModule.UI;
    global.DataExtractor = ChatGPTModule.DataExtractor;
    global.ChatSyncer = ChatGPTModule.ChatSyncer;
}
