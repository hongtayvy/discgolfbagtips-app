"""
Derives the app's logo assets from the official files in brand/source/.

Nothing is redrawn: every output is a crop or a resize of the supplied
artwork. The only pixel change is clearing the cream behind the app icon's
rounded corners, so the favicon is transparent outside the tile.

    python3 -m pip install pillow
    python3 brand/derive-assets.py     # run from the repo root
"""
from PIL import Image, ImageDraw

SRC = 'brand/source/'

# Coordinates measured on the supplied files.
LOGO_BOX = (155, 172, 1864, 498)   # primary-logo.webp: full lockup, transparent margin trimmed
MARK_BOX = (155, 172, 459, 498)    # primary-logo.webp: the monogram alone (50px gap before wordmark)
ICON_BOX = (1223, 189, 1384, 351)  # logo-kit.webp: section 04, app icon tile
HEADER_WIDTH = 840                 # ~4x the ~210px the header shows it at

logo = Image.open(SRC + 'primary-logo.webp').convert('RGBA')
primary = logo.crop(LOGO_BOX)
primary.save('src/assets/brand/logo-primary.webp', lossless=True, method=6)
primary.resize((HEADER_WIDTH, round(primary.height * HEADER_WIDTH / primary.width)), Image.LANCZOS) \
       .save('src/assets/brand/logo-primary-840.webp', lossless=True, method=6)
logo.crop(MARK_BOX).save('src/assets/brand/logo-mark.webp', lossless=True, method=6)

# App icon: flood-fill from the four corners across light pixels. That reaches
# the cream around the rounded tile but never the letters, which the dark tile
# encloses. Anti-aliased rim pixels get partial alpha in the tile colour.
sheet = Image.open(SRC + 'logo-kit.webp').convert('RGB')
tile = sheet.crop(ICON_BOX).convert('RGBA')
w, h = tile.size
bg_lum, tile_rgb = 246, (10, 51, 37)
tile_lum = 0.299 * tile_rgb[0] + 0.587 * tile_rgb[1] + 0.114 * tile_rgb[2]
lum = tile.convert('L')
light = lum.point(lambda v: 255 if v > 200 else 0)
for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    if light.getpixel(seed) == 255:
        ImageDraw.floodfill(light, seed, 128)
outside = light.point(lambda v: 255 if v == 128 else 0)
px, lp, op = tile.load(), lum.load(), outside.load()
for y in range(h):
    for x in range(w):
        if op[x, y]:
            px[x, y] = (*tile_rgb, 0)
            continue
        near = any(0 <= x + dx < w and 0 <= y + dy < h and op[x + dx, y + dy]
                   for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if near and lp[x, y] > tile_lum + 8:
            a = max(0, min(255, round(255 * (bg_lum - lp[x, y]) / (bg_lum - tile_lum))))
            px[x, y] = (*tile_rgb, a)
tile.save('public/favicon.png', optimize=True)
tile.save('public/apple-touch-icon.png', optimize=True)
print('derived: logo-primary, logo-primary-840, logo-mark, favicon, apple-touch-icon')
