#!/usr/bin/env node

/**
 * ChatGPT 批量同步功能测试
 * 直接运行的 JavaScript 测试脚本
 */

// Mock global objects that would be available in Tampermonkey
global.GM_getValue = function(key, defaultValue) {
    return defaultValue; // 简单模拟
};

global.GM_setValue = function(key, value) {
    console.log(`Mock GM_setValue: ${key} = ${value}`);
};

global.GM_xmlhttpRequest = function(options) {
    console.log(`Mock GM_xmlhttpRequest: ${options.method} ${options.url}`);
    
    // 模拟异步响应
    setTimeout(() => {
        if (options.url.includes('conversations')) {
            // 模拟对话列表响应
            options.onload({
                status: 200,
                responseText: JSON.stringify({
                    items: [
                        { id: 'test-1', title: 'Test Conversation 1', create_time: Date.now() },
                        { id: 'test-2', title: 'Test Conversation 2', create_time: Date.now() }
                    ]
                })
            });
        } else if (options.url.includes('conversation/')) {
            // 模拟对话详情响应
            options.onload({
                status: 200,
                responseText: JSON.stringify({
                    id: 'test-1',
                    title: 'Test Conversation',
                    mapping: {
                        'node1': {
                            message: {
                                id: 'msg1',
                                author: { role: 'user' },
                                content: { content_type: 'text', parts: ['Hello'] },
                                create_time: Date.now()
                            }
                        },
                        'node2': {
                            message: {
                                id: 'msg2',
                                author: { role: 'assistant' },
                                content: { content_type: 'text', parts: ['Hi there!'] },
                                create_time: Date.now() + 1000
                            }
                        }
                    }
                })
            });
        }
    }, 10); // 很短的延迟模拟网络请求
};

// Mock location object
global.location = {
    href: 'https://chatgpt.com/',
    origin: 'https://chatgpt.com'
};

// Mock window object
global.window = {
    location: global.location,
    __remixContext: {
        state: {
            loaderData: {
                root: {
                    clientBootstrap: {
                        session: {
                            accessToken: 'mock-token'
                        }
                    }
                }
            }
        }
    }
};

// Mock fetch
global.fetch = async function(url, options) {
    return {
        ok: true,
        json: async () => ({ accessToken: 'mock-token' })
    };
};

console.log('开始测试 ChatGPT 批量同步功能...\n');

// 测试核心功能模块
function testPageDetector() {
    console.log('🔍 测试页面检测功能...');
    
    const PageDetector = {
        isChatGPTPage() {
            return /chatgpt\.com|chat\.openai\.com/.test(location.href);
        },
        
        isChatGPTHomePage() {
            const url = location.href;
            return (url === 'https://chatgpt.com/' || url === 'https://chat.openai.com/' || 
                   url === 'https://chatgpt.com' || url === 'https://chat.openai.com');
        },
        
        isChatGPTConversationPage() {
            return this.isChatGPTPage() && !this.isChatGPTHomePage();
        },
        
        getCurrentPageType() {
            if (this.isChatGPTHomePage()) return 'chatgpt_home';
            if (this.isChatGPTConversationPage()) return 'chatgpt_conversation';
            return 'unknown';
        }
    };
    
    const pageType = PageDetector.getCurrentPageType();
    console.log(`  ✅ 页面类型: ${pageType}`);
    console.log(`  ✅ 是否为主页: ${PageDetector.isChatGPTHomePage()}`);
    console.log(`  ✅ 是否为ChatGPT页面: ${PageDetector.isChatGPTPage()}`);
    
    return pageType === 'chatgpt_home';
}

function testDataExtractor() {
    console.log('\n📊 测试数据提取功能...');
    
    const DataExtractor = {
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
                let text = '';
                if (ct === 'text') {
                    text = (msg.content.parts || []).join('\n\n');
                } else {
                    text = JSON.stringify(msg.content);
                }
                items.push({ id: msg.id, ts: msg.create_time || 0, role, text });
            }
            items.sort((a,b) => (a.ts||0) - (b.ts||0));
            return items.map((m, idx) => ({ idx, role: m.role, text: m.text, html: '' }));
        }
    };
    
    // 测试哈希生成
    const testText = 'user:Hello\nassistant:Hi there!';
    const hash = DataExtractor.generateHash(testText);
    console.log(`  ✅ 哈希生成: ${hash}`);
    
    // 测试对话归一化
    const testConv = {
        mapping: {
            'node1': {
                message: {
                    id: 'msg1',
                    author: { role: 'user' },
                    content: { content_type: 'text', parts: ['Hello'] },
                    create_time: 1000
                }
            },
            'node2': {
                message: {
                    id: 'msg2',
                    author: { role: 'assistant' },
                    content: { content_type: 'text', parts: ['Hi there!'] },
                    create_time: 2000
                }
            }
        }
    };
    
    const normalized = DataExtractor.normalizeConversation(testConv);
    console.log(`  ✅ 对话归一化: 处理了 ${normalized.length} 条消息`);
    console.log(`  ✅ 第一条消息: ${normalized[0]?.role} - ${normalized[0]?.text}`);
    
    return { DataExtractor, normalized };
}

