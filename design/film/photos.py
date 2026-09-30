"""Photos de sport fictives, dessinées en code (aucune vraie personne, aucune vraie photo).
Sorties : assets/photo-salle-fictive.jpg et assets/photo-piste-fictive.jpg (900 × 900)."""
import numpy as np, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
S = 1800  # rendu à 2×, réduit à la fin
rng = np.random.default_rng(3)
yy, xx = np.mgrid[0:S, 0:S] / S


def rgba(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def radial(cx, cy, r, col, amp):
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    g = np.exp(-d ** 2) * amp
    return g[..., None] * np.array(col, float)


def grain(img, amt=7):
    a = np.array(img).astype(float)
    a[..., :3] += rng.normal(0, amt, a[..., :3].shape)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), img.mode)


def vignette(img, k=.55):
    a = np.array(img).astype(float)
    d = np.sqrt((xx - .5) ** 2 + (yy - .5) ** 2)
    a[..., :3] *= (1 - k * np.clip(d / .72, 0, 1) ** 2)[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), img.mode)


def bokeh(draw_img, n, area, cols, rmin, rmax, amin, amax, blur):
    lay = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(n):
        x = rng.uniform(*area[0]) * S
        y = rng.uniform(*area[1]) * S
        r = rng.uniform(rmin, rmax) * S
        c = cols[rng.integers(len(cols))]
        a = int(rng.uniform(amin, amax) * 255)
        d.ellipse((x - r, y - r, x + r, y + r), fill=c + (a,))
        d.ellipse((x - r * .82, y - r * .82, x + r * .82, y + r * .82), fill=c + (int(a * .7),))
    return Image.alpha_composite(draw_img, lay.filter(ImageFilter.GaussianBlur(blur)))


# ======================= 1. Salle : barre olympique chargée =======================
base = np.zeros((S, S, 4))
top, bot = np.array([34, 30, 27]), np.array([9, 9, 10])
base[..., :3] = top * (1 - yy[..., None]) + bot * yy[..., None]
base[..., :3] += radial(.18, .12, .45, (255, 170, 95), .32)
base[..., :3] += radial(.92, .35, .35, (120, 150, 210), .14)
base[..., 3] = 255
img = rgba(base)
img = bokeh(img, 34, ((0, 1), (0, .5)), [(255, 196, 130), (255, 225, 180), (200, 215, 255)], .012, .05, .08, .3, 10)
# racks en arrière-plan (flous)
bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(bg)
for x in (.08, .3, .86):
    d.rectangle((x * S, .08 * S, (x + .025) * S, .66 * S), fill=(22, 22, 24, 255))
    for y in np.arange(.12, .6, .045):
        d.rectangle((x * S - 6, y * S, (x + .025) * S + 6, y * S + 8), fill=(40, 40, 44, 255))
d.rectangle((.08 * S, .2 * S, .33 * S, .225 * S), fill=(30, 30, 33, 255))
img = Image.alpha_composite(img, bg.filter(ImageFilter.GaussianBlur(14)))
# sol en caoutchouc
fl = np.zeros((S, S, 4))
m = np.clip((yy - .6) / .06, 0, 1)
fl[..., :3] = 14 + rng.normal(0, 3, (S, S))[..., None]
fl[..., 3] = m * 255
img = Image.alpha_composite(img, rgba(fl))
fg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(fg)
# ombre portée
sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(sh).ellipse((.2 * S, .74 * S, 1.05 * S, .86 * S), fill=(0, 0, 0, 200))
img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(40)))
# barre chromée
by = .58
for i in range(26):
    t = i / 25
    c = int(70 + 170 * np.exp(-((t - .28) / .16) ** 2) + 30 * (1 - t))
    d.line((0, (by - .013 + t * .026) * S, .74 * S, (by - .013 + t * .026) * S), fill=(c, c, min(255, c + 8), 255), width=2)
# moletage
for x in np.arange(.05, .45, .006):
    d.line((x * S, (by - .012) * S, (x + .003) * S, (by + .012) * S), fill=(95, 95, 100, 120), width=1)
