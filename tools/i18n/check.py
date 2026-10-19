"""Validate and join one language: tools/i18n/out/<lang>.partNN.json → tools/i18n/out/<lang>.json
usage: python3 tools/i18n/check.py <lang>      (prints problems; exit 1 when any)"""
import glob, json, re, sys
lang = sys.argv[1]
src = json.load(open('tools/i18n/source.json'))
out = {}
for f in sorted(glob.glob('tools/i18n/out/%s.part*.json' % lang)):
    out.update(json.load(open(f, encoding='utf-8')))
probs = []
toks = lambda s: sorted(re.findall(r'\{\w+\}|</?\d+/?>', s))
for k in src:
    v = out.get(k)
    if v is None: probs.append('MISSING: ' + k); continue
    if not isinstance(v, str) or not v.strip(): probs.append('EMPTY: ' + k); continue
    if toks(k) != toks(v): probs.append('TOKENS: %s  =>  %s' % (k, v))
extra = [k for k in out if k not in set(src)]
if extra: probs.append('%d keys not in source (ignored)' % len(extra))
json.dump({k: out[k] for k in src if k in out}, open('tools/i18n/out/%s.json' % lang, 'w'), ensure_ascii=False, indent=0)
print('%s: %d/%d translated, %d problems' % (lang, sum(1 for k in src if k in out), len(src), len([p for p in probs if not p.endswith('(ignored)')])))
for p in probs[:40]: print(' ', p)
sys.exit(1 if any(not p.endswith('(ignored)') for p in probs) else 0)
