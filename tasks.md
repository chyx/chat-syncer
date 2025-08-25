# Chat Syncer 任务清单 / Task List

> 油猴脚本：在 ChatGPT 网页端一键抓取当前对话并上传到 Supabase 数据库

## 待办事项 / To-Do Items

### 1. 基础实现 / Basic Implementation
- [ ] 创建核心油猴脚本文件 (userscript.js)
- [ ] 实现基本的 ChatGPT API 调用功能
- [ ] 实现 Supabase 数据上传功能
- [ ] 添加基础 UI 界面 (同步按钮)
- [ ] 实现基本的错误处理

### 2. 核心功能增强 / Core Features  
- [ ] 添加配置管理界面
- [ ] 实现哈希去重功能
- [ ] 添加快捷键支持 (Ctrl/⌘+Shift+S)
- [ ] 实现 DOM 抓取兜底机制
- [ ] 支持普通和分享页链接

### 3. 高级功能 / Advanced Features
- [ ] 优化错误处理和用户体验反馈
- [ ] 测试不同类型的对话内容 (代码块、数学公式、多模态内容)
- [ ] 添加图片指针解引用功能 (解析 `[image:file-service://...]` 为可下载 URL 或 base64)
- [ ] 完善错误日志记录

### 4. 批量处理功能 / Batch Operations
- [ ] 实现批量导出所有会话功能 (循环调用 `/backend-api/conversations` 列表接口)
- [ ] 添加批量操作进度显示
- [ ] 实现批量操作的暂停/恢复功能

### 5. 数据管理优化 / Data Management
- [ ] 优化数据库查询性能 (添加更多索引)
- [ ] 添加客户端标识追踪 (在 meta 中加入 client_id)
- [ ] 添加数据导出格式选项 (JSON/Markdown)
- [ ] 实现数据去重和清理功能

### 6. 自动化功能 / Automation
- [ ] 实现自动定时上传功能
- [ ] 添加智能重试机制
- [ ] 实现会话变更检测和自动同步

### 7. 安全和隐私 / Security & Privacy
- [ ] 实现消息内容加密存储
- [ ] 添加更多的 CORS 配置选项
- [ ] 实现访问日志和审计功能

### 8. 用户界面改进 / UI Improvements
- [ ] 创建简易的数据查看界面
- [ ] 添加配置导入/导出功能
- [ ] 改进设置界面的用户体验

### 9. 集成和扩展 / Integration & Extensions
- [ ] 添加 Webhook 集成支持
- [ ] 实现第三方存储支持 (除 Supabase 外)
- [ ] 添加插件系统支持

## 进行中 / In Progress
- [ ] 

## 已完成 / Completed
- [x] 创建任务清单文件 / Created task list file
- [x] 项目文档编写 (README.md, gpt.md)

## 技术债务 / Technical Debt
- [ ] 代码模块化重构 (当有代码实现后)
- [ ] 添加单元测试 (当有代码实现后)
- [ ] 性能优化 (减少内存占用)

## 文档待完善 / Documentation
- [ ] 添加故障排查指南
- [ ] 创建视频使用教程
- [ ] 完善 API 参考文档
- [ ] 添加更多使用示例

## 备注 / Notes
- 当前状态: 仅有文档，代码未实现
- 计划版本: 0.2.0 (API 版)
- 目标域名: `chatgpt.com`, `chat.openai.com`  
- 目标数据库: PostgreSQL (Supabase)
- 计划技术: Tampermonkey, ChatGPT Backend API, Supabase REST API
- 项目结构: 目前只有 README.md, gpt.md, tasks.md 三个文档文件

---

*项目创建: 2025-08-24*
*最后更新: 2025-08-24*