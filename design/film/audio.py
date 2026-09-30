"""Sound design provisoire du film Reiz v2, synthétisé en numpy (48 kHz, stéréo, 35 s).

Grille : 120 BPM (un temps = 0,5 s), démarrage du groove à 3,0 s.
Les sons d'interface sont écrits en « temps du récit » (celui de film.html) puis
convertis en temps réel par R(), la même loi que story() dans film.html.
Sortie : out/audio-v2.wav
"""
import numpy as np, wave, os

SR = 48000
DUR = 35.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)
ROOT = os.path.dirname(os.path.abspath(__file__))


def R(s):
    """Temps du récit → temps réel (inverse de story() dans film.html)."""
    return s * 0.6 if s <= 5 else 3.0 + (s - 5) / 1.25


music = np.zeros((2, N))
sfx = np.zeros((2, N))
send = np.zeros((2, N))


def tt(d):
    return np.arange(int(d * SR)) / SR


def put(buf, t0, sig, gain=1.0, pan=0.0, rev=0.0):
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


def S(s, sig, gain=1.0, pan=0.0, rev=0.0):
    """Son d'interface placé en temps du récit."""
    put(sfx, R(s), sig, gain, pan, rev)


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
    return np.exp(-t / tau) * (np.clip(t / attack, 0, 1) if attack > 0 else 1)


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


def bell(f, d=2.2, bright=1.0):
    t = tt(d)
    parts = [(1, 1.0, 1.0), (2.0, .35, .6), (2.76, .5 * bright, .45), (5.4, .25 * bright, .25), (8.93, .12 * bright, .14)]
    s = np.zeros_like(t)
    for ratio, amp, dec in parts:
        s += amp * np.sin(2 * np.pi * f * ratio * t + rng.random() * 6) * np.exp(-t / (d * dec * .45))
    return fade(s * np.clip(t / .002, 0, 1), .001, .05) * .5


def blip(f0, f1, d=.07):
    t = tt(d)
    ph = 2 * np.pi * np.cumsum(np.linspace(f0, f1, len(t))) / SR
    return fade(np.sin(ph) * np.exp(-t / (d * .35)), .001, .01)


def tick(f=2600, d=.035):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / .006) + .4 * fft_filter(noise(d), 2000, 9000) * np.exp(-t / .003)
    return fade(s, .0005, .005) * .6


def thump(f0=110, f1=42, d=.45, tau=.12):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t / .05)
    return fade(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau), .001, .03)


def kick():
    s = thump(135, 46, .38, .13)
    click = fft_filter(noise(.012), 1200, 6000) * env_exp(.012, .003) * .35
    s[:len(click)] += click
    return s


def clap():
    d = .32
    t = tt(d)
    n = fft_filter(noise(d), 900, 6500)
    e = np.zeros_like(t)
    for k, off in enumerate((0, .011, .022)):
        i = int(off * SR)
        e[i:] += np.exp(-(t[i:] - off) / (.008 if k < 2 else .09))
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / .045) * .35
    return fade(n * e * .55 + body, .0005, .03)


def hat(d=.05):
    return fft_filter(noise(d), 7000, None) * env_exp(d, .012) * .5


def whoosh(d, lo=(200, 900), hi=(1500, 6000), peak=.6, gain=1.0):
    n = noise(d)
    a, b = fft_filter(n, *lo), fft_filter(n, *hi)
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


def pluck(f, d=.2):
    t = tt(d)
    return fade(saw(f, d, 7) * np.exp(-t / .06), .002, .02) * .35


def bassnote(f, d=.24):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t) + .12 * np.sin(2 * np.pi * 3 * f * t)
    return fade(s * np.exp(-t / .22), .004, .03) * .5


def pad_note(f, d, att=1.2, rel=1.5):
    t = tt(d)
    s = saw(f, d, 5, -.0025) + saw(f, d, 5, .0025)
    return s * np.clip(t / att, 0, 1) * np.clip((d - t) / rel, 0, 1) * .12


A = {'A1': 55.0, 'E2': 82.41, 'F2': 87.31, 'G2': 98.0, 'C2': 65.41, 'A2': 110.0, 'C3': 130.81, 'E3': 164.81, 'F3': 174.61,
     'G3': 196.0, 'A3': 220.0, 'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'A4': 440.0, 'C5': 523.25,
     'D5': 587.33, 'E5': 659.26, 'G5': 783.99, 'A5': 880.0, 'C#6': 1108.73, 'E6': 1318.51, 'B6': 1975.53,
     'C6': 1046.5, 'G6': 1567.98, 'A6': 1760.0}
SIL = [(21.6, 22.0), (31.8, 32.3)]          # silences en temps réel


def in_sil(x, pad=0.0):
    return any(a - pad <= x < b for a, b in SIL)


