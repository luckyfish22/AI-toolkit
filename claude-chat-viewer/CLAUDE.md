# CLAUDE.md — Claude Chat Viewer 项目指引

## 项目简介

一款本地 Web 应用（Express + React + TypeScript + Tailwind CSS），用于浏览和管理 Claude Code 的本地聊天记录。**只读访问** `~/.claude/` 目录，支持自定义收藏夹归纳整理会话。浅色主题，参考 Claude 网页版风格。

## 架构

```
浏览器 (localhost:5173/3000) → Express 服务器 → 只读 ~/.claude/
```

- **开发**：Vite HMR `:5173` 代理 API 到 Express `:3000`
- **生产**：Express 托管 Vite 构建的静态文件，开浏览器即用

## 规范文件路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 需求文档 | [docs/requirements.md](docs/requirements.md) | 完整功能需求（含收藏夹 F7） |
| 技术规范 | [docs/tech-spec.md](docs/tech-spec.md) | 技术栈、架构、数据源、API 设计 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | 浅色主题配色、布局、字体、交互规范 |
| 开发计划 | [docs/dev-plan.md](docs/dev-plan.md) | 8 阶段执行计划与进度追踪 |
| 开发日志 | [devlog/](devlog/) | 每天自动记录完成/待办事项 |

## 工作约定

1. **分阶段推进**：严格按照 dev-plan.md 的阶段顺序执行，每个阶段独立可验证
2. **先读规范再写代码**：修改任何代码前，先确认需求文档、技术规范和设计规范
3. **只读安全红线**：任何代码路径不得写入 `~/.claude/` 目录；App 数据写入 `%APPDATA%/claude-chat-viewer/`
4. **开发日志**：每次会话结束时更新 `devlog/YYYY-MM-DD.md`
5. **设计一致性**：严格使用 design-spec.md 中定义的浅色主题配色
6. **增量提交**：每完成一个独立功能点就 commit

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式（Vite HMR + Express API）
npm run dev
# 浏览器打开 http://localhost:5173

# 生产模式（构建 + 启动）
npm run build && npm start
# 浏览器打开 http://localhost:3000

# 仅启动服务器
npm start
```

## 关键路径速查

| 位置 | 路径 |
|------|------|
| Claude Code 用户数据 | `~/.claude/` (通常是 `C:\Users\<用户名>\.claude\`) |
| 会话转录文件 | `~/.claude/projects/<项目名>/<sessionId>.jsonl` |
| 历史索引 | `~/.claude/history.jsonl` |
| App 自有数据 | `%APPDATA%/claude-chat-viewer/` (Phase 4 起) |
| Express 服务器 | `server/main.js` |
| React 入口 | `src/main.tsx` |
| API 封装 | `src/utils/api.ts` |
