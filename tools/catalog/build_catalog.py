"""Build the in-app product catalog from the official label texts behind the on-pack QR codes.

usage: python3 -I tools/catalog/build_catalog.py <cache-dir> <repo-dir>
Input: <cache-dir>/rows.json + txt/<sku>.txt (from fetch_labels.py).
Output:
  js/catalog.js            – small index loaded at start: sku → name, kind, pack, daily dose, days per pack
  data/labels/<sku>.json   – per product, loaded when the guide opens: label text per language
                             (how to use, warnings, full label) – the approved label wording, never rewritten
  docs/qr-audit.csv        – every product QR: where it points today, whether it works, parse quality
Doses are parsed from the English label. Anything the parser is unsure of is flagged (`chk`), and the
app then asks the customer to confirm the servings instead of guessing.
"""
import csv, json, os, re, sys

cache, repo = sys.argv[1], sys.argv[2]
rows = json.load(open(cache + '/rows.json'))
EANS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ean.json'))) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ean.json')) else {}
LANG = {'SI': 'sl', 'CZ': 'cs', 'GR': 'el', 'SE': 'sv', 'DK': 'da', 'DA': 'da', 'EE': 'et', 'ET': 'et'}
USE = {
 'en': r'Using advice|Usage instructions|Using instructions|Instructions for use|Usage advice|Directions(?: for use)?|Recommended (?:daily )?(?:use|dose|intake)|Usage|Preparation|How to use|Cooking instructions',
 'sl': r'Navodila za uporabo|Navodilo za uporabo|Priporočen[a-z]* (?:dnevn[a-z]* )?(?:odmer[a-z]*|uporab[a-z]*|količin[a-z]*)|Način uporabe|Uporaba|Priprava',
 'hr': r'Upute za upotrebu|Način upotrebe|Savjeti? za upotrebu|Upotreba|Savjeti? za uporabu|Upute za uporabu|Uputa za uporabu|Način (?:uporabe|primjene|pripreme)|Preporučen[a-z]* (?:dnevn[a-z]* )?[a-z]+|Priprema|Uporaba',
 'it': r"Consigli d['’]uso|Modalità d['’]uso|Modo d['’]uso|Istruzioni (?:per l['’]uso|d['’]uso)|Dose giornaliera raccomandata|Preparazione|Uso",
 'de': r'Verzehrempfehlung|Anwendungs?(?:hinweise|empfehlung)?|Gebrauchsanweisung|Zubereitung|Empfohlene (?:Tages)?(?:menge|dosis|Anwendung)',
 'hu': r'Adagolás és fogyasztás|Ajánlott fogyasztás|Használati utasítások|Adagolás|Használat|Adagolási javaslat|Felhasználási (?:javaslat|útmutató)|Fogyasztási javaslat|Használati (?:utasítás|javaslat|útmutató)|Ajánlott napi (?:adag|mennyiség)|Elkészítés',
 'sk': r'Odporúčané (?:užívanie|dávkovanie|použitie|denné (?:dávkovanie|množstvo))|Návod na (?:použitie|prípravu)|Spôsob (?:použitia|prípravy|užívania)|Použitie|Príprava',
 'pl': r'Zalecan[a-z]* (?:dzienn[a-z]* )?(?:porcj[a-z]*|spożycie|sposób[a-z ]*|dawk[a-z]*)|Sposób (?:użycia|przygotowania|użytkowania|stosowania|spożycia)|Instrukcja (?:użycia|stosowania)|Przygotowanie|Stosowanie',
 'cs': r'Doporučená denní dávka|Doporučení k (?:použití|užívání)|Pokyny k použití|Rada|Doporučené (?:dávkování|užívání|použití|denní (?:dávka|množství))|Návod k (?:použití|přípravě)|Způsob (?:použití|přípravy|užívání)|Použití|Příprava',
 'fr': r"Conseils? d['’](?:utilisation|emploi)|Mode d['’]emploi|Instructions d['’]utilisation|Dose journalière recommandée|Préparation|Utilisation",
 'es': r'Consejos? de (?:uso|utilización)|Modo de (?:empleo|uso|preparación)|Instrucciones de (?:uso|preparación)|Dosis diaria recomendada|Preparación|Uso',
 'pt': r'Modo de usar|Uso|Conselhos? de (?:utilização|uso)|Modo de (?:utilização|uso|preparação|emprego)|Instruções de (?:utilização|uso)|Dose diária recomendada|Preparação|Utilização',
 'nl': r'Gebruiksadvies|Gebruiksaanwijzing|Aanbevolen (?:dagelijkse )?(?:gebruik|dosis|hoeveelheid)|Bereiding|Gebruik',
 'ro': r'Mod de (?:utilizare|preparare|administrare)|Instrucțiuni de utilizare|Recomandări? de (?:utilizare|consum)|Doza zilnică recomandată|Sfaturi de utilizare|Utilizare|Preparare',
 'el': r'Οδηγίες (?:χρήσης|χρήσεως|παρασκευής)|Συνιστώμεν[^\s:]* [^\s:]+(?: [^\s:]+)?|Τρόπος (?:χρήσης|παρασκευής)|Συμβουλές χρήσης|Χρήση|Παρασκευή',
 'sv': r'Användningssätt|Användningsanvisningar?|Administreringssätt|Använda (?:anvisning|råd)|Användningsinstruktioner|Användning av råd|Rekommenderad daglig dos|Användningsråd|Bruksanvisning|Rekommenderad (?:daglig )?(?:dos|användning|mängd)|Användning|Dosering|Tillagning|Beredning',
 'bg': r'Начин на (?:употреба|приложение|приготвяне)|Препоръчителн[а-я]* (?:дневн[а-я]* )?(?:доза|прием|количество)|Указания за употреба|Употреба|Приготвяне',
 'et': r'Kasutamis(?:juhend|juhis|soovitus)|Kasutusjuhend|Soovitatav (?:päevane )?(?:annus|kogus|kasutamine)|Kasutamine|Valmistamine',
 'lt': r'Vartojimo (?:būdas|rekomendacijos|instrukcija)|Naudojimo (?:būdas|instrukcija)|Rekomenduojama (?:paros )?(?:dozė|norma)|Vartojimas|Paruošimas',
 'lv': r'Lietošanas (?:veids|norādījumi|instrukcija|ieteikumi)|Ieteicamā (?:dienas )?(?:deva|lietošana)|Lietošana|Pagatavošana',
 'da': r'Anbefalet anvendelse|Anvendelsesmåde|Anvendelsesvejledning|Brug(?: af)? råd|Indgivelsesmåde|Vejledning|Brugsanvisning|Brugsvejledning|Anbefalet (?:daglig )?(?:dosis|brug|mængde)|Anvendelse|Dosering|Tilberedning|Brug',
}
STOP = {
 'en': r'Warn?nings?|Caution|Storage|Store|Note|Origin|Country of origin|May contain|Best before|Net weight|Allergens?',
 'sl': r'Opozoril[oa]|Shranjevanje|Hranjenje|Poreklo|Izvor|Država porekla|Lahko vsebuje|Opomba|Neto',
 'hr': r'Upozorenj[ea]|Čuvanje|Način čuvanja|Skladištenje|Podrijetlo|Porijeklo|Zemlja podrijetla|Može sadržavati|Napomena|Neto',
 'it': r'Avvertenz[ae]|Conservazione|Origine|Paese di origine|Può contenere|Nota|Peso netto',
 'de': r'Warnhinweis[e]?|Hinweis[e]?|Lagerung|Aufbewahrung|Herkunft|Ursprung(?:sland)?|Kann Spuren|Nettogewicht',
 'hu': r'Figyelmeztetés(?:ek)?|Tárolás|Eredet|Származási ország|Nyomokban|Megjegyzés|Nettó',
 'sk': r'Upozorneni[ea]|Skladovanie|Uchovávanie|Pôvod|Krajina pôvodu|Môže obsahovať|Poznámka|Čistá',
 'pl': r'Ostrzeżeni[ea]|Uwag[ia]|Przechowywanie|Pochodzenie|Kraj pochodzenia|Może zawierać|Masa netto',
 'cs': r'Upozornění|Varování|Skladování|Uchovávání|Původ|Země původu|Může obsahovat|Poznámka|Čistá',
 'fr': r'Avertissements?|Précautions?|Mises? en garde|Conservation|Stockage|Origine|Pays d[\'’]origine|Peut contenir|Poids net',
 'es': r'Advertencias?|Precauciones?|Conservación|Almacenamiento|Origen|País de origen|Puede contener|Peso neto',
 'pt': r'Advertências?|Avisos?|Atenção|Precauções?|Conservação|Armazenamento|Origem|País de origem|Pode conter|Peso líquido',
 'nl': r'Waarschuwing(?:en)?|Bewaren|Bewaaradvies|Opslag|Herkomst|Oorsprong|Land van herkomst|Kan sporen|Nettogewicht',
 'ro': r'Avertismente?|Avertizări|Atenție|Precauții|Păstrare|Depozitare|Origine|Țara de origine|Poate conține|Greutate netă',
 'el': r'Προειδοποιήσεις|Προειδοποίηση|Προσοχή|Αποθήκευση|Φύλαξη|Προέλευση|Χώρα προέλευσης|Μπορεί να περιέχει|Καθαρό βάρος',
 'sv': r'Varning(?:ar)?|Försiktighet|Förvaring|Förvaras|Ursprung|Ursprungsland|Kan innehålla|Nettovikt',
 'da': r'Advarsel|Advarsler|Opbevaring|Oprindelse|Oprindelsesland|Kan indeholde|Nettovægt',
 'bg': r'Предупреждени[ея]|Внимание|Съхранение|Произход|Може да съдържа|Нетно',
 'et': r'Hoiatus(?:ed)?|Säilitamine|Säilita|Päritolu|Võib sisaldada|Netokaal',
 'lt': r'Įspėjim(?:ai|as)|Laikymas|Laikyti|Kilmė|Kilmės šalis|Gali būti|Grynasis',
 'lv': r'Brīdinājum(?:i|s)|Uzglabāšana|Uzglabāt|Izcelsme|Var saturēt|Neto',
}
WARN = {k: v.split('|')[0] if False else v for k, v in {
 'en': r'Warn?nings?|Caution', 'sl': r'Opozoril[oa]', 'hr': r'Upozorenj[ea]', 'it': r'Avvertenz[ae]', 'de': r'Warnhinweis[e]?|Hinweis[e]?',
 'hu': r'Figyelmeztetés(?:ek)?', 'sk': r'Upozorneni[ea]', 'pl': r'Ostrzeżeni[ea]|Uwag[ia]', 'cs': r'Upozornění|Varování',
 'fr': r'Avertissements?|Précautions?|Mises? en garde', 'es': r'Advertencias?|Precauciones?', 'pt': r'Advertências?|Avisos?|Atenção|Precauções?',
 'nl': r'Waarschuwing(?:en)?', 'ro': r'Avertismente?|Avertizări|Atenție|Precauții', 'el': r'Προειδοποιήσεις|Προειδοποίηση|Προσοχή',
 'sv': r'Varning(?:ar)?|Försiktighet', 'da': r'Advarsel|Advarsler',
 'bg': r'Предупреждени[ея]|Внимание', 'et': r'Hoiatus(?:ed)?', 'lt': r'Įspėjim(?:ai|as)', 'lv': r'Brīdinājum(?:i|s)'}.items()}
