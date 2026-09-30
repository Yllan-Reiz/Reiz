"""Sound design provisoire du film Reiz, synthétisé en numpy (48 kHz, stéréo).

Même grille que l'image : 96 BPM, un temps = 0,625 s, 18 mesures, 45 s.
Les instants des sons d'interface reprennent ceux de film.html.
Sortie : out/audio.wav
"""
import numpy as np, wave, os

SR = 48000
DUR = 45.0
N = int(SR * DUR)
BEAT = 0.625
rng = np.random.default_rng(7)
ROOT = os.path.dirname(os.path.abspath(__file__))

music = np.zeros((2, N))
sfx = np.zeros((2, N))
send = np.zeros((2, N))   # départ vers la réverbération


def tt(d):
    return np.arange(int(d * SR)) / SR


def put(buf, t0, sig, gain=1.0, pan=0.0, rev=0.0):
    """Ajoute un signal mono (ou stéréo) à l'instant t0, avec panoramique et envoi réverbe."""
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if sig.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        st = np.vstack([sig * l, sig * r]) * np.sqrt(2)
    else:
        st = sig
    j0 = max(0, -i0)
    st = st[:, j0:]
    i0 = max(0, i0)
    n = min(st.shape[1], N - i0)
    buf[:, i0:i0 + n] += gain * st[:, :n]
    if rev:
        send[:, i0:i0 + n] += gain * rev * st[:, :n]


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def noise(d):
    return rng.standard_normal(int(d * SR))


def env_exp(d, tau, attack=0.003):
    t = tt(d)
    e = np.exp(-t / tau)
    a = np.clip(t / attack, 0, 1) if attack > 0 else 1
    return e * a


def fade(sig, fi=0.005, fo=0.02):
    n = len(sig)
    a = np.ones(n)
    k = int(fi * SR)
    if k:
        a[:k] = np.linspace(0, 1, k)
    k = int(fo * SR)
    if k:
        a[-k:] *= np.linspace(1, 0, k)
    return sig * a


# ---------- instruments ----------
def bell(f, d=2.2, bright=1.0):
    """Cloche cristalline : partiels inharmoniques qui s'éteignent à des vitesses différentes."""
    t = tt(d)
    parts = [(1, 1.0, 1.0), (2.0, .35, .6), (2.76, .5 * bright, .45), (5.4, .25 * bright, .25), (8.93, .12 * bright, .14)]
    s = np.zeros_like(t)
    for ratio, amp, dec in parts:
        s += amp * np.sin(2 * np.pi * f * ratio * t + rng.random() * 6) * np.exp(-t / (d * dec * .45))
    return fade(s * np.clip(t / .002, 0, 1), .001, .05) * .5


def blip(f0, f1, d=.07):
    t = tt(d)
    f = np.linspace(f0, f1, len(t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return fade(np.sin(ph) * np.exp(-t / (d * .35)), .001, .01)


def tick(f=2600, d=.035):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / .006) + .4 * fft_filter(noise(d), 2000, 9000) * np.exp(-t / .003)
    return fade(s, .0005, .005) * .6


def thump(f0=110, f1=42, d=.45, tau=.12):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t / .05)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return fade(np.sin(ph) * np.exp(-t / tau), .001, .03)


def kick():
    s = thump(120, 44, .42, .14)
    click = fft_filter(noise(.012), 800, 4000) * env_exp(.012, .003) * .25
    s[:len(click)] += click
    return s


def hat(d=.05):
    return fft_filter(noise(d), 7000, None) * env_exp(d, .012) * .5


def whoosh(d, lo=(200, 900), hi=(1500, 6000), peak=.6, gain=1.0):
    """Souffle filtré qui monte puis retombe (deux bandes croisées pour simuler le balayage)."""
    n = noise(d)
    a = fft_filter(n, *lo)
    b = fft_filter(n, *hi)
    t = tt(d) / d
    env = np.where(t < peak, (t / peak) ** 2, np.exp(-(t - peak) / (1 - peak) * 3.5))
    mix = np.clip(t / peak, 0, 1)
    return fade((a * (1 - mix) + b * mix) * env, .01, .05) * gain * .35


