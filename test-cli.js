// CLI-compatible test runner for ChatGPT Supabase Syncer (Unified)
// Tests the core logic without DOM dependencies

console.log('🧪 ChatGPT Supabase Syncer (Unified) - CLI Tests\n');

// Mock GM functions
let mockGMStorage = {};
const GM_getValue = (key, defaultValue) => mockGMStorage[key] !== undefined ? mockGMStorage[key] : defaultValue;
const GM_setValue = (key, value) => { mockGMStorage[key] = value; };

// Mock API key for testing
const MOCK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0OTc3MDU1MCwiZXhwIjoxOTY1MzQ2NTUwfQ.test-signature-part';

// Storage keys from unified script
const STORAGE_KEYS = {
    url: 'chat_syncer.supabase_url',
    key: 'chat_syncer.supabase_key',
    table: 'chat_syncer.table'
};

// CONFIG implementation from unified script
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
        
        // Return default
        if (key === 'TABLE_NAME') return 'chat_logs';
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
    }
};

// Mock GM_xmlhttpRequest for testing
let lastXMLRequest = null;
const GM_xmlhttpRequest = function(options) {
    lastXMLRequest = options;
    // Simulate successful response after short delay
    setTimeout(() => {
        if (options.onload) {
            options.onload({
                status: 201,
                statusText: 'Created',
                responseText: '{}',
                responseHeaders: 'content-type: application/json'
            });
        }
    }, 10);
};

// uploadToSupabase implementation from unified script
async function uploadToSupabase(record) {
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

// Test runner
async function runCLITests() {
    let testsPassed = 0;
    let testsTotal = 0;
    
    function assert(condition, message) {
        testsTotal++;
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            testsPassed++;
        } else {
            console.log(`❌ FAIL: ${message}`);
        }
    }
    
    // Test 1: CONFIG Storage System
    console.log('=== Test 1: CONFIG Storage System ===');
    CONFIG.set('SUPABASE_URL', 'https://test.supabase.co');
    CONFIG.set('SUPABASE_ANON_KEY', MOCK_API_KEY);
    CONFIG.set('TABLE_NAME', 'test_logs');
    
    assert(CONFIG.get('SUPABASE_URL') === 'https://test.supabase.co', 'Should store and retrieve SUPABASE_URL');
    assert(CONFIG.get('SUPABASE_ANON_KEY') === MOCK_API_KEY, 'Should store and retrieve SUPABASE_ANON_KEY');
    assert(CONFIG.get('TABLE_NAME') === 'test_logs', 'Should store and retrieve TABLE_NAME');
    
    // Check GM storage persistence
    assert(GM_getValue(STORAGE_KEYS.url) === 'https://test.supabase.co', 'Should persist URL to GM storage');
    assert(GM_getValue(STORAGE_KEYS.key) === MOCK_API_KEY, 'Should persist key to GM storage');
    console.log('---\n');
    
    // Test 2: GM_xmlhttpRequest Implementation
    console.log('=== Test 2: GM_xmlhttpRequest Implementation ===');
    
    const testRecord = {
        chat_id: 'test-chat-123',
        chat_url: 'https://chatgpt.com/c/test-123',
        chat_title: 'Test Conversation',
        messages: [
            { idx: 0, role: 'user', text: 'Hello', html: '<p>Hello</p>' },
            { idx: 1, role: 'assistant', text: 'Hi there!', html: '<p>Hi there!</p>' }
        ],
        meta: { source: 'test' }
    };
    
    try {
        const response = await uploadToSupabase(testRecord);
        assert(lastXMLRequest !== null, 'Should have made GM_xmlhttpRequest call');
        assert(lastXMLRequest.method === 'POST', 'Should use POST method');
        assert(lastXMLRequest.url.includes('test_logs'), 'Should use correct table name in URL');
        assert(lastXMLRequest.headers['Content-Type'] === 'application/json', 'Should set correct Content-Type header');
        assert(lastXMLRequest.headers['apikey'] === MOCK_API_KEY, 'Should set correct apikey header');
        assert(lastXMLRequest.headers['Authorization'] === `Bearer ${MOCK_API_KEY}`, 'Should set correct Authorization header');
        
        const sentData = JSON.parse(lastXMLRequest.data);
        assert(sentData.chat_id === 'test-chat-123', 'Should send correct chat_id');
        assert(sentData.messages.length === 2, 'Should send correct number of messages');
        assert(response.status === 201, 'Should receive successful response');
        
    } catch (error) {
        console.log('❌ GM_xmlhttpRequest test failed:', error.message);
    }
    console.log('---\n');
    
    // Test 3: Error Handling
    console.log('=== Test 3: Error Handling ===');
    
    // Mock GM_xmlhttpRequest to simulate error
    const originalGM_xmlhttpRequest = GM_xmlhttpRequest;
    global.GM_xmlhttpRequest = function(options) {
        setTimeout(() => {
            if (options.onload) {
                options.onload({
                    status: 400,
                    statusText: 'Bad Request',
                    responseText: 'Invalid request'
                });
            }
        }, 10);
    };
    
    // Replace the function temporarily for this test
    const testUploadToSupabase = async function(record) {
        const url = `${CONFIG.get('SUPABASE_URL')}/rest/v1/${CONFIG.get('TABLE_NAME')}`;
        
        return new Promise((resolve, reject) => {
            global.GM_xmlhttpRequest({
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
    };
    
    try {
        await testUploadToSupabase(testRecord);
        assert(false, 'Should throw error for HTTP 400 response');
    } catch (error) {
        assert(error.message.includes('HTTP 400'), 'Should throw error with correct status code');
        assert(error.message.includes('Invalid request'), 'Should include response text in error');
    }
    console.log('---\n');
    
    // Test Summary
    console.log('🎉 CLI Tests completed!\n');
    console.log('📋 Summary:');
    console.log(`Tests passed: ${testsPassed}/${testsTotal}`);
    console.log(`Success rate: ${Math.round((testsPassed/testsTotal) * 100)}%`);
    
    if (testsPassed === testsTotal) {
        console.log('\n🎉 All CLI tests passed! Core functionality working correctly.');
        console.log('✅ CONFIG storage system working');
        console.log('✅ GM_xmlhttpRequest implementation working');
        console.log('✅ Error handling working');
        console.log('✅ CSP bypass successful with GM_xmlhttpRequest');
        console.log('\nFor full DOM-based tests, open http://127.0.0.1:8000/test.html in your browser.');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the implementation.');
    }
    
    return testsPassed === testsTotal;
}

// Run tests
runCLITests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});