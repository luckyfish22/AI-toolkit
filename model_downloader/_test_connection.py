"""Test connectivity to HF and hf-mirror."""
import os, sys
from huggingface_hub import HfApi, list_repo_files

repo = 'openvla/openvla-7b-finetuned-libero-object'

# Test 1: hf-mirror
print("=== Test 1: hf-mirror.com ===")
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
try:
    files = list_repo_files(repo)
    print(f"SUCCESS: {len(files)} files found")
    for f in files[:5]:
        print(f"  {f}")
    if len(files) > 5:
        print(f"  ... and {len(files)-5} more")
except Exception as e:
    print(f"FAILED: {e}")

# Test 2: HF direct
print("\n=== Test 2: huggingface.co (direct) ===")
os.environ.pop('HF_ENDPOINT', None)
try:
    files = list_repo_files(repo)
    print(f"SUCCESS: {len(files)} files found")
    for f in files[:5]:
        print(f"  {f}")
except Exception as e:
    print(f"FAILED: {e}")

# Test 3: HF direct with proxy
print("\n=== Test 3: huggingface.co (proxy 127.0.0.1:7897) ===")
os.environ['HTTP_PROXY'] = 'http://127.0.0.1:7897'
os.environ['HTTPS_PROXY'] = 'http://127.0.0.1:7897'
try:
    files = list_repo_files(repo)
    print(f"SUCCESS: {len(files)} files found")
    for f in files[:5]:
        print(f"  {f}")
except Exception as e:
    print(f"FAILED: {e}")