def impact(d=2.5, f0=70, f1=30):
    s = thump(f0, f1, d, .55) * 1.2
    body = fft_filter(noise(d), 60, 900) * env_exp(d, .18) * .35
    return fade(s + body, .002, .3)


def saw(f, d, nh=8, detune=0.0):
    t = tt(d)
    s = np.zeros_like(t)
    for h in range(1, nh + 1):
        s += np.sin(2 * np.pi * f * (1 + detune) * h * t) / h
    return s


def pluck(f, d=.22):
    t = tt(d)
    s = saw(f, d, 7) * np.exp(-t / .07)
    return fade(s, .002, .02) * .35


def pad_note(f, d, att=1.2, rel=1.5):
    t = tt(d)
    s = saw(f, d, 5, -.0025) + saw(f, d, 5, .0025)
    e = np.clip(t / att, 0, 1) * np.clip((d - t) / rel, 0, 1)
    return s * e * .12


A = {'A1': 55.0, 'E2': 82.41, 'A2': 110.0, 'C3': 130.81, 'E3': 164.81, 'G3': 196.0, 'A3': 220.0, 'B3': 246.94,
     'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F3': 174.61, 'F2': 87.31, 'G2': 98.0, 'C2': 65.41,
     'A4': 440.0, 'C5': 523.25, 'D5': 587.33, 'E5': 659.26, 'G5': 783.99, 'A5': 880.0, 'C#6': 1108.73,
     'E6': 1318.51, 'B6': 1975.53, 'C6': 1046.5, 'G6': 1567.98, 'A6': 1760.0}

# ======================= MUSIQUE =======================
# nappe grave (0,5 → 45 s), montée lente
t = np.arange(N) / SR
lvl = np.interp(t, [0, .5, 4, 20, 28, 36, 40, 44, 45], [0, 0, .55, .7, .85, 1, .8, .7, 0])
for f, g in [(A['A1'], 1.0), (A['A2'], .28), (A['E2'], .16)]:
    music[0] += g * np.sin(2 * np.pi * (f - .15) * t) * lvl * .22
    music[1] += g * np.sin(2 * np.pi * (f + .15) * t) * lvl * .22
air = fft_filter(rng.standard_normal(N), 1800, 6500) * .012
music[0] += air * lvl
music[1] += np.roll(air, 4000) * lvl

# pulse grave sur chaque temps (5 → 40 s)
for k in range(int(5 / BEAT), int(40 / BEAT)):
    b = k * BEAT
    if 28.2 <= b < 28.75:
        continue
    g = np.interp(b, [5, 10, 28, 40], [.35, .5, .7, .6])
    put(music, b, thump(70, 40, .35, .09), g * .55)
# kick feutré (10 → 40 s, sauf le silence)
for k in range(int(10 / BEAT), int(40 / BEAT)):
    b = k * BEAT
    if 28.2 <= b < 28.75:
        continue
    g = np.interp(b, [10, 20, 30, 38, 40], [.55, .72, .85, .85, .5])
    put(music, b, kick(), g * .55, rev=.04)
# textures rythmiques : croches à contretemps (18,75 → 37,5 s), doubles-croches légères après 25 s
for k in range(int(18.75 / BEAT), int(37.5 / BEAT)):
    b = k * BEAT
    if 28.1 <= b < 28.75:
        continue
    put(music, b + BEAT / 2, hat(), .16, pan=.25)
    if b >= 25:
        put(music, b + BEAT / 4, hat(.03), .07, pan=-.3)
        put(music, b + 3 * BEAT / 4, hat(.03), .07, pan=.3)
# basse arpégée en doubles-croches (22,5 → 37,5 s)
chords = [['A2', 'E3', 'A3', 'C4'], ['A2', 'E3', 'A3', 'C4'], ['F2', 'C3', 'F3', 'A3'], ['G2', 'D4', 'G3', 'B3']]
A['D4'] = 293.66
step = BEAT / 4
k = 0
x = 22.5
while x < 37.5 - 1e-6:
    if not (28.1 <= x < 28.75):
        bar = int((x - 22.5) / 2.5) % 4
        notes = chords[bar]
        f = A[notes[k % 4]]
        g = np.interp(x, [22.5, 28, 35, 37.5], [.42, .52, .55, .3])
        put(music, x, pluck(f), g, pan=(.2 if k % 2 else -.2), rev=.12)
    k += 1
    x += step
