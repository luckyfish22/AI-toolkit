# 开发日志 — Model Downloader

## 2026-06-06 — 项目初始化

### 需求来源
用户在做 AI 对抗攻击方向研究，需要下载 OpenVLA 的 LIBERO 微调模型权重。
校园网 23:30 ~ 06:00 有无限流量，需要自动调度下载任务。

### 设计决策

**Q: 调度方式选什么？**
- 选择 Windows 任务计划程序 + Claude Code 非交互模式（`claude -p`）
- 理由：Win11 原生支持，稳定可靠；Claude Code 非交互模式一次执行完退出，适合定时批处理场景
- 备选方案被否决的原因：
  - Claude Code cron 需要 CLI 保持运行，夜间可能终端关闭
  - 自写守护脚本不够稳定

**Q: 下载工具选什么？**
- 选择 `huggingface-cli download`（huggingface_hub 库自带）
- 理由：原生支持断点续传（`--resume-download`）、文件校验、镜像站切换
- 备选方案：`git lfs clone`（太重）、`wget` 逐个文件（无自动 resume）、Python SDK（可行但 CLI 更简洁）

**Q: 镜像策略？**
- 优先 `hf-mirror.com`，失败回退 HuggingFace 直连
- 由 Claude Code agent 在运行时灵活决策，不在 .bat 中硬编码

**Q: 代理怎么传？**
- .bat 脚本设置环境变量（HTTP_PROXY, HTTPS_PROXY）
- Claude Code 的 Bash 子进程自动继承
- 即使 huggingface-cli 走镜像，代理也可能需要（镜像站有时也要翻）

**Q: 为什么排除 libero_spatial？**
- 用户明确说"除了 spatial 的另外三个数据套"，所以只下载 object/goal/10

### 目标任务
| 模型 | HF 仓库 |
|------|---------|
| libero_object | openvla/openvla-7b-finetuned-libero-object |
| libero_goal | openvla/openvla-7b-finetuned-libero-goal |
| libero_10 | openvla/openvla-7b-finetuned-libero-10 |
| ~~libero_spatial~~ | ~~openvla/openvla-7b-finetuned-libero-spatial~~ (跳过) |

### 权限配置（v2 — 行业标准最小权限策略）

**原则**：最小权限 (Least Privilege) + 纵深防御 (Defense in Depth)

| 层级 | 策略 | 数量 |
|------|------|------|
| `allow` | 精准放行项目所需操作 | 38 条 |
| `deny` | 防御性阻断攻击面 | 58 条 |
| 其他 | 弹窗询问（默认安全） | — |

**allow 覆盖范围**：
- `huggingface-cli` 所有下载相关子命令
- `set` 环境变量（仅代理和 HF 相关）
- 基础文件操作（`mkdir`/`ls`/`dir`/`find`/`echo`）
- Git LFS 基础命令
- 项目目录和下载目录的 Read/Write/Edit
- WebSearch / WebFetch

**deny 阻断的攻击面**：
| 类别 | 阻断项 |
|------|--------|
| 凭据泄露 | `.ssh/`, `.aws/`, `gcloud/`, `.env`, `*.pem`, `*.key`, Clash 配置 |
| 破坏性命令 | `rm -rf`, `del /f`, `format`, `diskpart`, `cleanmgr` |
| 系统控制 | `shutdown`, `reboot`, `taskkill`, `reg`, `netsh`, `sc` |
| 权限提升 | `sudo`, `su`, `runas`, `chmod 777`, `chown` |
| 远程执行 | `ssh`, `scp`, `nc`, `telnet`, 管道注入 (`curl \| bash`) |
| 系统写入 | `C:\Windows`, `Program Files`, 用户 shell 配置文件 |
| 隐蔽下载 | `curl -o`, `wget -O` |

> deny 优先级高于 allow，即使 allow 命中也会被 deny 拦截。

### Clash Verge 代理信息
- 地址：`127.0.0.1`
- 端口：`7897`
- 协议：HTTP/HTTPS

### 环境验证 (2026-06-06 09:36)
| 组件 | 状态 | 版本/路径 |
|------|------|-----------|
| huggingface-cli / hf | ✅ | v1.15.0 |
| Git LFS | ✅ | v3.7.1 |
| Claude Code CLI | ✅ | v2.1.166 |
| 项目文件 | ✅ | 5 个文件就位 |
| 代理端口 7897 | ⚠️ | 当前未监听（执行时需确保 Clash Verge 运行） |
| 下载目录 D:/cc_download | ✅ | 已创建 |

### 测试记录 (2026-06-06 15:03 — 15:10)

**测试方式**：Claude Code CronCreate 在 15:03 触发下载 prompt

| 测试项 | 结果 | 详情 |
|--------|------|------|
| CronCreate 定时触发 | ✅ | 15:03 准点触发 |
| hf-mirror 连通性 | ✅ | curl 返回 200 OK |
| huggingface.co 连通性 | ❌ | 直连超时 |
| `hf download` CLI | ❌ | SSL 错误: `UNEXPECTED_EOF_WHILE_READING`（即使跳过验证也报错） |
| Python SDK `snapshot_download` | ✅ | 16 文件成功开始下载（约 1.3s/文件） |
| hf-mirror 直连（不走代理） | ✅ | Python SDK 可正常下载 |
| Clash Verge 代理 + hf CLI | ❌ | SSL 握手失败 |

**重大发现**：新版 `huggingface_hub` 已弃用 `huggingface-cli`，改为 `hf`，但 `hf` 在 Windows + Python 3.14 下有 SSL bug。**Python SDK (`snapshot_download`) 是唯一稳定可用的方式**。

**决策变更**：
- 下载方式：`hf download` CLI → Python SDK `snapshot_download()`
- 代理策略：hf-mirror 直连（无需代理），仅回退 HF 官方时才开代理
- 已更新 download_tasks.md、download_launcher.bat、config.yaml

### 待办
- [x] 项目环境验证
- [x] 手动测试下载流程（CronCreate 触发，发现 hf CLI SSL bug 已修复）
- [ ] 清理测试产生的部分下载文件（D:/cc_download/libero_object 中有少量残留）
- [ ] 配置 Windows 任务计划程序
- [ ] 首次夜间运行并检查日志