# ======================= MUSIQUE (temps réel) =======================
t = np.arange(N) / SR
lvl = np.interp(t, [0, .3, 3, 14, 21.6, 27.5, 31, 34, 35], [0, .45, .6, .75, .9, 1, .8, .6, 0])
for f, g in [(A['A1'], 1.0), (A['A2'], .28), (A['E2'], .16)]:
    music[0] += g * np.sin(2 * np.pi * (f - .15) * t) * lvl * .2
    music[1] += g * np.sin(2 * np.pi * (f + .15) * t) * lvl * .2
air = fft_filter(rng.standard_normal(N), 1800, 6500) * .012
music[0] += air * lvl
music[1] += np.roll(air, 4000) * lvl

# montée d'ouverture (1,6 → 3,0 s) : le groove démarre juste après « goals »
d = 1.4
r = whoosh(d, (300, 1200), (2500, 9000), peak=.97, gain=1.2)
tr = tt(d)
r += np.sin(2 * np.pi * np.cumsum(np.linspace(180, 720, len(tr))) / SR) * (tr / d) ** 2 * .06
put(music, 1.6, fade(r, .01, .004), 1.0, rev=.2)

beats = np.arange(3.0, 31.0 - 1e-6, BEAT)
for k, b in enumerate(beats):
    if in_sil(b, .01):
        continue
    g = np.interp(b, [3, 6, 14, 22, 29, 31], [.55, .7, .8, .95, .9, .6])
    put(music, b, kick(), g * .62, rev=.03)
    if b >= 6.0 and k % 2 == 1:                       # claps sur 2 et 4
        put(music, b, clap(), g * .32, rev=.12)
    put(music, b + BEAT / 2, hat(), .15 * g, pan=.25)  # charleston à contretemps
    if b >= 14.0:
        put(music, b + BEAT / 4, hat(.03), .07, pan=-.3)
        put(music, b + 3 * BEAT / 4, hat(.03), .07, pan=.3)

# accords (une mesure = 2 s) : la mineur, fa, do, sol
prog = [('A1', ['A2', 'E3', 'A3', 'C4']), ('F2', ['F2', 'C3', 'F3', 'A3']), ('C2', ['C3', 'G3', 'C4', 'E4']), ('G2', ['G2', 'D4', 'G3', 'B3'])]
x = 3.0
while x < 31.0 - 1e-6:                               # basse en croches, effet de pompe
    if not in_sil(x, .01):
        root = prog[int((x - 3.0) / 2.0) % 4][0]
        f = A[root] * (2 if (x - 3.0) % 1.0 >= .5 and root in ('A1', 'C2') else 1)
        on_beat = abs(((x - 3.0) / BEAT) % 1) < 1e-6
        put(music, x + .02, bassnote(f), (.62 if on_beat else .8) * np.interp(x, [3, 6, 14, 22, 31], [.5, .7, .85, 1, .8]))
    x += BEAT / 2
k = 0
x = 10.0
while x < 29.0 - 1e-6:                               # arpège en doubles-croches
    if not in_sil(x, .01):
        notes = prog[int((x - 3.0) / 2.0) % 4][1]
        put(music, x, pluck(A[notes[k % 4]]), np.interp(x, [10, 20, 27, 29], [.3, .42, .5, .3]), pan=(.2 if k % 2 else -.2), rev=.12)
    k += 1
    x += BEAT / 4
for f in ['A2', 'E3', 'G3', 'B3', 'C4']:
    put(music, 22.0, pad_note(A[f], 5.6, .8, 1.0), .34, pan=rng.uniform(-.4, .4), rev=.3)
for f in ['C3', 'G3', 'D4', 'E4']:
    put(music, 27.5, pad_note(A[f], 4.2, .5, 1.8), .4, pan=rng.uniform(-.4, .4), rev=.3)
for f in ['A2', 'E3', 'G3', 'B3', 'C4']:
    put(music, 32.3, pad_note(A[f], 2.7, .6, 2.0), .3, pan=rng.uniform(-.4, .4), rev=.35)
d = 1.2                                             # montée avant les badges
r = whoosh(d, (300, 1200), (2500, 9000), peak=.98, gain=1.5)
tr = tt(d)
r += np.sin(2 * np.pi * np.cumsum(np.linspace(220, 880, len(tr))) / SR) * (tr / d) ** 2 * .08
put(music, 20.4, fade(r, .01, .004), 1.0, rev=.2)
for k in range(8):
    put(music, 20.6 + k * (1.0 / 8), clap(), .1 + .03 * k, rev=.1)