# nappe de cordes (28,75 → 43 s)
for f in ['A2', 'E3', 'G3', 'B3', 'C4']:
    put(music, 28.75, pad_note(A[f], 6.9, 1.4, 1.2), .38, pan=rng.uniform(-.4, .4), rev=.3)
for f in ['C3', 'G3', 'D4', 'E4']:
    put(music, 35.6, pad_note(A[f], 5.2, .8, 2.2), .45, pan=rng.uniform(-.4, .4), rev=.3)
for f in ['A2', 'E3', 'G3', 'B3', 'C4']:
    put(music, 41.6, pad_note(A[f], 3.4, 1.0, 2.6), .32, pan=rng.uniform(-.4, .4), rev=.35)
# montée avant les badges (26,75 → 28,25 s)
d = 1.5
r = whoosh(d, (300, 1200), (2500, 9000), peak=.98, gain=1.4)
tr = tt(d)
glide = np.sin(2 * np.pi * np.cumsum(np.linspace(220, 880, len(tr))) / SR) * (tr / d) ** 2 * .08
put(music, 26.75, fade(r + glide, .01, .004), 1.0, rev=.2)

# ======================= SONS =======================
# ouverture
tr = tt(1.2)
put(sfx, .85, fade(np.sin(2 * np.pi * np.cumsum(np.linspace(1800, 2700, len(tr))) / SR) * (1 - tr / 1.2) ** 2 * .05, .2, .2), 1, rev=.5)
put(sfx, 1.9, whoosh(1.3, (400, 1500), (2000, 7000), .55, .7), 1, pan=-.2, rev=.3)
put(sfx, 3.0, bell(A['A6'], 3.0), .55, rev=.6)
for b in (3.125, 3.75, 4.375):
    put(sfx, b, impact(1.0, 80, 38), .45, rev=.25)
put(sfx, 4.45, whoosh(.9, (150, 700), (900, 4000), .9, 1.2), 1, rev=.35)
put(sfx, 5.0, impact(2.2, 60, 28), .55, rev=.4)
# titres du plan 2 et compteurs
for b, f in ((5.625, 2349.3), (6.5625, 2637.0), (7.5, 3136.0)):
    put(sfx, b, bell(f, .9, .6), .18, rev=.4)
for k in range(10):
    put(sfx, 5.75 + k * .11, tick(2400 + k * 60), .12, pan=.3)
put(sfx, 8.1, whoosh(1.2, (200, 800), (1200, 5000), .5, .8), 1, pan=.3, rev=.2)
# reflets sur les barres
for i, f in enumerate((A['E6'], A['A6'], 2093.0)):
    put(sfx, 9.5 + i * .16, bell(f, .8, .8), .12, pan=.4, rev=.5)
put(sfx, 10.9, whoosh(1.1, (150, 600), (800, 3000), .6, .6), 1, rev=.2)
put(sfx, 12.95, tick(1200, .05), .5)
put(sfx, 12.95, thump(160, 80, .15, .03), .25)
put(sfx, 13.15, whoosh(.8, (400, 1500), (2500, 9000), .75, .9), 1, rev=.3)
# poster
put(sfx, 14.75, blip(1400, 2000, .06), .22, pan=.2, rev=.2)
put(sfx, 15.05, whoosh(.7, (300, 1200), (1200, 4000), .4, .35), 1)
put(sfx, 15.85, tick(1500, .04), .35)
put(sfx, 16.0, bell(A['C6'], .9, .7), .2, rev=.35)
txt_n = 25
for k in range(txt_n):
    tk = 16.3 + k * (0.85 / txt_n) + rng.uniform(-.008, .008)
    put(sfx, tk, fft_filter(noise(.012), 1500, 6000) * env_exp(.012, .003) * .5, .22, pan=rng.uniform(-.1, .1))
