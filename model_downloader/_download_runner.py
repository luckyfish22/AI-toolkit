"""
Model Download Runner — 2026-06-12
Sequentially downloads models: hf-mirror first, fallback to HF official + proxy.
"""
import os, sys, time, json
from datetime import datetime

LOG_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "logs",
    f"download_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.log"
)
HF_MIRROR = "https://hf-mirror.com"
HF_OFFICIAL = "https://huggingface.co"
DOWNLOAD_DIR = r"D:\cc_download"
PROXY = "http://127.0.0.1:7897"
MAX_RETRIES = 3

MODELS = [
    {
        "name": "libero_object",
        "repo_id": "openvla/openvla-7b-finetuned-libero-object",
        "local_dir": os.path.join(DOWNLOAD_DIR, "libero_object"),
    },
    {
        "name": "libero_goal",
        "repo_id": "openvla/openvla-7b-finetuned-libero-goal",
        "local_dir": os.path.join(DOWNLOAD_DIR, "libero_goal"),
    },
    {
        "name": "libero_10",
        "repo_id": "openvla/openvla-7b-finetuned-libero-10",
        "local_dir": os.path.join(DOWNLOAD_DIR, "libero_10"),
    },
]

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def set_env(endpoint, use_proxy):
    """Set environment variables for download."""
    os.environ["HF_ENDPOINT"] = endpoint
    if use_proxy:
        os.environ["HTTP_PROXY"] = PROXY
        os.environ["HTTPS_PROXY"] = PROXY
    else:
        os.environ.pop("HTTP_PROXY", None)
        os.environ.pop("HTTPS_PROXY", None)

def try_download(repo_id, local_dir, endpoint, use_proxy=False):
    """Download using snapshot_download directly. Returns (success, error_msg)."""
    set_env(endpoint, use_proxy)
    os.makedirs(local_dir, exist_ok=True)

    try:
        from huggingface_hub import snapshot_download
        snapshot_download(
            repo_id=repo_id,
            local_dir=local_dir,
            max_workers=4,
            resume_download=True,
        )
        return True, ""
    except Exception as e:
        return False, str(e)

def count_files_and_size(local_dir):
    """Count files and total size in local_dir."""
    if not os.path.isdir(local_dir):
        return 0, 0
    count, size = 0, 0
    for root, dirs, files in os.walk(local_dir):
        for f in files:
            fp = os.path.join(root, f)
            try:
                size += os.path.getsize(fp)
                count += 1
            except:
                pass
    return count, size

def fmt_size(n):
    if n >= 1024**3:
        return f"{n / 1024**3:.2f} GB"
    elif n >= 1024**2:
        return f"{n / 1024**2:.2f} MB"
    else:
        return f"{n / 1024:.2f} KB"

def download_model(model):
    name = model["name"]
    repo_id = model["repo_id"]
    local_dir = model["local_dir"]

    log(f"{'='*60}")
    log(f"Downloading: {name}")
    log(f"  Repo: {repo_id}")
    log(f"  Local: {local_dir}")

    # Pre-check existing files
    exist_cnt, exist_sz = count_files_and_size(local_dir)
    if exist_cnt > 0:
        log(f"  Existing: {exist_cnt} files, {fmt_size(exist_sz)} (will resume)")

    start_time = time.time()

    for attempt in range(1, MAX_RETRIES + 1):
        # Strategy 1: hf-mirror (no proxy)
        log(f"  [{attempt}/{MAX_RETRIES}] Trying hf-mirror (direct, no proxy)...")
        success, err = try_download(repo_id, local_dir, HF_MIRROR, use_proxy=False)

        if success:
            elapsed = time.time() - start_time
            cnt, sz = count_files_and_size(local_dir)
            log(f"  ✅ SUCCESS via hf-mirror — {fmt_size(sz)}, {cnt} files, {elapsed/60:.1f} min")
            return {"name": name, "result": "DONE", "elapsed": elapsed, "size": sz, "files": cnt}

        err_snip = err.strip()[-300:] if err else "(no output)"
        log(f"  ❌ hf-mirror failed: {err_snip}")

        # Strategy 2: HF official + proxy
        log(f"  [{attempt}/{MAX_RETRIES}] Fallback: HF official + proxy...")
        success2, err2 = try_download(repo_id, local_dir, HF_OFFICIAL, use_proxy=True)

        if success2:
            elapsed = time.time() - start_time
            cnt, sz = count_files_and_size(local_dir)
            log(f"  ✅ SUCCESS via HF official — {fmt_size(sz)}, {cnt} files, {elapsed/60:.1f} min")
            return {"name": name, "result": "DONE", "elapsed": elapsed, "size": sz, "files": cnt}

        err_snip2 = err2.strip()[-300:] if err2 else "(no output)"
        log(f"  ❌ HF official failed: {err_snip2}")

        if attempt < MAX_RETRIES:
            delay = 30 * attempt
            log(f"  Waiting {delay}s before next retry...")
            time.sleep(delay)

    elapsed = time.time() - start_time
    cnt, sz = count_files_and_size(local_dir)
    log(f"  ❌ FAILED after {MAX_RETRIES} attempts ({elapsed/60:.1f} min total)")
    return {"name": name, "result": "FAILED", "elapsed": elapsed, "size": sz, "files": cnt}


# ============================================================
# Main
# ============================================================
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
log("=" * 60)
log("Model Download Runner — 2026-06-12")
log(f"Models to download: {[m['name'] for m in MODELS]}")
log("=" * 60)

results = []
for model in MODELS:
    result = download_model(model)
    results.append(result)

# Summary
log("")
log("=" * 60)
log("DOWNLOAD SUMMARY")
log("=" * 60)
log(f"{'Model':<20} {'Result':<8} {'Size':<14} {'Files':<8} {'Time'}")
log("-" * 56)
for r in results:
    elapsed_min = r['elapsed'] / 60 if r['elapsed'] else 0
    log(f"  {r['name']:<20} {r['result']:<8} {fmt_size(r.get('size', 0)):<14} {r.get('files', 0):<8} {elapsed_min:.1f} min")
log("-" * 56)
done = sum(1 for r in results if r['result'] == 'DONE')
failed = sum(1 for r in results if r['result'] == 'FAILED')
log(f"  Done: {done}, Failed: {failed}")
log("=" * 60)

# Output JSON for agent
print("__RESULTS_JSON__")
print(json.dumps(results, indent=2, ensure_ascii=False))
