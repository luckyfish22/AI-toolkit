# 模型下载任务清单

> **执行说明**：Claude Code agent 请使用 Python SDK (`huggingface_hub.snapshot_download`) 下载。
> - 已下载完成的模型自动跳过（`snapshot_download` 内置断点续传）
> - 优先使用 hf-mirror 镜像直连（测试验证可通，无需代理）
> - 镜像失败时回退到 HF 直连 + 代理
> - 每个模型下载完成后，在此文件对应条目后标注 `[DONE]` 或 `[FAILED]`

---

## 任务概况

| 模型序号 | 模型名称 | HF 仓库 | 状态 |
|----------|----------|---------|------|
| 1 | libero_object | `openvla/openvla-7b-finetuned-libero-object` | ⏳ 待下载 |
| 2 | libero_goal   | `openvla/openvla-7b-finetuned-libero-goal` | ⏳ 待下载 |
| 3 | libero_10     | `openvla/openvla-7b-finetuned-libero-10` | ⏳ 待下载 |

> ⛔ **已排除**：`libero_spatial` — 不需要下载

---

## 模型 1：libero_object

- **HuggingFace 仓库**：`openvla/openvla-7b-finetuned-libero-object`
- **存储子目录**：`libero_object`
- **完整路径**：`D:/cc_download/libero_object`
- **说明**：LIBERO 物体泛化任务微调的 OpenVLA-7B 权重
- **状态**：⏳ 待下载
- **下载代码**：
  ```python
  import os
  os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
  from huggingface_hub import snapshot_download

  snapshot_download(
      repo_id='openvla/openvla-7b-finetuned-libero-object',
      local_dir='D:/cc_download/libero_object',
      max_workers=4
  )
  ```

---

## 模型 2：libero_goal

- **HuggingFace 仓库**：`openvla/openvla-7b-finetuned-libero-goal`
- **存储子目录**：`libero_goal`
- **完整路径**：`D:/cc_download/libero_goal`
- **说明**：LIBERO 目标泛化任务微调的 OpenVLA-7B 权重
- **状态**：⏳ 待下载
- **下载代码**：
  ```python
  import os
  os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
  from huggingface_hub import snapshot_download

  snapshot_download(
      repo_id='openvla/openvla-7b-finetuned-libero-goal',
      local_dir='D:/cc_download/libero_goal',
      max_workers=4
  )
  ```

---

## 模型 3：libero_10

- **HuggingFace 仓库**：`openvla/openvla-7b-finetuned-libero-10`
- **存储子目录**：`libero_10`
- **完整路径**：`D:/cc_download/libero_10`
- **说明**：LIBERO-10 任务微调的 OpenVLA-7B 权重
- **状态**：⏳ 待下载
- **下载代码**：
  ```python
  import os
  os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
  from huggingface_hub import snapshot_download

  snapshot_download(
      repo_id='openvla/openvla-7b-finetuned-libero-10',
      local_dir='D:/cc_download/libero_10',
      max_workers=4
  )
  ```

---

## 下载完成汇总

_此处由 Claude Code agent 在完成所有下载后自动填写。_

| 模型 | 结果 | 耗时 | 文件大小 |
|------|------|------|----------|
| libero_object | - | - | - |
| libero_goal   | - | - | - |
| libero_10     | - | - | - |
