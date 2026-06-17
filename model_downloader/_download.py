#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Model Downloader — 夜间自动下载脚本
由 Claude Code agent 驱动，2026-06-08
"""

import os
import sys
import time
import subprocess
from datetime import datetime, timedelta

LOG_FILE = "D:/AAA_study/my_code_file/my_cc/model_downloader/logs/download_2026-06-08_23-57.log"
DOWNLOAD_BASE = "D:/cc_download"

MODELS = [
    {
        "name": "libero_object",
        "repo_id": "openvla/openvla-7b-finetuned-libero-object",
        "local_dir": "D:/cc_download/libero_object",
        "max_workers": 4,
    },
    {
        "name": "libero_goal",
        "repo_id": "openvla/openvla-7b-finetuned-libero-goal",
        "local_dir": "D:/cc_download/libero_goal",
        "max_workers": 4,
    },
    {
        "name": "libero_10",
        "repo_id": "openvla/openvla-7b-finetuned-libero-10",
        "local_dir": "D:/cc_download/libero_10",
        "max_workers": 4,
    },
]

PROXY = "http://127.0.0.1:7897"


def log(msg: str):
    """写日志到文件 + 控制台"""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def get_dir_size_mb(path: str) -> float:
    """递归计算目录大小 (MB)"""
    total = 0
    if not os.path.isdir(path):
        return 0.0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try:
                total += os.path.getsize(fp)
            except OSError:
                pass
    return total / (1024 * 1024)


def format_duration(seconds: float) -> str:
    """格式化耗时"""
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        m, s = divmod(int(seconds), 60)
        return f"{m}m {s}s"
    else:
        h, r = divmod(int(seconds), 3600)
        m, s = divmod(r, 60)
        return f"{h}h {m}m {s}s"


def download_model(model: dict, endpoint: str, proxy_needed: bool) -> bool:
    """
    使用 huggingface_hub.snapshot_download 下载模型。
    endpoint: 镜像/直连地址
    proxy_needed: 是否设置代理
    返回 True 表示成功
    """
    env = os.environ.copy()
    env["HF_ENDPOINT"] = endpoint
    if proxy_needed:
        env["HTTP_PROXY"] = PROXY
        env["HTTPS_PROXY"] = PROXY
        env["http_proxy"] = PROXY
        env["https_proxy"] = PROXY
    else:
        # 清除代理
        for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
            env.pop(k, None)

    code = f"""
import os
import sys
os.environ['HF_ENDPOINT'] = {endpoint!r}
from huggingface_hub import snapshot_download

print("Snapshot download starting...", flush=True)
snapshot_download(
    repo_id={model['repo_id']!r},
    local_dir={model['local_dir']!r},
    max_workers={model['max_workers']},
)
print("SNAPSHOT_DOWNLOAD_OK", flush=True)
"""

    log(f"  → 执行: python -c (snapshot_download {model['repo_id']})")
    log(f"  → HF_ENDPOINT={endpoint}")
    log(f"  → proxy={'ON' if proxy_needed else 'OFF'}")

    try:
        proc = subprocess.run(
            [sys.executable, "-X", "utf8", "-c", code],
            env=env,
            capture_output=True,
            text=True,
            timeout=7200,  # 2h timeout per model
            cwd=DOWNLOAD_BASE,
        )
        # Log output
        for line in proc.stdout.splitlines():
            log(f"  [stdout] {line}")
        for line in proc.stderr.splitlines():
            log(f"  [stderr] {line}")

        if proc.returncode == 0 and "SNAPSHOT_DOWNLOAD_OK" in proc.stdout:
            return True
        else:
            log(f"  ✗ 进程退出码: {proc.returncode}")
            return False
    except subprocess.TimeoutExpired:
        log("  ✗ 下载超时（7200s）")
        return False
    except Exception as e:
        log(f"  ✗ 异常: {e}")
        return False


def main():
    # 写日志头
    separator = "=" * 70
    log(separator)
    log("Model Downloader — 夜间自动下载")
    log(f"日期: 2026-06-08")
    log(f"模型数量: {len(MODELS)}")
    log(f"下载目录: {DOWNLOAD_BASE}")
    log(separator)

    results = []

    for i, model in enumerate(MODELS, 1):
        log("")
        log(f"--- 模型 {i}/{len(MODELS)}: {model['name']} ---")
        log(f"  repo: {model['repo_id']}")
        log(f"  local_dir: {model['local_dir']}")

        # 检查是否已存在（断点续传由 snapshot_download 内置处理，这里只做提示）
        if os.path.isdir(model["local_dir"]):
            existing_size = get_dir_size_mb(model["local_dir"])
            log(f"  本地已存在目录，当前大小: {existing_size:.1f} MB（将断点续传）")

        start_time = time.time()

        # --- 第 1 次尝试：hf-mirror 直连 ---
        log("  [尝试 1/2] hf-mirror 镜像直连...")
        success = download_model(model, endpoint="https://hf-mirror.com", proxy_needed=False)

        # --- 第 2 次尝试：HF 直连 + 代理 ---
        if not success:
            log("  [尝试 2/2] HuggingFace 直连 + 代理...")
            success = download_model(model, endpoint="https://huggingface.co", proxy_needed=True)

        elapsed = time.time() - start_time
        final_size = get_dir_size_mb(model["local_dir"]) if os.path.isdir(model["local_dir"]) else 0

        if success:
            log(f"  ✅ 下载成功！耗时 {format_duration(elapsed)}，大小 {final_size:.1f} MB")
            results.append((model["name"], "✅ 成功", format_duration(elapsed), f"{final_size:.1f} MB"))
        else:
            log(f"  ❌ 下载失败！耗时 {format_duration(elapsed)}")
            results.append((model["name"], "❌ 失败", format_duration(elapsed), f"{final_size:.1f} MB"))

    # --- 汇总 ---
    log("")
    log(separator)
    log("下载完成汇总")
    log(separator)
    log(f"{'模型':<16} {'结果':<10} {'耗时':<14} {'大小':<10}")
    log("-" * 52)
    for name, result, dur, size in results:
        log(f"{name:<16} {result:<10} {dur:<14} {size:<10}")
    log(separator)

    # 输出特殊标记给调用方解析
    success_count = sum(1 for r in results if "成功" in r[1])
    fail_count = sum(1 for r in results if "失败" in r[1])
    log(f"SUMMARY: {success_count}/{len(MODELS)} 成功, {fail_count} 失败")
    log(f"LOG_FILE: {LOG_FILE}")

    # 输出机器可读的摘要，给 Claude Code agent 解析
    print("")
    print("=== MODEL_DOWNLOAD_REPORT ===")
    for name, result, dur, size in results:
        status = "SUCCESS" if "成功" in result else "FAILED"
        print(f"RESULT|{name}|{status}|{dur}|{size}")
    print("=== END_REPORT ===")


if __name__ == "__main__":
    main()