STORE = {'en': r'Storage', 'sl': r'Shranjevanje|Hranjenje', 'hr': r'Čuvanje|Skladištenje', 'it': r'Conservazione', 'de': r'Lagerung|Aufbewahrung',
 'hu': r'Tárolás', 'sk': r'Skladovanie|Uchovávanie', 'pl': r'Przechowywanie', 'cs': r'Skladování|Uchovávání', 'fr': r'Conservation|Stockage',
 'es': r'Conservación|Almacenamiento', 'pt': r'Conservação|Armazenamento', 'nl': r'Bewaren|Bewaaradvies|Opslag', 'ro': r'Păstrare|Depozitare',
 'el': r'Αποθήκευση|Φύλαξη', 'sv': r'Förvaring|Förvaras', 'da': r'Opbevaring',
 'bg': r'Съхранение', 'et': r'Säilitamine|Säilita', 'lt': r'Laikymas|Laikyti', 'lv': r'Uzglabāšana|Uzglabāt'}

def clean(t):
    t = t.replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace('­', '')
    t = re.sub(r'(\w)-\n(?=[a-zà-žα-ω])', r'\1', t)          # hyphenated line breaks
    t = re.sub(r'\s*\n\s*', ' ', t)
    t = re.sub(r'www\.naturesfinest\.eu|Nature[`’\']s finest \| \w+', ' ', t, flags=re.I)
    return re.sub(r'\s{2,}', ' ', t).strip(' “”"')

