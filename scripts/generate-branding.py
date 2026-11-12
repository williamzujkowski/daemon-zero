"""Render the terminal's bracketed zero into deterministic PNG brand assets.
Uses only Python's standard library; there are no fonts or external downloads.
"""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent / 'assets'
INK = (74, 246, 38, 255)
DARK = (3, 7, 4, 255)
# Geometric glyphs occupy the safe central half of an adaptive icon.
GLYPH = (
    '1100011100011',
    '1000100010001',
    '1000100110001',
    '1000101010001',
    '1000110010001',
    '1000100010001',
    '1100011100011',
)


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))


def render(name, size, background, ink=INK, glyph=True):
    rows = []
    cell = size / 26
    left, top = (size - cell * 13) / 2, (size - cell * 7) / 2
    for y in range(size):
        row = bytearray(b'\0')
        for x in range(size):
            gx, gy = int((x - left) // cell), int((y - top) // cell)
            lit = glyph and 0 <= gx < 13 and 0 <= gy < 7 and GLYPH[gy][gx] == '1'
            row.extend(ink if lit else background)
        rows.append(row)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')
    (ROOT / name).write_bytes(png)


if __name__ == '__main__':
    render('icon.png', 1024, DARK)
    render('favicon.png', 64, DARK)
    render('android-icon-foreground.png', 1024, (0, 0, 0, 0))
    render('android-icon-monochrome.png', 1024, (0, 0, 0, 0), (255, 255, 255, 255))
    render('android-icon-background.png', 1024, DARK, glyph=False)
    render('splash-icon.png', 1024, (0, 0, 0, 0))
