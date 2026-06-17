# Model Downloader — 快速开始

## 1. 前置条件

```bash
# 确保已安装
pip install huggingface_hub
git lfs install
```

Clash Verge 需处于运行状态（代理端口 7897）。

## 2. 添加下载任务

编辑 `download_tasks.md`，按模板添加模型：

```markdown
## 模型 N：<名称>

- **HuggingFace 仓库**：`组织/模型名`
- **存储子目录**：`子目录名`
- **状态**：⏳ 待下载
- **下载命令**：
  ```bash
  huggingface-cli download 组织/模型名 \
    --local-dir D:/cc_download/子目录 \
    --local-dir-use-symlinks False \
    --resume-download
  ```
```

## 3. 手动测试

```bash
cd D:\AAA_study\my_code_file\my_cc\model_downloader
download_launcher.bat
```

## 4. 配置定时任务

1. `Win+R` → `taskschd.msc`
2. 创建基本任务 → 名称: **Model Downloader**
3. 触发器: **每天 23:30**
4. 操作: **启动程序** → 选择 `download_launcher.bat`
5. 设置: 停止运行超过 **6 小时 30 分钟** 的任务

## 5. 查看日志

```bash
type D:\AAA_study\my_code_file\my_cc\model_downloader\logs\download_*.log
```