def sections(txt):
    parts = re.split(r'(?m)^[“"]?\(?(?=[A-Z]{2}\))([A-Z]{2})\)\s*', txt)
    out = {}
    for i in range(1, len(parts) - 1, 2):
        code = LANG.get(parts[i], parts[i].lower())
        if code in USE and code not in out: out[code] = clean(parts[i + 1])
    if 'en' not in out and parts and len(parts) == 1:
        out['en'] = clean(txt[:4000])                       # single-language leaflet
    return out

def field(text, start, stop):
    start = start.replace(' ', ' ?')
    m = re.search(r'(?:^|[.!:,]\s?|\s)(' + start + r')\s*:\s*', text)
    if not m: return ''
    rest = text[m.end():]
    e = re.search(r'(?:[.!]\s+|\s)(?:' + stop + r')\s*:', rest)
    return rest[:e.start() + 1 if e else 600].strip()

UNITS = r'(capsules?|caps|tablets?|tabs|softgels?|tea ?bags?|filter bags?|sachets?|sticks?|g|kg|ml|mL|l|pcs|pieces|bars?|ampoules?|vials?|shots?)'
def num(s): return float(s.replace(',', '.'))

def pack_of(en, name, raw):
    # the "Net weight" box is the most reliable; else the product line before the first sentence
    nw = re.search(r'Net\s?weight', raw)
    m = nw and re.search(r'(?<![\w.,])(\d+(?:[.,]\d+)?)\s*(g|kg|ml|mL|l|capsules|caps|tablets|tea ?bags|sachets)\b', raw[nw.end():nw.end() + 700])
    if m: head = m.group(0)
    else: head = re.split(r'(?<=[a-z])\.\s|Ingredients?|Using|Usage', en[:260])[0] + ' ' + name
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*' + UNITS + r'\b', head, re.I)
    if not m: return None
    n, u = num(m.group(1)), m.group(2).lower()
    if u == 'kg': n, u = n * 1000, 'g'
    if u == 'l': n, u = n * 1000, 'ml'
    u = {'caps': 'capsule', 'tabs': 'tablet', 'tea bag': 'teabag', 'tea bags': 'teabag', 'teabags': 'teabag', 'filter bags': 'teabag', 'filter bag': 'teabag'}.get(u, u.rstrip('s') if u not in ('g', 'ml', 'pcs') else u)
    return {'n': n, 'unit': u}

