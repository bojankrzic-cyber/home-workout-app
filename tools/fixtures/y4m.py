"""PNG → one-frame Y4M for Chromium's fake camera (--use-file-for-fake-video-capture).
usage: python3 tools/fixtures/y4m.py <in.png> <out.y4m>"""
import sys
from PIL import Image
W, H = 640, 480
src = Image.open(sys.argv[1]).convert('L')
s = min(W, H) * 0.8 / max(src.size)
src = src.resize((int(src.size[0] * s), int(src.size[1] * s)), Image.NEAREST)
img = Image.new('L', (W, H), 235); img.paste(src, ((W - src.size[0]) // 2, (H - src.size[1]) // 2))
with open(sys.argv[2], 'wb') as f:
    f.write(b'YUV4MPEG2 W%d H%d F30:1 Ip A1:1 C420jpeg\n' % (W, H))
    for _ in range(2):
        f.write(b'FRAME\n'); f.write(img.tobytes()); f.write(bytes([128]) * (W // 2 * H // 2 * 2))
