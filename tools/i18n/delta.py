"""Append keys seen at runtime or in the static scan that source.json lacks.
Runtime keys are kept even when they are a single lowercase word ("today", "sets") – they were on screen;
static keys still skip things that look like css classes or codes."""
import json, re, sys
src = json.load(open('tools/i18n/source.json')); have = set(src)
def ok(k, runtime):
    if not k or not re.search(r'[A-Za-z]{2}', k): return False
    if '"' in k or '=' in k or '${' in k or '\\' in k: return False
    if k in ('Leaflet', 'OpenStreetMap', 'contributors', 'FinestMe', "Nature's Finest", 'Nature’s Finest'): return False
    if not runtime and re.fullmatch(r'[a-z-]+( [a-z-]+)?', k): return False
    return True
new = []
for f, rt in ((sys.argv[1], True), (sys.argv[2], False)):
    for l in open(f, encoding='utf-8'):
        k = l.rstrip('\n').strip()
        if ok(k, rt) and k not in have: have.add(k); new.append(k)
src += new
open('tools/i18n/source.json', 'w').write('[\n' + ',\n'.join(json.dumps(x, ensure_ascii=False) for x in src) + '\n]')
json.dump(new, open('tools/i18n/new-keys.json', 'w'), ensure_ascii=False, indent=0)
print(len(new), 'new keys')
