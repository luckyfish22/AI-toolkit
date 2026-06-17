"""Download a single model from HuggingFace with mirror fallback and retry."""
import os, sys, time, argparse

parser = argparse.ArgumentParser()
parser.add_argument('--repo', required=True)
parser.add_argument('--local-dir', required=True)
parser.add_argument('--name', required=True)
args = parser.parse_args()

os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '1'

start = time.time()
print(f'[{time.strftime("%H:%M:%S")}] Starting: {args.name}')
print(f'[{time.strftime("%H:%M:%S")}] Repo: {args.repo}')
print(f'[{time.strftime("%H:%M:%S")}] Local: {args.local_dir}')

# Strategy: try hf-mirror first (direct), then HF official with proxy
strategies = [
    ('hf-mirror.com (direct)', 'https://hf-mirror.com', False),
    ('huggingface.co (proxy)', 'https://huggingface.co', True),
]

from huggingface_hub import snapshot_download

for strategy_name, endpoint, use_proxy in strategies:
    os.environ['HF_ENDPOINT'] = endpoint
    if use_proxy:
        os.environ['HTTP_PROXY'] = 'http://127.0.0.1:7897'
        os.environ['HTTPS_PROXY'] = 'http://127.0.0.1:7897'
    else:
        os.environ.pop('HTTP_PROXY', None)
        os.environ.pop('HTTPS_PROXY', None)

    print(f'[{time.strftime("%H:%M:%S")}] Trying: {strategy_name}')

    for attempt in range(3):
        try:
            snapshot_download(
                repo_id=args.repo,
                local_dir=args.local_dir,
                max_workers=4,
                resume_download=True,
            )
            elapsed = time.time() - start
            print(f'[{time.strftime("%H:%M:%S")}] SUCCESS: {args.name} in {elapsed:.0f}s ({elapsed/60:.1f}min) via {strategy_name}')
            print('RESULT: SUCCESS')
            sys.exit(0)
        except Exception as e:
            err_msg = str(e)[:200]
            print(f'[{time.strftime("%H:%M:%S")}] Attempt {attempt+1}/3 failed via {strategy_name}: {err_msg}')
            if attempt < 2:
                wait = (attempt + 1) * 30
                print(f'[{time.strftime("%H:%M:%S")}] Retrying in {wait}s...')
                time.sleep(wait)

    print(f'[{time.strftime("%H:%M:%S")}] All attempts failed for {strategy_name}, switching...')

elapsed = time.time() - start
print(f'[{time.strftime("%H:%M:%S")}] FAILED: {args.name} after all strategies in {elapsed:.0f}s')
print('RESULT: FAILED')
sys.exit(1)
