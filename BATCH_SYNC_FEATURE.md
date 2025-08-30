# ChatGPT 批量同步功能

## 功能概述

为 ChatGPT Supabase Syncer 插件新增了批量同步功能，允许用户在 ChatGPT 主页点击按钮批量同步最近20条对话到 Supabase 数据库。

## 新增功能

### 1. 主页检测
- 新增了对 `chatgpt.com` 和 `chat.openai.com` 主页的识别
- 区分主页和对话页，显示不同的功能按钮

### 2. 批量对话获取
- 调用 ChatGPT 的 `/backend-api/conversations` API 获取最近20条对话列表
- 为每条对话调用 `/backend-api/conversation/:id` 获取详细内容
- 支持访问令牌的多种获取方式（页面上下文、API端点）

### 3. 批量同步UI
- **主页按钮**：显示紫色的"📚 批量同步最近20条"按钮
- **进度弹窗**：实时显示同步进度和统计信息
  - 进度条显示当前处理进度
  - 实时统计：成功、失败、跳过的对话数量
  - 支持取消操作
- **对话页按钮**：保持原有的绿色"Sync → Supabase"按钮

### 4. 智能去重
- 使用哈希算法检测重复对话，避免重复上传
- 基于对话内容生成唯一标识符
- 跳过已存在的对话，提高效率

### 5. 错误处理
- API限流保护：请求间添加500ms延迟
- 网络错误重试机制
- 详细的错误分类和统计
- 优雅的取消操作处理

## 技术实现

### 页面检测逻辑
```javascript
PageDetector = {
    isChatGPTHomePage() {
        const url = location.href;
        return (url === 'https://chatgpt.com/' || url === 'https://chat.openai.com/' || 
               url === 'https://chatgpt.com' || url === 'https://chat.openai.com');
    },
    
    getCurrentPageType() {
        if (this.isChatGPTHomePage()) return 'chatgpt_home';
        if (this.isChatGPTConversationPage()) return 'chatgpt_conversation';
        return 'unknown';
    }
}
```

### 批量获取API
```javascript
BatchFetcher = {
    async getConversationsList(limit = 20) {
        // 获取对话列表
    },
    
    async getConversationDetail(conversationId) {
        // 获取对话详细内容
    },
    
    async getAccessToken() {
        // 多种方式获取访问令牌
    }
}
```

### 数据处理流程
1. 获取对话列表
2. 逐个获取对话详细内容
3. 归一化对话数据结构
4. 检查重复性
5. 上传到 Supabase
6. 更新本地哈希缓存

## 配置要求

无需额外配置，使用现有的 Supabase 配置：
- Supabase URL
- 匿名API Key
- 表名（默认：chat_logs）

## 使用方法

### 在主页使用批量同步
1. 访问 `https://chatgpt.com/` 或 `https://chat.openai.com/`
2. 点击右下角的"📚 批量同步最近20条"按钮
3. 首次使用时会要求配置 Supabase 连接信息
4. 等待同步完成，查看进度和结果

### 在对话页使用单个同步
1. 访问任意 ChatGPT 对话页
2. 点击右下角的"Sync → Supabase"按钮
3. 或使用快捷键 Ctrl/⌘ + Shift + S

## 版本更新

- 版本号：1.0.1 → 1.1.0
- @match 规则新增主页支持
- 保持向后兼容性

## 数据库结构

批量同步的数据与单个同步使用相同的数据库结构，但在 `meta` 字段中添加了额外信息：

```json
{
  "meta": {
    "source": "batch_sync",
    "batch_sync": true,
    "conversation_create_time": "...",
    "conversation_update_time": "...",
    "version": "1.1.0"
  }
}
```

## 性能优化

- 请求间隔：500ms 防止API限流
- 进度显示：实时更新用户体验
- 内存管理：及时清理临时数据
- 错误恢复：单个对话失败不影响整体同步

## 注意事项

1. **API限制**：受 ChatGPT API 限流限制，大量对话可能需要较长时间
2. **网络稳定性**：建议在稳定网络环境下使用
3. **存储空间**：大量对话会占用 Supabase 存储空间
4. **数据安全**：使用匿名密钥，仅支持插入操作

## 故障排除

### 常见问题
1. **获取不到访问令牌**：刷新页面重新登录 ChatGPT
2. **API请求失败**：检查网络连接，稍后重试
3. **Supabase连接失败**：检查配置信息是否正确
4. **部分对话同步失败**：查看控制台错误信息，通常是数据格式问题

### 调试方法
- 打开浏览器开发者工具查看控制台日志
- 检查网络面板的API请求状态
- 验证 Supabase 数据库连接和权限设置