# ======================= SONS D'INTERFACE (temps du récit) =======================
tr = tt(.8)
S(.6, fade(np.sin(2 * np.pi * np.cumsum(np.linspace(1800, 2700, len(tr))) / SR) * (1 - tr / .8) ** 2 * .05, .1, .15), 1, rev=.5)
S(1.6, whoosh(.9, (400, 1500), (2000, 7000), .55, .6), 1, pan=-.2, rev=.3)
S(2.8, bell(A['A6'], 2.4), .45, rev=.6)
for s0 in (2.75, 3.0, 3.25, 3.5):
    S(s0, bell(3136.0, .5, .5), .07, rev=.4)
S(4.5, whoosh(.55, (150, 700), (900, 4000), .9, 1.1), 1, rev=.35)
put(sfx, 3.0, impact(2.0, 62, 28), .6, rev=.4)
for s0, f in ((5.45, 2349.3), (5.8, 2637.0), (6.15, 3136.0)):
    S(s0, bell(f, .8, .6), .12, rev=.4)
for k in range(10):
    S(5.75 + k * .11, tick(2400 + k * 60), .1, pan=.3)
S(8.1, whoosh(.9, (200, 800), (1200, 5000), .5, .8), 1, pan=.3, rev=.2)
for i, f in enumerate((A['E6'], A['A6'], 2093.0)):
    S(9.5 + i * .16, bell(f, .7, .8), .1, pan=.4, rev=.5)
S(10.9, whoosh(.85, (150, 600), (800, 3000), .6, .6), 1, rev=.2)
S(12.95, tick(1200, .05), .5)
S(12.95, thump(160, 80, .15, .03), .25)
S(13.15, whoosh(.65, (400, 1500), (2500, 9000), .75, .9), 1, rev=.3)
S(14.75, blip(1400, 2000, .06), .22, pan=.2, rev=.2)
S(15.05, whoosh(.55, (300, 1200), (1200, 4000), .4, .35), 1)
S(15.85, tick(1500, .04), .35)
S(16.0, bell(A['C6'], .8, .7), .18, rev=.35)
for k in range(21):
    S(16.3 + k * (.85 / 21) + rng.uniform(-.006, .006), fft_filter(noise(.012), 1500, 6000) * env_exp(.012, .003) * .5, .2, pan=rng.uniform(-.1, .1))
S(17.35, tick(1100, .05), .45)
S(17.55, bell(A['E6'], 1.0, .7), .2, rev=.4)
S(17.7, bell(A['A6'], 1.2, .7), .18, rev=.45)
S(17.95, whoosh(.95, (200, 900), (1500, 6000), .45, 1.0), 1, pan=-.2, rev=.3)
tr = tt(.8)
S(18.1, fade(np.sin(2 * np.pi * np.cumsum(np.linspace(3200, 2200, len(tr))) / SR) * np.exp(-tr / .3) * .05, .05, .2), 1, rev=.6)
for s0 in (19.45, 19.75, 20.05, 20.25, 20.5, 20.6, 20.85):
    S(s0, blip(700, 1500, .07), .22, pan=rng.uniform(-.3, .5), rev=.2)
for s0 in (20.8, 21.3):
    S(s0, tick(2000, .03), .2)
S(21.0, bell(A['A5'], 1.2, .8), .28, rev=.35)
S(21.1, bell(A['E6'], 1.4, .8), .24, rev=.4)
S(21.95, blip(900, 1300, .05), .2)
S(22.3, whoosh(.4, (400, 1500), (1500, 5000), .3, .4), 1)
S(22.55, bell(A['C6'], 1.2, .8), .26, rev=.35)
S(22.65, bell(A['G6'], 1.4, .8), .22, rev=.4)
S(23.3, bell(A['A5'], 1.5, .7), .26, pan=-.3, rev=.45)
S(23.3, bell(A['C6'], 1.5, .7), .22, pan=.3, rev=.45)
S(23.15, whoosh(.8, (150, 600), (800, 3000), .6, .6), 1, rev=.2)
S(24.2, tick(1200, .05), .45)
tr = tt(.65)
S(24.5, fade(np.sin(2 * np.pi * np.cumsum(np.linspace(400, 1400, len(tr))) / SR) * np.sin(np.pi * tr / .65) * .08, .05, .1), 1, rev=.4)
S(24.5, whoosh(.65, (500, 2000), (2500, 9000), .6, .6), 1)
ACT = 18
for k in range(ACT):
    S(25.25 + 2.1 * (k / (ACT - 1)) ** .62, tick(2200 + k * 70, .03), .15 + .01 * k, pan=np.interp(k, [0, ACT - 1], [-.4, .4]))
