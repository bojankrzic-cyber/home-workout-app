"""Render an EAN-13 barcode (with quiet zones) as PNG – test fixture for the scanner.
usage: python3 tools/fixtures/ean13.py <13 digits> <out.png>"""
import sys
from PIL import Image, ImageDraw
L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
d = sys.argv[1]
bits = '101' + ''.join((L if P[int(d[0])][i] == 'L' else G)[int(c)] for i, c in enumerate(d[1:7])) + '01010' + ''.join(R[int(c)] for c in d[7:]) + '101'
m, q = 4, 12
img = Image.new('L', ((len(bits) + 2 * q) * m, 70 * m), 255); dr = ImageDraw.Draw(img)
for i, b in enumerate(bits):
    if b == '1': dr.rectangle([(q + i) * m, 4 * m, (q + i + 1) * m - 1, 62 * m], fill=0)
img.save(sys.argv[2])
