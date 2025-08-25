#!/usr/bin/env node

/**
 * 简单的测试框架 - 不依赖第三方库
 */

const fs = require('fs');
const path = require('path');

// 测试结果统计
let testStats = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

// 颜色输出
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(color, ...args) {
    console.log(color, ...args, colors.reset);
}

// 简单的断言函数
function assert(condition, message) {
    testStats.total++;
    if (condition) {
        testStats.passed++;
        log(colors.green, '  ✓', message);
        return true;
    } else {
        testStats.failed++;
        const error = `  ✗ ${message}`;
        testStats.errors.push(error);
        log(colors.red, error);
        return false;
    }
}

function assertEqual(actual, expected, message) {
    const condition = actual === expected;
    const fullMessage = message ? `${message} (got: ${actual}, expected: ${expected})` : `Expected ${expected}, got ${actual}`;
    return assert(condition, fullMessage);
}

function assertNotNull(value, message) {
    return assert(value !== null && value !== undefined, message || 'Value should not be null/undefined');
}

function assertType(value, expectedType, message) {
    return assert(typeof value === expectedType, message || `Expected type ${expectedType}, got ${typeof value}`);
}

// 模拟浏览器环境
function createMockBrowser() {
    global.window = {
        location: {
            href: 'https://chatgpt.com/c/abcd1234-5678-90ef-abcd-123456789abc'
        },
        innerWidth: 1920,
        innerHeight: 1080
    };
    
    // 也为 global 添加 location，因为脚本可能直接使用 window.location
    global.location = global.window.location;
    
    global.document = {
        title: 'Test ChatGPT Conversation | ChatGPT',
        readyState: 'complete',
        createElement: function(tag) {
            return {
                style: {},
                onclick: null,
                innerHTML: '',
                textContent: '',
                setAttribute: function() {},
                getAttribute: function() { return null; },
                appendChild: function() {},
                remove: function() {},
                classList: {
                    add: function() {},
                    remove: function() {}
                }
            };
        },
        body: {
            appendChild: function() {}
        },
        querySelectorAll: function(selector) {
            // 模拟 ChatGPT 消息元素
            if (selector === '[data-message-author-role]') {
                return [
                    {
                        getAttribute: () => 'user',
                        querySelector: () => ({
                            innerText: '你好，请帮我写一个JavaScript函数',
                            innerHTML: '<p>你好，请帮我写一个JavaScript函数</p>'
                        })
                    },
                    {
                        getAttribute: () => 'assistant',
                        querySelector: () => ({
                            innerText: '当然可以！这里是一个示例函数：\nfunction test() { return "hello"; }',
                            innerHTML: '<p>当然可以！这里是一个示例函数：</p><pre>function test() { return "hello"; }</pre>'
                        })
                    }
                ];
            }
            return [];
        },
        addEventListener: function() {}
    };
    
    global.navigator = {
        userAgent: 'Mozilla/5.0 (Test Environment)'
    };
    
    global.localStorage = {
        data: {},
        getItem: function(key) {
            return this.data[key] || null;
        },
        setItem: function(key, value) {
            this.data[key] = String(value);
        },
        removeItem: function(key) {
            delete this.data[key];
        }
    };
    
    global.fetch = function(url, options) {
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
            text: () => Promise.resolve('OK')
        });
    };
    
    global.prompt = function(message, defaultValue) {
        // 模拟用户输入
        if (message.includes('Supabase URL')) return 'https://test.supabase.co';
        if (message.includes('匿名密钥')) return 'test-anon-key';
        if (message.includes('表名')) return 'chat_logs';
        return defaultValue;
    };
    
    global.alert = function() {};
    global.console = console;
    global.setTimeout = setTimeout;
}

