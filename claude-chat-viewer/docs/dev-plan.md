# 开发执行计划 — Claude Chat Viewer

## 阶段总览

| 阶段 | 名称 | 依赖 | 预计产出 |
|------|------|------|---------|
| 0 | 项目初始化 | — | 目录骨架、规范文档、依赖安装、Express + Vite 验证 |
| 1 | 数据 API 层 | 0 | Express 4 个 API 端点、JSONL 解析 |
| 2 | 核心 UI — 浏览 | 1 | Sidebar、ChatView、消息气泡、浅色主题 |
| 3 | 富内容渲染 | 2 | Thinking 折叠、Tool Use 卡片、Markdown/代码高亮 |
| 4 | 收藏夹系统 | 2 | SQLite 存储、收藏夹 CRUD（数据层） |
| 5 | 收藏夹 UI | 4 | 收藏夹视图、右键菜单、备注标签 |
| 6 | 搜索 | 2 | 快速搜索、深度搜索、结果导航 |
| 7 | 打磨 | 6 | 虚拟滚动、快捷键、导出 Markdown、启动脚本 |

## 阶段 0：项目初始化 ✓

- [x] 创建目录结构
- [x] `package.json` — 依赖声明
- [x] `tsconfig.json` — TypeScript 配置
- [x] `vite.config.ts` — Vite 构建 + API 代理
- [x] `postcss.config.js` — Tailwind CSS v4
- [x] Express 服务器骨架（`server/main.js`）
- [x] React 渲染进程骨架（`src/main.tsx`, `src/App.tsx`）
- [x] 浅色主题配色（`src/index.css`）
- [x] `docs/requirements.md`
- [x] `docs/tech-spec.md`
- [x] `docs/design-spec.md`
- [x] `docs/dev-plan.md`
- [x] `CLAUDE.md`
- [x] `devlog/` 文件夹
- [x] 验证：`npm run dev` → Vite :5173 + Express :3000 均返回 200

## 阶段 1：数据 API 层

- [x] `server/main.js` — 4 个 API 端点
  - [x] `GET /api/projects` — 扫描所有项目
  - [x] `GET /api/sessions/:project` — 会话列表
  - [x] `GET /api/transcript/:project/:sid` — 完整转录
  - [x] `GET /api/search?q=` — 全文搜索
- [x] `src/utils/api.ts` — fetch 封装 + TypeScript 类型
- [ ] 项目名解码修复（D--编码 → 人类可读）
- [ ] 大文件流式优化（6.3MB 转录不阻塞）

## 阶段 2：核心 UI — 浏览

- [x] `src/App.tsx` — 根布局（Sidebar + ChatView）
- [x] `src/components/layout/Sidebar.tsx` — 项目/会话树
- [x] `src/components/layout/TopBar.tsx` — 标题栏
- [x] `src/components/chat/ChatView.tsx` — 消息容器
- [x] 聊天气泡（用户蓝色靠右、Claude 白色靠左）
- [ ] 项目名正确显示（当前仍有编码问题）
- [ ] 点击会话 → 加载并显示消息（已验证 API 正常）

## 阶段 3：富内容渲染

- [ ] `src/components/chat/ThinkingBlock.tsx` — 折叠/展开
- [ ] `src/components/chat/ToolUseBlock.tsx` — 工具卡片
- [ ] `src/components/chat/SystemMessage.tsx` — 系统事件
- [ ] react-markdown + rehype-highlight 集成
- [ ] Assistant 消息合并逻辑
- [ ] 时间戳格式化和消息分组

## 阶段 4：收藏夹系统（数据层）

- [ ] `server/storage.js` — SQLite 初始化
- [ ] 收藏夹 CRUD API 端点
- [ ] 会话引用添加/移除

## 阶段 5：收藏夹 UI

- [ ] 侧边栏视图切换（项目 / 收藏夹）
- [ ] 右键菜单
- [ ] 备注/标签编辑

## 阶段 6：搜索

- [ ] `src/components/search/SearchBar.tsx`
- [ ] `src/components/search/SearchResults.tsx`
- [ ] 搜索高亮 + 结果导航

## 阶段 7：打磨

- [ ] react-virtuoso 虚拟滚动
- [ ] 键盘快捷键
- [ ] 会话导出 Markdown
- [ ] `start.bat` Windows 启动脚本
