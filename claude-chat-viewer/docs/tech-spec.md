# 技术规范 — Claude Chat Viewer

## 技术栈

| 层面 | 技术 | 版本要求 | 说明 |
|------|------|---------|------|
| 后端 | Express (Node.js) | — | 本地 API 服务器，读取 .claude/ 文件 |
| 语言 | TypeScript | >= 5.5 | 前端类型安全 |
| UI | React | >= 18.3 | 组件化 UI |
| 构建 | Vite | >= 5.0 | 开发 HMR + 生产打包 |
| 样式 | Tailwind CSS | >= 4.0 | 原子化 CSS（浅色主题） |
| Markdown | react-markdown + remark-gfm + rehype-highlight | latest | 消息渲染 + 代码高亮 |
| 搜索 | Fuse.js | latest | 客户端模糊搜索 |
| App 存储 | better-sqlite3 | latest | 收藏夹等 App 自有数据（Phase 4） |

### 为什么不用 Electron

最初选择 Electron 作为桌面壳，但 Electron 二进制文件约 150MB，在用户网络环境下从 GitHub/镜像下载极慢（5 分钟仅下载 5MB）。改用 Express 本地服务器 + 浏览器方案：

- **零额外下载** — Node.js 已安装，Express 仅 2MB npm 包
- **UI 一致** — React 前端完全相同，只是运行在浏览器而非 Electron 窗口
- **天然跨平台** — 任何操作系统有浏览器即可
- **API 解耦** — 后端纯 Node.js，方便未来扩展

## 数据源

### Claude Code 数据（只读）

所有数据来自 `~/.claude/` 目录，服务器以只读模式打开：

| 文件 | 格式 | 大小 | 内容 |
|------|------|------|------|
| `history.jsonl` | JSONL | ~60KB | 所有用户提示词索引 |
| `projects/<name>/<sid>.jsonl` | JSONL | 11KB~6.3MB | 完整对话转录 |
| `sessions/<pid>.json` | JSON | ~300B | 会话进程元数据 |

### App 自有数据（Phase 4 起）

App 自身数据存储在 `%APPDATA%/claude-chat-viewer/`，与 Claude Code 完全隔离：

| 文件 | 格式 | 内容 |
|------|------|------|
| `collections.db` | SQLite | 收藏夹、会话引用、备注标签 |
| `preferences.json` | JSON | 用户界面偏好 |

### 收藏夹数据库设计（Phase 4 实现）

```sql
CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE collection_sessions (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    project_path TEXT NOT NULL,
    session_id TEXT NOT NULL,
    note TEXT,
    sort_order INTEGER DEFAULT 0,
    added_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE(collection_id, project_path, session_id)
);
```

## JSONL 转录条目类型

| type | 说明 | 关键字段 |
|------|------|---------|
| `user` | 用户消息 | `message.role`, `message.content` (string 或 ContentBlock[]) |
| `assistant` | Claude 回复 | `message.content[]` — 包含 text/thinking/tool_use 块 |
| `system` | 系统事件 | `subtype`: `stop_hook_summary` / `turn_duration` / `local_command` |
| `attachment` | 附件信息 | `attachment.type`, `attachment.content` |
| `mode` | 会话模式 | `mode`: `"normal"` 等 |
| `ai-title` | AI 标题 | `aiTitle` |

## Assistant Content Block

```typescript
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: string; [key: string]: unknown };  // 向前兼容
```

## 项目架构

```
server/
└── main.js                     # Express 服务器
    ├── GET /api/projects       # 扫描项目列表
    ├── GET /api/sessions/:proj # 会话列表
    ├── GET /api/transcript/:proj/:sid  # 完整转录
    ├── GET /api/search?q=      # 全文搜索
    └── 生产模式：托管 dist/ 静态文件

src/                            # React 前端（Vite 构建）
├── main.tsx                    # React 入口
├── App.tsx                     # 根布局
├── index.css                   # Tailwind + 全局样式
├── types/index.ts              # TypeScript 类型
├── utils/api.ts                # fetch API 封装
├── hooks/                      # 自定义 Hooks
├── components/
│   ├── layout/                 # Sidebar, TopBar
│   ├── chat/                   # ChatView, ThinkingBlock, ToolUseBlock
│   ├── collections/            # 收藏夹（Phase 5）
│   ├── search/                 # SearchBar, SearchResults（Phase 6）
│   └── common/                 # Loading, Empty, Toast
└── utils/                      # 工具函数
```

## 数据流

```
浏览器 (localhost:5173 开发 / :3000 生产)
    │
    │ fetch('/api/...')
    ▼
Express 服务器 (localhost:3000)
    │
    │ fs.createReadStream (只读)
    ▼
~/.claude/ 目录
```

### 开发模式
- Vite Dev Server `:5173` 提供 React HMR
- Vite Proxy 转发 `/api/*` → Express `:3000`
- 命令：`npm run dev`

### 生产模式
- `vite build` → `dist/` 静态文件
- Express 托管 `dist/` + 提供 API
- 命令：`npm start`

## 安全约定

- Claude Code 文件以 `fs.createReadStream(path, {flags: 'r'})` 打开
- 服务器无任何写入 `.claude/` 的代码路径
- App 自有数据（收藏夹）写入 `%APPDATA%/claude-chat-viewer/`
- API 仅监听本地 `localhost:3000`，不对外暴露
