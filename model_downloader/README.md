# Model Downloader

> 用 AI Agent 驱动夜间无人值守下载 —— 校园网免流量时段自动拉取 HuggingFace 大模型权重。

本工具全流程基于 Claude Code（AI Agent）辅助开发，数小时完成。

---

## ✨ 功能

- **🤖 Agent 驱动** —— Claude Code 自主读取任务清单、执行下载、处理异常、更新状态
- **🌐 双策略回退** —— 优先国内镜像 `hf-mirror.com` 直连，失败回退 HuggingFace 官方代理
- **🔁 断点续传** —— `snapshot_download(resume_download=True)`，中断后自动恢复
- **⏰ 时间窗口** —— 仅在 23:30 ~ 06:00 免流量时段运行，避免白天计费
- **📋 任务清单** —— Markdown 格式，人类和 Agent 均可读写
- **📝 完整日志** —— 每次运行生成带时间戳的日志文件

---

## 🛠 技术栈

| 层面 | 技术 |
|------|------|
| 下载引擎 | Python 3 + `huggingface_hub` |
| AI 驱动 | Claude Code CLI（Agent 自主执行） |
| 调度器 | Windows Task Scheduler |
| 代理 | Clash Verge（仅回退时启用） |

---

## 🚀 快速开始

```bash
# 1. 安装依赖
pip install huggingface_hub pyyaml

# 2. 编辑配置
# 修改 config.yaml 中的 download_dir 为你的本地路径

# 3. 添加下载任务
# 编辑 download_tasks.md，按模板添加模型

# 4. 手动测试
python _download_model.py --model libero_object

# 5. 配置定时任务（Windows）
# Win+R → taskschd.msc → 创建任务 → 触发器 每天 23:30 → 启动 download_launcher.bat
```

---

## 📁 项目结构

```
model_downloader/
├── config.yaml                # 全局配置（镜像、代理、时间窗口、重试）
├── download_tasks.md          # 任务清单（Agent 读写）
├── download_launcher.bat      # Windows 计划任务入口
├── _download_runner.py        # 下载运行器（双策略循环 + JSON 输出）
├── _download_model.py         # 单模型下载器（CLI 模式）
├── _test_connection.py        # 连接测试工具
└── logs/                      # 运行日志
```

---

## 💡 核心思路

大多数下载工具是「写死所有逻辑的脚本」——每步都靠 if-else 判断，遇到意外直接崩溃。

本工具换了一个思路：**让 AI Agent 来驱动流程**。Claude Code 读取任务清单和配置文件后，自己决定用哪个镜像、处理什么异常、何时重试。这比传统脚本灵活得多——遇到未预见的边界情况，Agent 能自适应，不需要提前枚举所有分支。

---

## 📌 备注

- 本仓库为个人开源作品，欢迎提 Issue 交流
- 属于 [AI Agent 开发工具体系](https://github.com/luckyfish22/AI-toolkit) 的一部分
