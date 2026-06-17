# Model Downloader — 夜间自动模型下载工具

## 项目概述

这个工具用于在指定时间窗口（每天 23:30 ~ 06:00）自动下载 AI 模型权重，
利用校园网夜间无限流量的优势。由 Claude Code agent 驱动，
通过 Windows 任务计划程序定时触发。

## 核心设计

```
┌─────────────────────────────────────────────────────────────┐
│  23:30  Windows 任务计划程序 触发                            │
│    ↓                                                        │
│  download_launcher.bat                                       │
│    ├─ 设置代理环境变量 (Clash Verge 127.0.0.1:7897)         │
│    ├─ 创建日志文件 (logs/download_YYYY-MM-DD_HH-MM.log)     │
│    └─ 调用 claude -p "<下载指令>"                            │
│         ↓                                                   │
│       Claude Code agent 读取：                               │
│         ├─ config.yaml (配置)                                │
│         └─ download_tasks.md (任务清单)                      │
│              ↓                                               │
│         逐个执行 huggingface-cli download                    │
│              ├─ 优先 hf-mirror.com 镜像                      │
│              ├─ 失败回退到 HuggingFace 直连                  │
│              ├─ 自动断点续传 (--resume-download)             │
│              └─ 已完成的自动跳过                             │
│                   ↓                                          │
│         更新 download_tasks.md 状态 + 写入日志               │
│                                                              │
│  05:50  停止新任务，进行中的完成                              │
│  06:00  硬截止（任务计划程序强制执行）                        │
└─────────────────────────────────────────────────────────────┘
```

## 文件结构

```
model_downloader/
├── CLAUDE.md              ← 本文件（项目文档）
├── config.yaml            ← 全局配置（代理、路径、镜像、时间窗口）
├── download_tasks.md      ← 模型下载任务清单（Markdown 格式）
├── download_launcher.bat  ← Windows 任务计划程序入口脚本
├── logs/                  ← 下载日志（自动生成）
│   └── download_2026-06-06_23-30.log
├── dev_logs/              ← 开发日志
│   └── dev_log.md
└── README.md              ← 快速使用说明
```

## 配置说明 (config.yaml)

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `proxy.http` / `proxy.https` | 代理地址 | `http://127.0.0.1:7897` |
| `proxy.enabled` | 是否启用代理 | `true` |
| `mirrors` | 镜像站优先级列表 | hf-mirror → 直连 |
| `paths.download_dir` | 模型下载目录 | `D:/cc_download` |
| `paths.log_dir` | 日志目录 | `model_downloader/logs/` |
| `schedule.start_*` | 开始时间 | 23:30 |
| `schedule.stop_new_*` | 停止新任务 | 05:50 |
| `schedule.hard_stop_*` | 硬截止 | 06:00 |
| `retry.max_retries` | 每模型重试 | 3 |
| `hf_token` | HF 认证 token | 空（暂不需要） |

## 任务清单格式 (download_tasks.md)

每个任务包含：
- HuggingFace 仓库 ID
- 本地存储子目录
- 下载命令模板
- 状态标记（⏳ 待下载 / ✅ 已完成 / ❌ 失败）

## 调度配置

### 方式：Windows 任务计划程序

1. 打开 `taskschd.msc`（Win+R → taskschd.msc）
2. 创建基本任务：
   - **名称**：Model Downloader
   - **触发器**：每天 23:30
   - **操作**：启动程序 → 浏览选择 `download_launcher.bat`
   - **条件**：取消"仅在使用交流电源时启动"（如果是笔记本）
   - **设置**：
     - "如果任务失败，每隔 X 分钟重试" → 关闭
     - "如果运行超过以下时间，停止任务" → 6 小时 30 分钟（23:30 → 06:00）
     - "如果任务已在运行，则以下规则适用" → 不启动新实例

3. 保存后右键 → 运行 → 测试一次

### 日志查看

```bash
# 查看最新日志
dir D:\AAA_study\my_code_file\my_cc\model_downloader\logs\ /O-D
type <最新日志文件>
```

## 命令行测试

```bash
# 手动触发一次下载（测试用）
cd D:\AAA_study\my_code_file\my_cc\model_downloader
download_launcher.bat

# 或者直接调用 Claude（跳过 bat 脚本）
claude -p "读取 D:/AAA_study/my_code_file/my_cc/model_downloader/download_tasks.md，按照其中的下载命令逐一下载模型"
```

## 前置依赖

- **Claude Code CLI**：已安装（`C:\Users\31899\AppData\Roaming\npm\claude`）
- **huggingface-cli**：`pip install huggingface_hub`
- **Clash Verge**：运行中，代理端口 `7897`
- **Git LFS**：`git lfs install`（某些模型可能需要）

## 当前状态

- [x] 项目结构搭建
- [x] 配置文件编写
- [x] 任务清单编写
- [x] 启动脚本编写
- [x] Claude Code 权限配置
- [ ] 手动测试
- [ ] Windows 任务计划程序配置
- [ ] 首次夜间运行验证
