"""Merge runtime keys (collect-hook) + static keys into tools/i18n/source.json.
usage: python3 tools/i18n/merge.py <runtime.txt> <static.txt>"""
import json, re, sys
keys = set()
for f in sys.argv[1:3]:
    for l in open(f, encoding='utf-8'):
        k = l.rstrip('\n').strip()
        if not k or not re.search(r'[A-Za-z]{2}', k): continue
        if '"' in k or '=' in k or '${' in k or '\\' in k: continue
        if re.fullmatch(r'[a-z-]+( [a-z-]+)?', k): continue          # css class names
        if k in ('Leaflet', 'OpenStreetMap', 'contributors'): continue
        keys.add(k)
seed = json.load(open('tools/i18n/seed_qr.json'))
for l in seed: keys.update(seed[l].keys())
keys = sorted(keys)
json.dump(keys, open('tools/i18n/source.json', 'w'), ensure_ascii=False, indent=0)
print(len(keys), 'keys', sum(len(k.split()) for k in keys), 'words')
