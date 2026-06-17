import requests, time, sys

PROXY_URL = "http://127.0.0.1:7897"
proxies = {"https": PROXY_URL, "http": PROXY_URL}

def test(url, use_proxy=False):
    label = f"{url} (proxy={'ON' if use_proxy else 'OFF'})"
    try:
        s = time.time()
        r = requests.head(url, timeout=15, proxies=proxies if use_proxy else None, allow_redirects=True)
        print(f"OK   {label}  HTTP {r.status_code}  {time.time()-s:.1f}s")
        return True
    except Exception as e:
        msg = str(e)[:200]
        print(f"FAIL {label}  {type(e).__name__}: {msg}")
        return False

results = []
results.append(("Proxy health", test(f"http://127.0.0.1:7897", use_proxy=False)))
results.append(("hf-mirror direct", test("https://hf-mirror.com", use_proxy=False)))
results.append(("hf-mirror + proxy", test("https://hf-mirror.com", use_proxy=True)))
results.append(("HF official direct", test("https://huggingface.co", use_proxy=False)))
results.append(("HF official + proxy", test("https://huggingface.co", use_proxy=True)))

print()
print("=== SUMMARY ===")
for name, ok in results:
    print(f"  {'PASS' if ok else 'FAIL'}: {name}")

all_ok = all(r[1] for r in results)
print(f"\nOverall: {'ALL PASS' if all_ok else 'SOME FAILED'}")
sys.exit(0 if all_ok else 1)
