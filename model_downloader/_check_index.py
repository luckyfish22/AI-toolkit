import json, os

path = 'D:/cc_download/libero_object/model.safetensors.index.json'
with open(path) as f:
    idx = json.load(f)

files = set()
for k, v in idx.get('weight_map', {}).items():
    files.add(v)

print('Expected safetensors files:')
for f in sorted(files):
    full = os.path.join('D:/cc_download/libero_object', f)
    exists = os.path.exists(full)
    size = os.path.getsize(full) if exists else 0
    print(f'  {f}  [{"EXISTS" if exists else "MISSING"}]  {size/1e9:.2f}GB' if exists else f'  {f}  [MISSING]')

print(f'\nTotal weight entries: {len(idx.get("weight_map", {}))}')
print(f'Metadata: {idx.get("metadata", {})}')