def daily_of(use, pack):
    """→ (amount per day in pack units, times per day, per-week days, confidence)"""
    if not use: return None
    u = use.lower()
    times = 1
    m = re.search(r'(\d|two|three|twice|once)\s*(?:x|times)?\s*(?:a|per)\s*day|(twice|once) (?:a )?daily', u)
    if m:
        w = (m.group(1) or m.group(2))
        times = {'once': 1, 'twice': 2, 'two': 2, 'three': 3}.get(w, int(w) if w.isdigit() else 1)
    week = 3.5 if re.search(r'every (?:second|other) (?:day|night)', u) else None
    m = re.search(r'(\d)\s*(?:-|–|to)?\s*(\d)?\s*(?:x|times)\s*(?:a|per)\s*week', u)
    if m and not week: week = int(m.group(2) or m.group(1))
    unit = pack and pack['unit']
    amt = None
    if unit in ('capsule', 'tablet', 'softgel', 'teabag', 'sachet', 'stick', 'ampoule', 'vial', 'shot', 'bar'):
        word = {'capsule': r'capsules?|caps', 'tablet': r'tablets?', 'softgel': r'softgels?|capsules?', 'teabag': r'(?:tea|filter)\s?bags?|bags?',
                'sachet': r'sachets?|bags?', 'stick': r'sticks?|sachets?', 'ampoule': r'ampoules?|vials?', 'vial': r'vials?', 'shot': r'shots?|bottles?', 'bar': r'bars?'}[unit]
        m = re.search(r'(\d+|one|two|three)\s*(?:-|–|to)?\s*(\d+)?\s*(?:' + word + r')', u)
        if m:
            a = {'one': 1, 'two': 2, 'three': 3}.get(m.group(1)) or int(m.group(1))
            amt = int(m.group(2)) if m.group(2) and int(m.group(2)) < 10 else a
    elif unit in ('g', 'ml'):
        m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:-|–)?\s*(?:\d+(?:[.,]\d+)?)?\s*' + unit + r'\b', u)
        if m: amt = num(m.group(1))
        if amt and pack and amt >= pack['n']: amt = None          # e.g. "200 ml of water" for a 250 ml product
        if unit == 'g' and m:                                     # amounts of water/milk are not the dose
            ctx = u[m.end():m.end() + 25]
            if re.match(r'\s*\)?\s*(of )?(water|milk)', ctx): amt = None
    m = re.search(r'daily (?:dose|amount|intake)(?: is)?:?\s*(\d+(?:[.,]\d+)?)\s*(g|ml|capsules?|tablets?)\b', u)
    if m and unit in ('g', 'ml', 'capsule', 'tablet'):            # "daily dose is 10 g. Twice a day mix 5 g"
        amt, times = num(m.group(1)), 1
    if not amt: return None
    daily = amt * times
    if re.search(r'per day|a day|daily|day', u) is None and not week: conf = 'low'
    else: conf = 'ok'
    return {'amt': amt, 'times': times, 'daily': daily, 'week': week, 'conf': conf}