// 加载用户脚本
function loadUserScript() {
    const scriptPath = path.join(__dirname, '..', 'userscript.js');
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // 移除 Tampermonkey 头部
    scriptContent = scriptContent.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*\n/, '');
    
    // 查找 IIFE 的开始和结束位置
    const lines = scriptContent.split('\n');
    let startIndex = -1;
    let endIndex = -1;
    
    // 找到 IIFE 开始
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('(function()') && lines[i + 1] && lines[i + 1].trim() === "'use strict';") {
            startIndex = i + 2; // 跳过 (function() { 和 'use strict';
            break;
        }
    }
    
    // 找到 IIFE 结束
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().match(/^\}\)\(\);?\s*$/)) {
            endIndex = i;
            break;
        }
    }
    
    if (startIndex === -1 || endIndex === -1) {
        throw new Error('无法找到 IIFE 边界');
    }
    
    // 提取 IIFE 内部的代码
    const innerContent = lines.slice(startIndex, endIndex).join('\n');
    
    try {
        // 将关键对象暴露到全局作用域以便测试
        const exposedContent = innerContent + `
        
        // 暴露对象供测试使用
        global.CONFIG = CONFIG;
        global.UI = UI;
        global.DataExtractor = DataExtractor;
        global.ChatSyncer = ChatSyncer;
        `;
        
        // 执行脚本
        eval(exposedContent);
    } catch (error) {
        console.error('脚本执行错误:', error.message);
        console.error('提取的内容长度:', innerContent.length);
        throw error;
    }
}

