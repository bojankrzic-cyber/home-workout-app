"""Download the label PDFs the on-pack QR codes point to and extract their text.

usage: python3 -I tools/catalog/fetch_labels.py <qr.xlsx> <cache-dir>
Writes <cache-dir>/rows.json (product QR rows, without scan counts) and <cache-dir>/txt/<sku>.txt.
The xlsx comes from QRCode Studio (columns: name, campaign, short link, target, scans, changed, note).
"""
import json, os, re, subprocess, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
import openpyxl

xlsx, cache = sys.argv[1], sys.argv[2]
os.makedirs(cache + '/pdf', exist_ok=True); os.makedirs(cache + '/txt', exist_ok=True)
rows = []
for r in openpyxl.load_workbook(xlsx).active.iter_rows(min_row=2, values_only=True):
    if not r[0]: continue
    m = re.match(r'^(\d{4})[\s_-]*(.*)$', str(r[0]).strip())
    target = (r[3] or '').strip()
    rows.append({'sku': m.group(1) if m else None, 'name': (m.group(2) if m else str(r[0])).strip(' _-'),
                 'campaign': r[1] if isinstance(r[1], str) else None, 'short': r[2], 'target': target,
                 'scans': int(r[4] or 0), 'note': r[6]})
json.dump(rows, open(cache + '/rows.json', 'w'), ensure_ascii=False, indent=1)

def get(r):
    if not r['sku'] or not r['target'].lower().endswith('.pdf'): return
    pdf, txt = '%s/pdf/%s.pdf' % (cache, r['sku']), '%s/txt/%s.txt' % (cache, r['sku'])
    if os.path.exists(txt) and os.path.getsize(txt) > 0: return
    try:
        req = urllib.request.Request(urllib.parse.quote(r['target'], safe=':/?&=%#'), headers={'User-Agent': 'Mozilla/5.0 FinestMe catalog builder'})
        open(pdf, 'wb').write(urllib.request.urlopen(req, timeout=60).read())
        subprocess.run(['pdftotext', '-raw', pdf, txt], check=True, capture_output=True)
        os.remove(pdf)
    except Exception as e:
        fails[r['sku']] = str(e)[:80]

# the highest-scanned code wins when a SKU has two codes
seen, fails = {}, {}
for r in sorted(rows, key=lambda r: -r['scans']):
    if r['sku'] and r['sku'] not in seen: seen[r['sku']] = r
with ThreadPoolExecutor(12) as ex: list(ex.map(get, seen.values()))
json.dump(fails, open(cache + '/fails.json', 'w'), indent=1)
print(len(rows), 'rows,', len(seen), 'skus,', len(os.listdir(cache + '/txt')), 'texts')