def kind_of(en, name, campaign):
    t = (en[:300] + ' ' + name + ' ' + (campaign or '')).lower()
    if re.search(r'food ?supplement|dietary ?supplement|prehransko dopolnilo', t): return 'supplement'
    if re.search(r'\b(tea|latte|coffee|infusion|matcha|cacao drink)\b', t): return 'drink'
    if re.search(r'scrub|cream|serum|roller|\bgel\b|oil for|cosmetic|shampoo|\bmask\b', t): return 'beauty'
    if re.search(r'mixer|shaker|bottle|device|machine', t): return 'gear'
    return 'food'

SLOT = [(r'before (?:going to )?(?:bed|sleep)|at night|in the evening|evening|before sleep', 'evening'),
        (r'in the morning|morning|on an empty stomach|before breakfast|with breakfast', 'morning'),
        (r'before (?:a )?(?:training|workout|exercise)', 'pre'), (r'after (?:training|workout|exercise)', 'post'),
        (r'before (?:a )?meal|with (?:a )?meal|during (?:a )?meal|after (?:a )?meal', 'meal')]

os.makedirs(repo + '/data/labels', exist_ok=True)
best = {}
for r in sorted(rows, key=lambda r: -r['scans']):
    if r['sku'] and r['sku'] not in best: best[r['sku']] = r