S(26.0, blip(500, 800, .09), .25, rev=.3)
put(sfx, 22.0, impact(2.6, 65, 26), 1.0, rev=.5)          # impact des badges
put(sfx, 22.0, fft_filter(noise(1.3), 2000, 9000) * env_exp(1.3, .22) * .15, 1, rev=.6)
d = 1.05
tr = tt(d)
rub = fft_filter(noise(d), 2500, 7000) * (np.sin(2 * np.pi * 9 * tr) * .5 + .5) * np.sin(np.pi * tr / d) * .25
rub += sum(np.sin(2 * np.pi * f * tr) * .03 for f in (2637, 3136, 3951)) * np.sin(np.pi * tr / d)
S(29.3, fade(rub, .05, .1), 1, rev=.6)
S(30.75, whoosh(.65, (200, 800), (1000, 4000), .5, .6), 1, rev=.25)
LT = [31.25, 32.5, 33.75, 34.375, 35.0, 35.625]
notes = [A['A4'], A['C5'], A['D5'], A['E5'], A['G5'], A['A5']]
for i, (b, f) in enumerate(zip(LT, notes)):
    if i > 0:
        S(b - .26, whoosh(.42, (400, 1500), (2000, 7000), .5, .35 + .05 * i), 1, rev=.2)
    dd = 2.0 + .25 * i
    s = bell(f, dd, .7 + .1 * i)
    if i >= 2:
        s = s + .5 * bell(f * 2, dd, .6)
    if i >= 4:
        s = s + .35 * bell(f * 1.5, dd, .6)
    S(b, s, .34 + .03 * i, pan=(-.15 if i % 2 else .15), rev=.55)
for f in (A['A5'], A['C#6'], A['E6'], A['B6']):
    S(35.625, bell(f, 3.2, .8), .2, pan=rng.uniform(-.5, .5), rev=.7)
S(35.625, impact(3.0, 55, 24), .75, rev=.5)
d = .8
tr = tt(d)
S(36.05, fade(fft_filter(noise(d), 4000, 12000) * np.sin(np.pi * tr / d) * .12, .05, .1), 1, rev=.5)
S(37.05, whoosh(.6, (300, 1200), (900, 3500), .5, .8), 1, pan=-.2, rev=.25)
S(37.72, tick(1600, .05), .5)
S(37.72, bell(A['E6'], .8, .6), .14, rev=.4)
for k in range(8):
    S(37.85 + k * .1, tick(2300 + k * 50, .03), .09, pan=.3)
S(38.6, blip(900, 1500, .06), .22, rev=.2)
S(39.85, whoosh(.95, (150, 700), (800, 3500), .55, .9), 1, rev=.3)
S(40.9, whoosh(.7, (100, 500), (500, 2000), .8, .8), 1, rev=.4)
tr = tt(.7)
S(41.05, fade(np.sin(2 * np.pi * np.cumsum(np.linspace(1800, 2700, len(tr))) / SR) * (1 - tr / .7) ** 2 * .05, .1, .2), 1, rev=.5)
put(sfx, 32.3, impact(2.7, 60, 25), .85, rev=.55)
S(42.6, bell(A['A6'], 3.0), .45, rev=.7)
for s0 in (41.95, 42.12, 42.29, 42.46):
    S(s0, bell(3136.0, .5, .5), .06, rev=.4)
S(44.3, bell(A['A6'], 1.8, .6), .16, rev=.7)


# ======================= RÉVERBÉRATION, MIXAGE =======================
def ir(d=2.6, seed=1):
    r = np.random.default_rng(seed)
    t = tt(d)
    n = fft_filter(r.standard_normal(len(t)) * np.exp(-t / .5), 120, 7000)
    er = np.zeros_like(t)
    for k in range(8):
        er[int(r.uniform(.008, .07) * SR)] += r.uniform(.3, .7)
    return (n * .9 + er) / np.sqrt(np.sum(n ** 2) + 1e-9)


def conv(x, h):
    L = len(x) + len(h) - 1
    nfft = 1 << (L - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:len(x)]


wet = np.vstack([conv(send[0], ir(seed=1)), conv(send[1], ir(seed=2))]) * 1.1
mix = music * .9 + sfx + wet
duck = np.ones(N)
for a, b in SIL:
    ia, ib = int(a * SR), int(b * SR)
    k = int(.05 * SR)
    duck[ia - k:ia] = np.minimum(duck[ia - k:ia], np.linspace(1, .04, k))
    duck[ia:ib] = .04
mix = mix * np.convolve(duck, np.ones(240) / 240, mode='same')
fo = int(.35 * SR)
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2
mix = mix / np.max(np.abs(mix)) * 1.7
mix = np.tanh(mix) / np.tanh(1.7) * 10 ** (-1.0 / 20)
print('RMS %.1f dBFS' % (20 * np.log10(np.sqrt(np.mean(mix ** 2)))))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(os.path.join(ROOT, 'out', 'audio-v2.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('audio ok')
