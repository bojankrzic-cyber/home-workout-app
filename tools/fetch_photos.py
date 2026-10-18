"""Download generated photos, compress to web JPGs and build a review sheet.
usage: python3 tools/fetch_photos.py list.txt sheet.jpg   (list lines: "<dest> <url>", dest like ex/kb_swing or hero/home)
"""
import sys, io, urllib.request
from PIL import Image, ImageDraw

def main(lst, sheet):
    rows = [l.split(None, 1) for l in open(lst) if l.strip()]
    thumbs = []
    for dest, url in rows:
        data = urllib.request.urlopen(urllib.request.Request(url.strip(), headers={'User-Agent': 'Mozilla/5.0'}), timeout=90).read()
        im = Image.open(io.BytesIO(data)).convert('RGB')
        w = 1600 if dest.startswith('hero/') else 960
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.save('img/%s.jpg' % dest, quality=74 if w == 960 else 72, optimize=True, progressive=True)
        t = im.copy(); t.thumbnail((480, 270)); thumbs.append((dest, t))
    cols = 4
    S = Image.new('RGB', (cols * 480, ((len(thumbs) + cols - 1) // cols) * 290), (20, 20, 20))
    d = ImageDraw.Draw(S)
    for i, (n, t) in enumerate(thumbs):
        x, y = (i % cols) * 480, (i // cols) * 290
        S.paste(t, (x, y + 20)); d.text((x + 6, y + 4), n, fill=(255, 255, 0))
    S.save(sheet, quality=80)

main(sys.argv[1], sys.argv[2])
