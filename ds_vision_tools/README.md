# DS Vision Tools

> DeepSeek Agent 的视觉补丁 —— 为纯文本模型赋予「眼睛」，支持图片与文档的多模态识别。

本工具全流程基于 Claude Code（AI Agent）辅助开发，数小时完成。

---

## 🎯 解决什么问题

DeepSeek 等纯文本模型没有视觉能力，无法直接理解图片。本工具作为一个轻量中间层，让 AI Agent 能够：

1. 读取本地图片文件（PNG、JPG、GIF、WebP、BMP）
2. 调用多模态视觉 API（豆包 / Kimi）进行识别
3. 返回结构化的文字描述给 Agent

---

## ✨ 特性

- **🔌 双后端** —— 豆包（Doubao SeedVision）和 Kimi（Moonshot Vision），一键切换
- **📦 极轻量** —— 单文件 ~275 行，仅依赖 `requests`
- **🖥️ 双模式** —— CLI 命令行 + Python 导入，适配不同 Agent 框架
- **📋 JSON 输出** —— `--json` 返回结构化结果，方便 Agent 解析
- **🌐 代理控制** —— `--proxy` / `--no-proxy` 显式指定，适配内外网环境

---

## 🛠 技术栈

| 层面 | 技术 |
|------|------|
| 语言 | Python 3 |
| 依赖 | `requests`（唯一外部依赖） |
| 视觉后端 | 豆包（火山引擎 ARK API）+ Kimi（Moonshot API） |
| 配置 | `.env` 文件（环境变量） |

---

## 🚀 快速开始

```bash
# 1. 安装依赖
pip install requests

# 2. 配置 API Key（参考 .env.example）
cp .env.example .env
# 编辑 .env，填入 DOUBAO_API_KEY 或 KIMI_API_KEY

# 3. 命令行使用
python vision_tool.py -i screenshot.png -q "图中有什么？"

# 4. JSON 输出模式（供 Agent 调用）
python vision_tool.py -i photo.jpg -q "描述这张图片" --json

# 5. 指定后端
python vision_tool.py -i doc.png -q "读取文档内容" --backend kimi --no-proxy
```

---

## 📖 Python 导入

```python
from vision_tool import describe_image

result = describe_image(
    image_path="screenshot.png",
    question="图中有什么？",
    backend="doubao",
    use_proxy=False
)
print(result)
```

---

## 🔧 API 后端对比

| | 豆包（Doubao） | Kimi（Moonshot） |
|---|---|---|
| 默认模型 | `doubao-seed-1-6-vision-250815` | `moonshot-v1-8k-vision-preview` |
| API 格式 | 原生 REST（`/api/v3/responses`） | OpenAI 兼容（`/v1/chat/completions`） |
| 适用场景 | 国内直连，速度快 | 备选方案 |

---

## 💡 开发背景

我的 Claude Code Agent 底层接的是 DeepSeek（性价比高），但 DeepSeek 没有视觉能力。遇到需要看截图、读 PDF 图片、分析图表的场景就卡住了。

于是写了一个极简的 Python 脚本做桥接——Agent 调用 `vision_tool.py`，脚本负责图片编码和 API 通信，返回文字结果。由于只有 275 行、零依赖，部署和迁移成本几乎为零。

---

## 📌 备注

- 本仓库为个人开源作品，欢迎提 Issue 交流
- 属于 [AI Agent 开发工具体系](https://github.com/luckyfish22/AI-toolkit) 的一部分
