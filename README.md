# AI Agent 开发工具体系

> 我重度使用 AI Agent（Claude Code）辅助开发，在过程中发现四个反复出现的效率瓶颈。于是用 AI 辅助编程的方式，陆续开发了这套工具，覆盖了 **输入管理 → 过程回溯 → 能力扩展 → 资源获取** 四个环节。

---

## 🧭 工具概览

| 环节 | 工具 | 一句话 | 开发周期 |
|------|------|--------|----------|
| 📝 **输入管理** | [prompt_recorder](./prompt_recorder/) | 桌面端 Prompt 管理工具，分类存储 + AI 自动优化 | 2 天 |
| 📖 **过程回溯** | [claude-chat-viewer](./claude-chat-viewer/) | 本地聊天记录浏览器，全文检索 + 自定义收藏夹 | 1 天 |
| 👁️ **能力扩展** | [ds_vision_tools](./ds_vision_tools/) | 为 DeepSeek Agent 补齐视觉能力，适配豆包/Kimi 双后端 | 数小时 |
| 🤖 **资源获取** | [model_downloader](./model_downloader/) | 用 Claude Code Agent 驱动夜间无人值守下载模型 | 数小时 |

---

## 💡 核心理念

传统开发方式中，工具链是固定的，人去适应工具。但在 AI 辅助开发时代，**工具应该适配你的工作流**。

这四个工具的共同逻辑：
1. 在日常使用 AI 的过程中**发现具体痛点**
2. **用 AI 本身快速开发**解决方案（vibe coding）
3. 工具**反哺 AI 使用效率**，形成正向循环
4. 沉淀为一套**可复用的 AI 协作方法论**

---

## 🛠️ 技术栈

| 工具 | 主要技术 |
|------|----------|
| claude-chat-viewer | React 19 + Express 5 + TypeScript + Tailwind CSS 4 + Vite（可选 Electron 打包） |
| prompt_recorder | Python + PyQt5 + SQLite + DeepSeek API（OpenAI 兼容） |
| ds_vision_tools | Python 3 + requests（零依赖，单文件 ~275 行） |
| model_downloader | Python + huggingface_hub + Claude Code Agent + Windows Task Scheduler |

---

## 🚀 快速开始

每个工具都有独立的运行说明，详见各自目录下的 README。

### claude-chat-viewer
```bash
cd claude-chat-viewer
npm install
npm run dev          # 开发模式（Vite HMR + Express API）
```

### prompt_recorder
```bash
cd prompt_recorder
pip install -r requirements.txt
python main.py
```

### ds_vision_tools
```bash
cd ds_vision_tools
pip install requests
# 配置 .env（参考 .env.example）
python vision_tool.py -i screenshot.png -q "图中有什么？"
```

### model_downloader
```bash
cd model_downloader
pip install huggingface_hub pyyaml
# 配置 config.yaml 后，搭配 Windows 计划任务使用
python _download_model.py --model libero_object
```

---

## 📌 备注

- 本仓库为个人工具合集，所有工具均为全流程 AI 辅助开发（Claude Code / vibe coding）
- 欢迎提 Issue 交流 AI 辅助开发经验