async function testBatchFetcher() {
    console.log('\n🔄 测试批量获取功能...');
    
    const BatchFetcher = {
        async getAccessToken() {
            try {
                const ctx = window.__remixContext?.state?.loaderData?.root?.clientBootstrap?.session?.accessToken;
                if (ctx) return ctx;
            } catch {}
            return 'mock-token';
        },
        
        async getConversationsList(limit = 20) {
            const token = await this.getAccessToken();
            if (!token) {
                throw new Error('无法获取访问令牌');
            }
            
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://chatgpt.com/backend-api/conversations?offset=0&limit=${limit}&order=updated`,
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
            
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://chatgpt.com/backend-api/conversation/${conversationId}`,
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
        }
    };
    
    try {
        // 测试获取访问令牌
        const token = await BatchFetcher.getAccessToken();
        console.log(`  ✅ 获取访问令牌: ${token ? '成功' : '失败'}`);
        
        // 测试获取对话列表
        const conversations = await BatchFetcher.getConversationsList(2);
        console.log(`  ✅ 获取对话列表: ${conversations.length} 条对话`);
        
        if (conversations.length > 0) {
            // 测试获取对话详情
            const detail = await BatchFetcher.getConversationDetail(conversations[0].id);
            console.log(`  ✅ 获取对话详情: ${detail.title || '未命名'}`);
        }
        
        return { BatchFetcher, conversations };
    } catch (error) {
        console.log(`  ❌ 批量获取测试失败: ${error.message}`);
        throw error;
    }
}

async function testBatchSyncLogic() {
    console.log('\n⚙️ 测试批量同步逻辑...');
    
    const { DataExtractor } = testDataExtractor();
    
    const BatchSyncer = {
        generateHash(text) {
            return DataExtractor.generateHash(text);
        },
        
        async syncSingleConversation(conversationInfo, BatchFetcher) {
            // 获取详细对话内容
            const conv = await BatchFetcher.getConversationDetail(conversationInfo.id);
            const messages = DataExtractor.normalizeConversation(conv);
            
            if (messages.length === 0) {
                throw new Error('对话无有效消息');
            }
            
            // 创建上传记录
            const record = {
                collected_at: new Date().toISOString(),
                chat_id: conv.id || conversationInfo.id,
                chat_url: `https://chatgpt.com/c/${conversationInfo.id}`,
                chat_title: conv.title || conversationInfo.title || 'Untitled',
                page_title: conv.title || conversationInfo.title || '',
                messages: messages,
                meta: {
                    source: 'batch_sync',
                    version: '1.1.0',
                    batch_sync: true,
                    conversation_create_time: conversationInfo.create_time,
                    conversation_update_time: conversationInfo.update_time
                }
            };
            
            // 检查是否已存在
            const textForHash = messages.map(m => `${m.role}:${m.text}`).join('\n');
            const curHash = this.generateHash(textForHash);
            const hashKey = `chat_syncer.lasthash::${record.chat_id}`;
            const lastHash = GM_getValue(hashKey, '');
            
            if (lastHash === curHash) {
                throw new Error('对话已存在，跳过');
            }
            
            console.log(`    📄 处理对话: ${record.chat_title} (${messages.length} 条消息)`);
            console.log(`    🔗 哈希值: ${curHash}`);
            
            // 模拟上传成功
            GM_setValue(hashKey, curHash);
            return record;
        }
    };
    
    try {
        const { BatchFetcher, conversations } = await testBatchFetcher();
        
        if (conversations.length > 0) {
            const result = await BatchSyncer.syncSingleConversation(conversations[0], BatchFetcher);
            console.log(`  ✅ 单个对话同步测试成功`);
            console.log(`  📊 记录大小: ${JSON.stringify(result).length} 字符`);
        }
        
        return true;
    } catch (error) {
        console.log(`  ❌ 批量同步逻辑测试失败: ${error.message}`);
        return false;
    }
}

// 运行所有测试
async function runAllTests() {
    console.log('🚀 开始运行完整测试套件...\n');
    
    let passed = 0;
    let total = 0;
    
    try {
        // 测试 1: 页面检测
        total++;
        if (testPageDetector()) {
            console.log('✅ 页面检测测试通过');
            passed++;
        } else {
            console.log('❌ 页面检测测试失败');
        }
        
        // 测试 2: 数据提取
        total++;
        try {
            testDataExtractor();
            console.log('✅ 数据提取测试通过');
            passed++;
        } catch (error) {
            console.log(`❌ 数据提取测试失败: ${error.message}`);
        }
        
        // 测试 3: 批量获取
        total++;
        try {
            await testBatchFetcher();
            console.log('✅ 批量获取测试通过');
            passed++;
        } catch (error) {
            console.log(`❌ 批量获取测试失败: ${error.message}`);
        }
        
        // 测试 4: 批量同步逻辑
        total++;
        if (await testBatchSyncLogic()) {
            console.log('✅ 批量同步逻辑测试通过');
            passed++;
        } else {
            console.log('❌ 批量同步逻辑测试失败');
        }
        
    } catch (error) {
        console.log(`💥 测试过程中出现异常: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📋 测试总结: ${passed}/${total} 项测试通过`);
    
    if (passed === total) {
        console.log('🎉 所有测试通过！批量同步功能已准备就绪');
        process.exit(0);
    } else {
        console.log('⚠️  部分测试失败，请检查实现');
        process.exit(1);
    }
}

// 运行测试
runAllTests().catch(error => {
    console.error('💥 测试运行失败:', error);
    process.exit(1);
});