// 测试用例
function runTests() {
    console.log(colors.blue, '🚀 开始运行 ChatGPT Syncer 测试\n', colors.reset);
    
    // 1. 配置管理测试
    console.log(colors.yellow, '📋 测试配置管理', colors.reset);
    
    // 测试配置设置
    CONFIG.set('TEST_KEY', 'test_value');
    assertEqual(CONFIG.get('TEST_KEY'), 'test_value', '配置设置和获取');
    
    // 测试 localStorage 存储
    CONFIG.set('SUPABASE_URL', 'https://test.supabase.co');
    assertEqual(localStorage.getItem('chatsyncer_supabase_url'), 'https://test.supabase.co', 'localStorage 存储');
    
    // 测试配置加载
    CONFIG.SUPABASE_URL = null;
    assertEqual(CONFIG.get('SUPABASE_URL'), 'https://test.supabase.co', '配置从 localStorage 加载');
    
    console.log();
    
    // 2. 数据提取测试
    console.log(colors.yellow, '🔍 测试数据提取', colors.reset);
    
    // 测试对话 ID 提取
    const chatId = DataExtractor.getChatId();
    assertEqual(chatId, 'abcd1234-5678-90ef-abcd-123456789abc', '对话 ID 提取');
    
    // 测试 DOM 数据提取
    const domData = DataExtractor.extractViaDOM();
    assertNotNull(domData, 'DOM 数据提取返回结果');
    assertType(domData.messages, 'object', '消息数组存在');
    assert(Array.isArray(domData.messages), '消息是数组类型');
    assert(domData.messages.length > 0, '提取到消息内容');
    
    // 测试消息格式
    if (domData.messages.length > 0) {
        const firstMsg = domData.messages[0];
        assertNotNull(firstMsg.role, '消息包含角色');
        assertNotNull(firstMsg.text, '消息包含文本');
        assertType(firstMsg.idx, 'number', '消息包含索引');
    }
    
    // 测试哈希生成
    const hash = DataExtractor.generateHash(domData);
    assertType(hash, 'string', '哈希生成返回字符串');
    assert(hash.length > 0, '哈希非空');
    
    console.log();
    
    // 3. API 数据格式测试
    console.log(colors.yellow, '🔌 测试 API 数据格式', colors.reset);
    
    const mockAPIData = {
        conversation_id: 'api-test-123',
        title: 'API 测试对话',
        mapping: {
            'node1': {
                message: {
                    author: { role: 'user' },
                    content: { parts: ['测试用户消息'] }
                }
            },
            'node2': {
                message: {
                    author: { role: 'assistant' },
                    content: { parts: ['测试助手消息', '第二部分'] }
                }
            }
        }
    };
    
    const formattedData = DataExtractor.formatAPIData(mockAPIData);
    assertEqual(formattedData.chat_id, 'api-test-123', 'API 数据 chat_id 格式化');
    assertEqual(formattedData.chat_title, 'API 测试对话', 'API 数据标题格式化');
    assertEqual(formattedData.source, 'api', 'API 数据来源标记');
    assert(formattedData.messages.length >= 2, 'API 数据消息提取');
    
    console.log();
    
    // 4. UI 组件测试
    console.log(colors.yellow, '🎨 测试 UI 组件', colors.reset);
    
    // 测试同步按钮创建
    const syncButton = UI.createSyncButton();
    assertNotNull(syncButton, '同步按钮创建');
    assertEqual(syncButton.innerHTML, 'Sync → Supabase', '按钮文本正确');
    assertNotNull(syncButton.style, '按钮样式存在');
    
    console.log();
    
    // 5. Supabase 集成测试
    console.log(colors.yellow, '💾 测试 Supabase 集成', colors.reset);
    
    // 设置测试配置
    CONFIG.set('SUPABASE_URL', 'https://test.supabase.co');
    CONFIG.set('SUPABASE_ANON_KEY', 'test-key');
    CONFIG.set('TABLE_NAME', 'chat_logs');
    
    const testRecord = {
        collected_at: new Date().toISOString(),
        chat_id: 'test-123',
        chat_url: 'https://chatgpt.com/c/test-123',
        chat_title: '测试对话',
        page_title: '测试页面',
        messages: [{ idx: 0, role: 'user', text: '测试', html: '<p>测试</p>' }],
        meta: { source: 'test', hash: 'test-hash' }
    };
    
    // 由于这是模拟环境，我们测试函数是否正确构建请求
    try {
        // 这里不会实际发送请求，但会测试函数逻辑
        const uploadPromise = ChatSyncer.uploadToSupabase(testRecord);
        assertNotNull(uploadPromise, 'Supabase 上传函数返回 Promise');
    } catch (error) {
        assert(false, `Supabase 上传函数调用失败: ${error.message}`);
    }
    
    console.log();
    
    // 6. 完整性测试
    console.log(colors.yellow, '🔄 测试完整性', colors.reset);
    
    // 测试所有必要的对象和函数是否存在
    assertNotNull(CONFIG, 'CONFIG 对象存在');
    assertNotNull(UI, 'UI 对象存在');
    assertNotNull(DataExtractor, 'DataExtractor 对象存在');
    assertNotNull(ChatSyncer, 'ChatSyncer 对象存在');
    
    // 测试关键方法
    assertType(CONFIG.get, 'function', 'CONFIG.get 是函数');
    assertType(CONFIG.set, 'function', 'CONFIG.set 是函数');
    assertType(UI.createSyncButton, 'function', 'UI.createSyncButton 是函数');
    assertType(UI.showStatus, 'function', 'UI.showStatus 是函数');
    assertType(DataExtractor.getChatId, 'function', 'DataExtractor.getChatId 是函数');
    assertType(DataExtractor.extractViaDOM, 'function', 'DataExtractor.extractViaDOM 是函数');
    assertType(DataExtractor.generateHash, 'function', 'DataExtractor.generateHash 是函数');
    assertType(ChatSyncer.syncConversation, 'function', 'ChatSyncer.syncConversation 是函数');
    
    console.log();
}

// 输出测试结果
function printResults() {
    console.log(colors.blue, '📊 测试结果统计', colors.reset);
    console.log(`总计: ${testStats.total}`);
    log(colors.green, `通过: ${testStats.passed}`);
    log(colors.red, `失败: ${testStats.failed}`);
    
    if (testStats.failed > 0) {
        console.log(colors.red, '\n❌ 失败的测试:', colors.reset);
        testStats.errors.forEach(error => {
            console.log(colors.red, error, colors.reset);
        });
        process.exit(1);
    } else {
        console.log(colors.green, '\n✅ 所有测试通过!', colors.reset);
        process.exit(0);
    }
}

// 主函数
function main() {
    try {
        createMockBrowser();
        loadUserScript();
        runTests();
        printResults();
    } catch (error) {
        console.error(colors.red, '❌ 测试运行失败:', error.message, colors.reset);
        console.error(error.stack);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    main();
}

module.exports = { main, assert, assertEqual, assertNotNull, assertType };