put(sfx, 17.35, tick(1100, .05), .45)
put(sfx, 17.55, bell(A['E6'], 1.2, .7), .22, rev=.4)
put(sfx, 17.7, bell(A['A6'], 1.4, .7), .2, rev=.45)
# envol de la carte
put(sfx, 17.95, whoosh(1.2, (200, 900), (1500, 6000), .45, 1.0), 1, pan=-.2, rev=.3)
tr = tt(1.0)
put(sfx, 18.1, fade(np.sin(2 * np.pi * np.cumsum(np.linspace(3200, 2200, len(tr))) / SR) * np.exp(-tr / .35) * .05, .05, .2), 1, rev=.6)
# réactions
for b in (19.45, 19.75, 20.05, 20.25, 20.5, 20.6, 20.85):
    put(sfx, b, blip(700, 1500, .07), .22, pan=rng.uniform(-.3, .5), rev=.2)
for b in (20.8, 21.3):
    put(sfx, b, tick(2000, .03), .2)
# notifications (son maison)
put(sfx, 21.0, bell(A['A5'], 1.4, .8), .3, rev=.35)
put(sfx, 21.1, bell(A['E6'], 1.6, .8), .26, rev=.4)
put(sfx, 21.95, blip(900, 1300, .05), .2)
put(sfx, 22.3, whoosh(.5, (400, 1500), (1500, 5000), .3, .4), 1)
put(sfx, 22.55, bell(A['C6'], 1.4, .8), .28, rev=.35)
put(sfx, 22.65, bell(A['G6'], 1.6, .8), .24, rev=.4)
# duo : tierce cristalline
put(sfx, 23.3, bell(A['A5'], 1.8, .7), .28, pan=-.3, rev=.45)
put(sfx, 23.3, bell(A['C6'], 1.8, .7), .24, pan=.3, rev=.45)
put(sfx, 23.15, whoosh(1.0, (150, 600), (800, 3000), .6, .6), 1, rev=.2)
put(sfx, 24.2, tick(1200, .05), .45)
# la ligne
tr = tt(.8)
put(sfx, 24.5, fade(np.sin(2 * np.pi * np.cumsum(np.linspace(400, 1400, len(tr))) / SR) * np.sin(np.pi * tr / .8) * .08, .05, .1), 1, rev=.4)
put(sfx, 24.5, whoosh(.8, (500, 2000), (2500, 9000), .6, .6), 1)
# cases qui s'allument (même loi que l'image)
ACT = 18
for k in range(ACT):
    at = 25.25 + 2.1 * (k / (ACT - 1)) ** .62
    put(sfx, at, tick(2200 + k * 70, .03), .16 + .01 * k, pan=np.interp(k, [0, ACT - 1], [-.4, .4]))
put(sfx, 26.0, blip(500, 800, .09), .25, rev=.3)
# silence 28,25 → 28,75 puis impact
put(sfx, 28.75, impact(3.0, 65, 26), .95, rev=.5)
put(sfx, 28.75, fft_filter(noise(1.5), 2000, 9000) * env_exp(1.5, .25) * .15, 1, rev=.6)
# faisceau : verres frottés
d = 1.3
tr = tt(d)
rub = fft_filter(noise(d), 2500, 7000) * (np.sin(2 * np.pi * 9 * tr) * .5 + .5) * np.sin(np.pi * tr / d) * .25
rub += sum(np.sin(2 * np.pi * f * tr) * .03 for f in (2637, 3136, 3951)) * np.sin(np.pi * tr / d)
put(sfx, 29.3, fade(rub, .05, .1), 1, pan=0, rev=.6)
put(sfx, 30.75, whoosh(.8, (200, 800), (1000, 4000), .5, .6), 1, rev=.25)
# montée de niveau : six notes, une couche de plus à chaque fois
LT = [31.25, 32.5, 33.75, 34.375, 35.0, 35.625]
notes = [A['A4'], A['C5'], A['D5'], A['E5'], A['G5'], A['A5']]
for i, (b, f) in enumerate(zip(LT, notes)):
    if i > 0:
        put(sfx, b - .26, whoosh(.5, (400, 1500), (2000, 7000), .5, .35 + .05 * i), 1, rev=.2)
    dd = 2.4 + .3 * i
    s = bell(f, dd, .7 + .1 * i)
    if i >= 2:
        s = s + .5 * bell(f * 2, dd, .6)
    if i >= 4:
        s = s + .35 * bell(f * 1.5, dd, .6)
    put(sfx, b, s, .32 + .03 * i, pan=(-.15 if i % 2 else .15), rev=.55)