index, audit, langcov = {}, [], {}
for sku, r in sorted(best.items()):
    p = '%s/txt/%s.txt' % (cache, sku)
    txt = open(p).read() if os.path.exists(p) else ''
    secs = sections(txt) if txt else {}
    en = secs.get('en', '')
    name = re.sub(r'\s+', ' ', r['name']).strip()
    pack = pack_of(en, name, txt) if en else None
    use = {l: field(t, USE[l], STOP[l]) for l, t in secs.items()}
    warn = {l: field(t, WARN[l], STORE[l] + '|' + STOP[l].split('|Origin')[0] if l == 'en' else STORE[l]) for l, t in secs.items()}
    for l in secs: langcov.setdefault(l, [0, 0]); langcov[l][0] += 1; langcov[l][1] += bool(use[l])
    d = daily_of(use.get('en', ''), pack)
    kind = kind_of(en, name, r['campaign'])
    days = None
    if d and pack and d['daily']:
        days = int(pack['n'] / d['daily'] * (7 / d['week'] if d['week'] else 1))
        if days < 3 or days > 400: days = None
    hits = [s for rx, s in SLOT if re.search(rx, use.get('en', '').lower())]
    slot = hits[0] if hits and len(set(hits) & {'morning', 'evening'}) < 2 else None   # "2 in the morning, 2 in the evening": no single slot
    chk = []
    if not txt: chk.append('label not reachable')
    if not use.get('en'): chk.append('no EN usage')
    if kind in ('supplement', 'drink') and not days: chk.append('servings unknown')
    if d and d['conf'] == 'low': chk.append('dose unclear')
    e = {"n": name, "k": kind}
    g = lambda x: int(x) if float(x).is_integer() else x
    if pack: e['pk'] = [g(pack['n']), pack['unit']]
    if d: e['d'] = [g(d['amt']), d['times']] + ([g(d['week'])] if d['week'] else [])
    if days: e['days'] = days
    if slot: e['s'] = slot
    if r['campaign']: e['c'] = r['campaign']
    if txt: e['l'] = 1                                       # has a label file
    e['pdf'] = r['target']
    # every printed short link of this SKU, so the in-app scanner recognises old packs too
    qs = sorted({x['short'].rstrip('/').rsplit('/', 1)[-1] for x in rows if x['sku'] == sku and x['short']})
    if qs: e['q'] = qs
    # EAN barcodes from the ERP (Pantheon tHE_SetItem.acCode by ident = SKU): the scanner reads them too
    bs = sorted(k for k, v in EANS.items() if v == sku)
    if bs: e['b'] = bs
    if chk: e['chk'] = 1
    index[sku] = e
    if txt:
        json.dump({'sku': sku, 'name': name, 'pdf': r['target'], 'use': {k: v for k, v in use.items() if v},
                   'warn': {k: v for k, v in warn.items() if v}, 'full': secs}, open('%s/data/labels/%s.json' % (repo, sku), 'w'), ensure_ascii=False, separators=(',', ':'))
    audit.append({'sku': sku, 'name': name, 'short_link': r['short'], 'target': r['target'], 'status': 'ok' if txt else 'BROKEN',
                  'kind': kind, 'pack': pack and '%g %s' % (pack['n'], pack['unit']) or '', 'daily': d and '%g x%d' % (d['amt'], d['times']) or '',
                  'days_per_pack': days or '', 'needs_check': '; '.join(chk), 'en_usage': use.get('en', '')[:200], 'note': r['note'] or ''})

with open(repo + '/js/catalog.js', 'w') as f:
    f.write('/* Generated by tools/catalog/build_catalog.py from the label texts behind the on-pack QR codes – do not edit.\n'
            ' * sku → { n: name, k: kind (supplement|drink|food|beauty|gear), pk: [pack amount, unit], d: [amount, times/day, days/week?], q: QR short codes, b: EAN barcodes,\n'
            ' *   days: days per pack, s: slot, c: line, l: label file in data/labels/, pdf: original leaflet, chk: needs a human check } */\n')
    f.write('window.FS_CATALOG = ' + json.dumps(index, ensure_ascii=False, separators=(',', ':')).replace('},"', '},\n"') + ';\n')
with open(repo + '/docs/qr-audit.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(audit[0].keys())); w.writeheader(); w.writerows(audit)
print('products', len(index), 'labels', sum(1 for e in index.values() if 'l' in e), 'with days', sum(1 for e in index.values() if 'days' in e),
      'needs check', sum(1 for e in index.values() if 'chk' in e))
print('kinds', {k: sum(1 for e in index.values() if e['k'] == k) for k in ('supplement', 'drink', 'food', 'beauty', 'gear')})
print('usage coverage per language', {l: '%d/%d' % tuple(v) for l, v in sorted(langcov.items())})
