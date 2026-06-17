# Claude Chat Viewer

> 本地 Claude Code 聊天记录浏览器 —— 全文检索、Markdown 渲染、自定义收藏夹，让 AI 会话不再遗失。

本工具全流程基于 Claude Code（AI Agent）辅助开发，从 idea 到可用产品仅用 1 天。

---

## ✨ 功能

- **📖 会话浏览** —— 自动扫描 `~/.claude/projects/`，以项目树展示所有历史会话
- **💬 聊天回放** —— 聊天气泡 UI，完整渲染 Markdown（标题、列表、表格、代码高亮）
- **🔍 全文检索** —— 服务端关键词搜索，`Ctrl+K` 聚焦搜索栏，结果一键跳转
- **⭐ 收藏夹** —— 跨项目收藏会话，支持嵌套文件夹管理（类似歌单）
- **🧠 思维链展示** —— Claude 的 thinking 过程内联渲染
- **🔧 工具调用展示** —— 代码块附语言标签和复制按钮
- **📊 会话元数据** —— 模型名、时间范围、消息数、工作目录一目了然
- **🛡️ 只读安全** —— 绝不写入 `~/.claude/`，数据安全有保障

---

## 🛠 技术栈

| 层面 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript |
| 后端 | Express 5 |
| 样式 | Tailwind CSS 4 |
| 构建 | Vite 8 |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| 桌面 | Electron（可选） |

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 开发模式（Vite HMR :5173 + Express API :3000）
npm run dev

# 3. 浏览器访问 http://localhost:5173
```

---

## 📁 项目结构

```
claude-chat-viewer/
├── src/
│   ├── App.tsx                          # 应用入口
│   ├── components/
│   │   ├── chat/ChatView.tsx            # 聊天气泡列表
│   │   └── layout/
│   │       ├── Sidebar.tsx              # 侧边栏（项目树 / 收藏夹）
│   │       └── TopBar.tsx               # 顶栏（搜索、元数据）
│   ├── types/index.ts                   # TypeScript 类型定义
│   └── utils/api.ts                     # API 调用封装
├── server/
│   ├── main.js                          # Express 服务入口
│   └── storage.js                       # JSONL 解析与搜索
├── electron/
│   ├── main.cjs                         # Electron 主进程
│   └── preload.cjs                      # 预加载脚本
└── docs/
    ├── requirements.md                   # 功能需求文档
    ├── tech-spec.md                      # 技术架构文档
    └── design-spec.md                    # UI 设计规范
```

---

## 💡 开发背景

日常使用 Claude Code 开发，聊天记录越积越多。一段时间不回顾，好的分析思路、被踩过的坑全忘了。现有方式是用文件管理器翻 JSONL 纯文本，体验极差。

于是花了一天用 Claude Code vibe coding 开发了这个浏览器。所有解析都在服务端完成，前端只管展示，架构清晰，后续加全文搜索和收藏夹都很顺畅。

---

## 📌 备注

- 本仓库为个人开源作品，欢迎提 Issue 交流
- 属于 [AI Agent 开发工具体系](https://github.com/luckyfish22/AI-toolkit) 的一部分
