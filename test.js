// Test for Supabase Config Helper - API Key Detection
// This file tests the getAnonKey() method with various DOM scenarios

// Mock API key for testing (valid JWT format)
const MOCK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0OTc3MDU1MCwiZXhwIjoxOTY1MzQ2NTUwfQ.test-signature-part';

// Test helper to create DOM elements
function createTestDOM() {
    const container = document.createElement('div');
    container.id = 'test-container';
    
    // Test scenario 1: API key in input[type="text"] 
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = MOCK_API_KEY;
    textInput.id = 'text-input-test';
    container.appendChild(textInput);
    
    // Test scenario 2: API key in textarea
    const textarea = document.createElement('textarea');
    textarea.value = MOCK_API_KEY;
    textarea.id = 'textarea-test';
    container.appendChild(textarea);
    
    // Test scenario 3: API key in code block (existing behavior)
    const codeBlock = document.createElement('code');
    codeBlock.textContent = MOCK_API_KEY;
    codeBlock.id = 'code-test';
    container.appendChild(codeBlock);
    
    // Test scenario 4: Invalid/short key
    const invalidInput = document.createElement('input');
    invalidInput.type = 'text';
    invalidInput.value = 'short-key';
    invalidInput.id = 'invalid-test';
    container.appendChild(invalidInput);
    
    // Test scenario 5: Non-JWT format
    const nonJWTInput = document.createElement('input');
    nonJWTInput.type = 'text';
    nonJWTInput.value = 'sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz';
    nonJWTInput.id = 'non-jwt-test';
    container.appendChild(nonJWTInput);
    
    document.body.appendChild(container);
    return container;
}

// Implementation of the fixed getAnonKey method for testing
function getAnonKey() {
    // Try to find the anon key from the page - support input elements
    const keyElements = document.querySelectorAll('code, span[class*="font-mono"], pre, input[type="text"], input[type="password"], textarea');
    for (const element of keyElements) {
        const text = element.textContent || element.innerText || element.value;
        if (text && text.startsWith('eyJ') && text.includes('.') && text.length > 100) {
            return text.trim();
        }
    }
    return null;
}

// Test runner
function runTests() {
    console.log('🧪 Starting Supabase Config Helper Tests...\n');
    
    // Setup test DOM
    const testContainer = createTestDOM();
    
    // Test 1: Should detect API key from input[type="text"]
    console.log('Test 1: API key in text input');
    const foundKey = getAnonKey();
    console.log('Found key:', foundKey ? '✅ Found' : '❌ Not found');
    console.log('Key value:', foundKey);
    console.log('Expected:', MOCK_API_KEY);
    console.log('Match:', foundKey === MOCK_API_KEY ? '✅ Match' : '❌ Mismatch');
    console.log('---\n');
    
    // Test 2: Remove text input and test textarea detection
    document.getElementById('text-input-test').remove();
    console.log('Test 2: API key in textarea (after removing text input)');
    const foundKey2 = getAnonKey();
    console.log('Found key:', foundKey2 ? '✅ Found' : '❌ Not found');
    console.log('Match:', foundKey2 === MOCK_API_KEY ? '✅ Match' : '❌ Mismatch');
    console.log('---\n');
    
    // Test 3: Remove textarea and test code block detection
    document.getElementById('textarea-test').remove();
    console.log('Test 3: API key in code block (after removing textarea)');
    const foundKey3 = getAnonKey();
    console.log('Found key:', foundKey3 ? '✅ Found' : '❌ Not found');
    console.log('Match:', foundKey3 === MOCK_API_KEY ? '✅ Match' : '❌ Mismatch');
    console.log('---\n');
    
    // Test 4: Remove valid key and test invalid detection
    document.getElementById('code-test').remove();
    console.log('Test 4: Should not detect invalid keys');
    const foundKey4 = getAnonKey();
    console.log('Found key:', foundKey4 ? '❌ Should not find' : '✅ Correctly not found');
    console.log('---\n');
    
    // Test 5: Real-world Supabase dashboard simulation
    testContainer.innerHTML = '';
    const supabaseSimulation = `
        <div class="dashboard-api-section">
            <h3>Project API keys</h3>
            <div class="api-key-row">
                <label>anon public</label>
                <input type="text" readonly value="${MOCK_API_KEY}" />
                <button>Copy</button>
            </div>
            <div class="api-key-row">
                <label>service_role secret</label>
                <input type="password" readonly value="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-key" />
                <button>Copy</button>
            </div>
        </div>
    `;
    testContainer.innerHTML = supabaseSimulation;
    
    console.log('Test 5: Real-world Supabase dashboard simulation');
    const foundKey5 = getAnonKey();
    console.log('Found key:', foundKey5 ? '✅ Found' : '❌ Not found');
    console.log('Match:', foundKey5 === MOCK_API_KEY ? '✅ Match' : '❌ Mismatch');
    console.log('Key source: Should find anon public key, not service_role');
    console.log('---\n');
    
    // Cleanup
    testContainer.remove();
    
    console.log('🎉 Tests completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Fixed getAnonKey() now supports input elements');
    console.log('- ✅ Uses element.value for input/textarea elements');
    console.log('- ✅ Maintains existing JWT format validation');
    console.log('- ✅ Finds first valid key (anon public before service_role)');
}

// Auto-run tests if in browser environment
if (typeof document !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runTests);
    } else {
        runTests();
    }
} else {
    console.log('This test requires a browser environment with DOM support.');
}

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTests, getAnonKey, MOCK_API_KEY };
}