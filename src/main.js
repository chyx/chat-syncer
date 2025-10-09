// ===============================
// UNIFIED INITIALIZATION
// ===============================

async function initialize() {
    console.log('ChatGPT Supabase Syncer (Unified) 开始初始化...');
    console.log('当前页面:', location.href);
    console.log('页面类型:', PageDetector.getCurrentPageType());

    const pageType = PageDetector.getCurrentPageType();

    // Create unified button container for this page
    const container = UIHelpers.getPageButtonContainer({ bottom: '20px', right: '20px' });
    const allHoverButtons = [];

    // Initialize page-specific modules and collect hover buttons
    switch (pageType) {
        case 'chatgpt_home':
        case 'chatgpt_conversation':
            // ChatGPT: Main = Batch Sync, Hover = Custom Sync + Upload + Paste + Update
            const chatgptButtons = ChatGPTModule.init(container);
            if (chatgptButtons) allHoverButtons.push(...chatgptButtons);

            // Add PageUploader buttons (Upload will be hoverable on ChatGPT pages)
            const uploaderButtons = await PageUploaderModule.init(container, false); // false = not main button
            if (uploaderButtons) allHoverButtons.push(...uploaderButtons);
            break;

        case 'supabase':
            // Supabase module has its own implementation (for now)
            SupabaseModule.init();
            return; // Don't use unified container

        default:
            console.log('通用页面');
            // Other pages: Main = Upload, Hover = Paste + Update
            const defaultButtons = await PageUploaderModule.init(container, true); // true = is main button
            if (defaultButtons) allHoverButtons.push(...defaultButtons);
    }

    // Add Update Script button (common to all pages)
    const updateButton = UIHelpers.createUpdateScriptButton();
    updateButton.style.minWidth = '180px';
    updateButton.style.textAlign = 'center';
    updateButton.style.fontWeight = '600';
    container.appendChild(updateButton);
    allHoverButtons.push(updateButton);

    // Setup unified hover behavior
    UIHelpers.setupHoverBehavior(container, allHoverButtons);

    // Append container to body
    document.body.appendChild(container);
    console.log('✅ Unified button container initialized');
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
    global.UIHelpers = UIHelpers;

    // Legacy compatibility for old tests
    global.UI = ChatGPTModule.UI;
    global.DataExtractor = ChatGPTModule.DataExtractor;
    global.ChatSyncer = ChatGPTModule.ChatSyncer;
}