# niveau 6 : accord complet (tierce majeure) et impact
for f in (A['A5'], A['C#6'], A['E6'], A['B6']):
    put(sfx, 35.625, bell(f, 4.0, .8), .2, pan=rng.uniform(-.5, .5), rev=.7)
put(sfx, 35.625, impact(3.5, 55, 24), .7, rev=.5)
d = 1.0
tr = tt(d)
put(sfx, 36.05, fade(fft_filter(noise(d), 4000, 12000) * np.sin(np.pi * tr / d) * .12, .05, .1), 1, rev=.5)
# vers le profil
put(sfx, 37.05, whoosh(.75, (300, 1200), (900, 3500), .5, .8), 1, pan=-.2, rev=.25)
put(sfx, 37.72, tick(1600, .05), .5)
put(sfx, 37.72, bell(A['E6'], .9, .6), .15, rev=.4)
for k in range(8):
    put(sfx, 37.85 + k * .1, tick(2300 + k * 50, .03), .1, pan=.3)
put(sfx, 38.6, blip(900, 1500, .06), .22, rev=.2)
# fin
put(sfx, 39.85, whoosh(1.2, (150, 700), (800, 3500), .55, .9), 1, rev=.3)
put(sfx, 40.9, whoosh(.9, (100, 500), (500, 2000), .8, .8), 1, rev=.4)
tr = tt(.9)
put(sfx, 41.05, fade(np.sin(2 * np.pi * np.cumsum(np.linspace(1800, 2700, len(tr))) / SR) * (1 - tr / .9) ** 2 * .05, .1, .2), 1, rev=.5)
put(sfx, 41.625, impact(3.3, 60, 25), .8, rev=.55)
put(sfx, 42.9, bell(A['A6'], 3.5), .5, rev=.7)
put(sfx, 44.7, bell(A['A6'], 2.0, .6), .18, rev=.7)

# ======================= RÉVERBÉRATION =======================
def ir(d=2.9, seed=1):
    r = np.random.default_rng(seed)
    t = tt(d)
    n = r.standard_normal(len(t)) * np.exp(-t / .55)
    n = fft_filter(n, 120, 7000)
    er = np.zeros_like(t)
    for k in range(8):
        er[int(r.uniform(.008, .07) * SR)] += r.uniform(.3, .7)
    return (n * .9 + er) / np.sqrt(np.sum(n ** 2) + 1e-9)


def conv(x, h):
    L = len(x) + len(h) - 1
    nfft = 1 << (L - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:len(x)]


wet = np.vstack([conv(send[0], ir(seed=1)), conv(send[1], ir(seed=2))]) * 1.1

# ======================= MIXAGE =======================
mix = music * .9 + sfx * 1.0 + wet
# silences : 28,25 → 28,75 et 41,0 → 41,625 (la traîne de réverbe s'éteint vite)
duck = np.ones(N)
for a, b in ((28.25, 28.75), (41.0, 41.625)):
    ia, ib = int(a * SR), int(b * SR)
    k = int(.06 * SR)
    duck[ia - k:ia] = np.minimum(duck[ia - k:ia], np.linspace(1, .04, k))
    duck[ia:ib] = .04
duck_s = np.convolve(duck, np.ones(240) / 240, mode='same')
mix = mix * duck_s
# fondu final
fo = int(.35 * SR)
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2
# bus maître : compression douce et limiteur
peak = np.max(np.abs(mix))
mix = mix / peak * 1.6
mix = np.tanh(mix) / np.tanh(1.6)
mix *= 10 ** (-1.0 / 20)
rms = np.sqrt(np.mean(mix ** 2))
print('crête -1 dBFS, RMS %.1f dBFS' % (20 * np.log10(rms)))

os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(os.path.join(ROOT, 'out', 'audio.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('audio ok')