# manchon et collier
d.rectangle((.5 * S, (by - .022) * S, .6 * S, (by + .022) * S), fill=(150, 150, 158, 255))
d.rectangle((.5 * S, (by - .022) * S, .6 * S, (by - .012) * S), fill=(215, 215, 222, 255))
d.rectangle((.585 * S, (by - .04) * S, .61 * S, (by + .04) * S), fill=(60, 60, 64, 255))
# disques (vus de biais) : du plus loin au plus proche
def plate(cx, cy, rx, ry, col, rim):
    d.ellipse(((cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S), fill=col + (255,))
    for k, a in ((.92, 18), (.78, 10), (.62, 16)):
        c2 = tuple(min(255, v + a) for v in col)
        d.ellipse(((cx - rx * k) * S, (cy - ry * k) * S, (cx + rx * k) * S, (cy + ry * k) * S), outline=c2 + (255,), width=5)
    d.arc(((cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S), 110, 250, fill=rim + (255,), width=10)
    d.ellipse(((cx - rx * .18) * S, (cy - ry * .18) * S, (cx + rx * .18) * S, (cy + ry * .18) * S), fill=(175, 175, 182, 255))
    d.ellipse(((cx - rx * .1) * S, (cy - ry * .1) * S, (cx + rx * .1) * S, (cy + ry * .1) * S), fill=(40, 40, 44, 255))
plate(.83, by, .085, .34, (22, 22, 24), (120, 96, 70))
plate(.76, by, .09, .36, (26, 26, 28), (170, 130, 90))
plate(.69, by, .1, .39, (30, 30, 33), (225, 175, 120))
img = Image.alpha_composite(img, fg)
# poussière de magnésie dans la lumière
dust = Image.new('RGBA', (S, S), (0, 0, 0, 0))
dd = ImageDraw.Draw(dust)
for _ in range(260):
    x, y = rng.uniform(.3, .75) * S, rng.uniform(.25, .7) * S
    r = rng.uniform(1, 3.2)
    dd.ellipse((x - r, y - r, x + r, y + r), fill=(255, 235, 210, int(rng.uniform(40, 150))))
img = Image.alpha_composite(img, dust.filter(ImageFilter.GaussianBlur(1.2)))
img = vignette(img, .6)
img = img.resize((900, 900), Image.LANCZOS)
img = grain(img, 5).convert('RGB')
img.save(os.path.join(ROOT, 'assets', 'photo-salle-fictive.jpg'), quality=92)

# ======================= 2. Piste d'athlétisme au crépuscule =======================
base = np.zeros((S, S, 4))
hz = .4
sky_top, sky_h = np.array([10, 16, 34]), np.array([150, 86, 70])
t = np.clip(yy / hz, 0, 1)[..., None]
base[..., :3] = sky_top * (1 - t ** 1.6) + sky_h * t ** 1.6
base[..., :3] += radial(.62, hz, .35, (255, 150, 90), .35)
base[..., 3] = 255
img = rgba(base)
# tribunes et projecteurs
st = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(st)
d.polygon([(0, hz * S), (0, (hz - .07) * S), (.55 * S, (hz - .03) * S), (1 * S, (hz - .08) * S), (S, hz * S)], fill=(18, 18, 26, 255))
img = Image.alpha_composite(img, st.filter(ImageFilter.GaussianBlur(6)))
img = bokeh(img, 18, ((.0, 1), (hz - .16, hz - .06)), [(255, 248, 230), (255, 214, 160)], .008, .02, .5, .9, 7)
img = bokeh(img, 10, ((.1, .95), (hz - .2, hz - .12)), [(255, 255, 245)], .02, .045, .2, .45, 18)
# piste
tr = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(tr)
vx, vy = .64 * S, (hz - .02) * S
d.polygon([(-.4 * S, S), (1.5 * S, S), (vx + .06 * S, hz * S), (vx - .1 * S, hz * S)], fill=(128, 52, 38, 255))
# bande de gazon à gauche
d.polygon([(-.4 * S, hz * S + 2), (vx - .1 * S, hz * S), (-.9 * S, S)], fill=(22, 40, 26, 255))
arr = np.array(tr).astype(float)
shade = np.clip((yy - hz) / (1 - hz), 0, 1)
arr[..., :3] *= (.45 + .55 * shade)[..., None]
arr[..., :3] += rng.normal(0, 6, arr[..., :3].shape) * (arr[..., 3:4] > 0)
tr = rgba(arr)
d = ImageDraw.Draw(tr)
for bx in np.linspace(-.35, 1.45, 9):
    d.line((bx * S, S, vx + (bx - .55) * .07 * S, vy + .02 * S), fill=(235, 228, 220, 235), width=int(10))
# ligne de départ
d.polygon([(-.1 * S, .83 * S), (1.2 * S, .78 * S), (1.2 * S, .8 * S), (-.1 * S, .85 * S)], fill=(240, 236, 230, 230))
img = Image.alpha_composite(img, tr)
# flou de profondeur : le lointain flou, le premier plan net
far = img.filter(ImageFilter.GaussianBlur(6))
mask = Image.fromarray((np.clip((.62 - yy) / .22, 0, 1) * 255).astype(np.uint8))
img = Image.composite(far, img, mask)
img = vignette(img, .5)
img = img.resize((900, 900), Image.LANCZOS)
img = grain(img, 5).convert('RGB')
img.save(os.path.join(ROOT, 'assets', 'photo-piste-fictive.jpg'), quality=92)
print('photos ok')
