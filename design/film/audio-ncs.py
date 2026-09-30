"""Mixage du film Reiz sur « Royalty Funk » (LXNGVX, Maestro Chives, NCS).

⚠ Publication : licence commerciale NCS obligatoire pour une vidéo de marque.
Morceau : 80 BPM (un temps = 0,75 s), sol mineur. Drop : gros coup à 46,565 s, groove une seconde après.
Montage : 0 → 21,25 s = morceau à partir de 43,315 s (le coup du drop tombe à 3,25 s, quand l'app apparaît) ;
21,25 → 22,0 s = un temps de silence ; 22,0 → 31,75 s = le drop repris depuis son coup (arrivée des badges) ;
32,5 s = le coup du drop, une dernière fois, sur le logo.
Les sons d'interface sont écrits en temps du récit (film.html) et placés par R(),
l'inverse de la table KEYS de film.html. Sortie : out/audio-ncs.wav (35,5 s).
"""
import numpy as np, wave, os

SR = 48000
DUR = 35.5
N = int(SR * DUR)
ROOT = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)
KEYS = [(0, 0), (3.25, 5), (6.25, 8.75), (10, 13.75), (13.75, 18.75), (16.75, 22.5), (19, 25), (21.25, 28.25), (22, 28.75),
        (24.25, 31.25), (25, 32.5), (25.75, 33.75), (26.125, 34.375), (26.5, 35), (26.875, 35.625), (28.75, 37.5), (31, 40),
        (31.75, 41), (32.5, 41.625), (35.5, 45)]
DROP = 46.565
A_START = DROP - 3.25      # 0 s du film
SIL_A, SIL_B = 21.25, 22.0
MUSIC_CUT = 31.75      # la musique s'arrête ici...
FINAL_HIT = 32.5       # ... et revient une dernière fois sur le logo


def R(s):
    """Temps du récit → temps réel."""
    return float(np.interp(s, [k[1] for k in KEYS], [k[0] for k in KEYS]))


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
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
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
    return fade(np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, len(t))) / SR) * np.exp(-t / (d * .35)), .001, .01)


def tick(f=2600, d=.035):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / .006) + .4 * fft_filter(noise(d), 2000, 9000) * np.exp(-t / .003)
    return fade(s, .0005, .005) * .6


def thump(f0=110, f1=42, d=.45, tau=.12):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t / .05)
    return fade(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau), .001, .03)


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


# notes en sol mineur (le morceau)
Nt = {'G4': 392.0, 'Bb4': 466.16, 'C5': 523.25, 'D5': 587.33, 'F5': 698.46, 'G5': 783.99, 'Bb5': 932.33,
      'D6': 1174.66, 'F6': 1396.91, 'G6': 1567.98, 'A6': 1760.0, 'Bb6': 1864.66, 'D7': 2349.32, 'F7': 2793.83, 'G7': 3135.96}

# ======================= MUSIQUE =======================
w = wave.open(os.path.join(ROOT, 'music', 'royalty-funk.wav'))
tr = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, 2).T.astype(float) / 32768
def seg(t_film0, t_film1, t_track0, fin=.0, fout=.05):
    a, b = int(t_film0 * SR), int(t_film1 * SR)
    j = int(t_track0 * SR)
    part = tr[:, j:j + (b - a)].copy()
    if fin:
        k = int(fin * SR)
        part[:, :k] *= np.linspace(0, 1, k) ** 1.5
    k = int(fout * SR)
    part[:, -k:] *= np.linspace(1, 0, k)
    music[:, a:b] += part


seg(0.0, SIL_A, A_START, fin=.35, fout=.06)               # coupure puis premier drop
seg(SIL_B, MUSIC_CUT, DROP, fin=.004, fout=.05)           # le drop revient sur les badges
# dernier coup : la première mesure du drop, qui s'éteint dans la réverbe
hit = tr[:, int(DROP * SR):int((DROP + 2.2) * SR)].copy()
hit *= np.exp(-tt(2.2) / .45)[None, :]
put(music, FINAL_HIT, hit, .9, rev=.35)

# ======================= SONS D'INTERFACE (temps du récit) =======================
S(.6, fade(np.sin(2 * np.pi * np.cumsum(np.linspace(1800, 2700, int(.8 * SR))) / SR) * (1 - tt(.8) / .8) ** 2 * .05, .1, .15), 1, rev=.5)
S(2.8, bell(Nt['G6'], 2.4), .45, rev=.6)
for s0 in (2.75, 3.0, 3.25, 3.5):
    S(s0, bell(Nt['G7'], .5, .5), .07, rev=.4)
S(4.5, whoosh(.55, (150, 700), (900, 4000), .9, 1.1), 1, rev=.35)
S(5.0, impact(1.8, 62, 28), .22, rev=.3)
for s0, f in ((5.45, Nt['D7']), (5.8, Nt['F7']), (6.15, Nt['G7'])):
    S(s0, bell(f, .8, .6), .12, rev=.4)
for k in range(10):
    S(5.75 + k * .11, tick(2400 + k * 60), .1, pan=.3)
S(8.1, whoosh(.9, (200, 800), (1200, 5000), .5, .8), 1, pan=.3, rev=.2)
for i, f in enumerate((Nt['D6'], Nt['G6'], Nt['Bb6'])):
    S(9.5 + i * .16, bell(f, .7, .8), .1, pan=.4, rev=.5)
S(10.9, whoosh(.85, (150, 600), (800, 3000), .6, .6), 1, rev=.2)
S(12.95, tick(1200, .05), .5)
S(12.95, thump(160, 80, .15, .03), .25)
S(13.15, whoosh(.65, (400, 1500), (2500, 9000), .75, .9), 1, rev=.3)
S(14.75, blip(1400, 2000, .06), .22, pan=.2, rev=.2)
S(15.05, whoosh(.55, (300, 1200), (1200, 4000), .4, .35), 1)
S(15.85, tick(1500, .04), .35)
S(16.0, bell(Nt['Bb5'], .8, .7), .18, rev=.35)
for k in range(25):
    S(16.3 + k * (.85 / 25) + rng.uniform(-.005, .005), fft_filter(noise(.012), 1500, 6000) * env_exp(.012, .003) * .5, .2, pan=rng.uniform(-.1, .1))
S(17.35, tick(1100, .05), .45)
S(17.55, bell(Nt['D6'], 1.0, .7), .2, rev=.4)
S(17.7, bell(Nt['G6'], 1.2, .7), .18, rev=.45)
S(17.95, whoosh(.95, (200, 900), (1500, 6000), .45, 1.0), 1, pan=-.2, rev=.3)
for s0 in (19.45, 19.75, 20.05, 20.25, 20.5, 20.6, 20.85):
    S(s0, blip(700, 1500, .07), .22, pan=rng.uniform(-.3, .5), rev=.2)
for s0 in (20.8, 21.3):
    S(s0, tick(2000, .03), .2)
S(21.0, bell(Nt['G5'], 1.2, .8), .28, rev=.35)
S(21.1, bell(Nt['D6'], 1.4, .8), .24, rev=.4)
S(21.95, blip(900, 1300, .05), .2)
S(22.3, whoosh(.4, (400, 1500), (1500, 5000), .3, .4), 1)
S(22.55, bell(Nt['Bb5'], 1.2, .8), .26, rev=.35)
S(22.65, bell(Nt['F6'], 1.4, .8), .22, rev=.4)
S(23.3, bell(Nt['G5'], 1.5, .7), .26, pan=-.3, rev=.45)
S(23.3, bell(Nt['Bb5'], 1.5, .7), .22, pan=.3, rev=.45)
S(23.15, whoosh(.8, (150, 600), (800, 3000), .6, .6), 1, rev=.2)
S(24.2, tick(1200, .05), .45)
S(24.5, whoosh(.65, (500, 2000), (2500, 9000), .6, .6), 1)
ACT = 18
for k in range(ACT):
    S(25.25 + 2.1 * (k / (ACT - 1)) ** .62, tick(2200 + k * 70, .03), .15 + .01 * k, pan=np.interp(k, [0, ACT - 1], [-.4, .4]))
S(26.0, blip(500, 800, .09), .25, rev=.3)
S(28.75, impact(2.4, 60, 26), .3, rev=.35)                 # renforce le coup du drop
d = 1.05
t_ = tt(d)
rub = fft_filter(noise(d), 2500, 7000) * (np.sin(2 * np.pi * 9 * t_) * .5 + .5) * np.sin(np.pi * t_ / d) * .25
S(29.3, fade(rub, .05, .1), 1, rev=.6)
S(30.75, whoosh(.65, (200, 800), (1000, 4000), .5, .6), 1, rev=.25)
LT = [31.25, 32.5, 33.75, 34.375, 35.0, 35.625]
notes = [Nt['G4'], Nt['Bb4'], Nt['C5'], Nt['D5'], Nt['F5'], Nt['G5']]
for i, (b, f) in enumerate(zip(LT, notes)):
    if i > 0:
        S(b - .26, whoosh(.3, (400, 1500), (2000, 7000), .5, .35 + .05 * i), 1, rev=.2)
    dd = 1.8 + .25 * i
    s = bell(f, dd, .7 + .1 * i)
    if i >= 2:
        s = s + .5 * bell(f * 2, dd, .6)
    if i >= 4:
        s = s + .35 * bell(f * 1.5, dd, .6)
    S(b, s, .55 + .05 * i, pan=(-.15 if i % 2 else .15), rev=.5)
for f in (Nt['G5'], Nt['Bb5'], Nt['D6'], Nt['A6']):          # niveau 6 : sol mineur add9
    S(35.625, bell(f, 3.0, .8), .24, pan=rng.uniform(-.5, .5), rev=.6)
S(35.625, impact(2.4, 55, 24), .5, rev=.4)
S(37.05, whoosh(.6, (300, 1200), (900, 3500), .5, .8), 1, pan=-.2, rev=.25)
S(37.72, tick(1600, .05), .5)
S(37.72, bell(Nt['D6'], .8, .6), .16, rev=.4)
for k in range(8):
    S(37.85 + k * .1, tick(2300 + k * 50, .03), .09, pan=.3)
S(38.6, blip(900, 1500, .06), .22, rev=.2)
S(39.85, whoosh(.95, (150, 700), (800, 3500), .55, .9), 1, rev=.3)
put(sfx, FINAL_HIT, impact(2.6, 60, 25), .55, rev=.5)
S(42.6, bell(Nt['G6'], 3.0), .45, rev=.7)
for s0 in (41.95, 42.12, 42.29, 42.46):
    S(s0, bell(Nt['G7'], .5, .5), .06, rev=.4)
S(44.3, bell(Nt['G6'], 1.8, .6), .16, rev=.7)


# ======================= RÉVERBE, SIDECHAIN, MASTER =======================
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


wet = np.vstack([conv(send[0], ir(seed=1)), conv(send[1], ir(seed=2))])
fx = sfx + wet
# la musique s'efface un peu sous chaque son d'interface (jusqu'à -5 dB)
env = np.abs(sfx).max(axis=0)
k_att, k_rel = np.exp(-1 / (.005 * SR)), np.exp(-1 / (.18 * SR))
sm = np.zeros(N)
acc = 0.0
for i in range(0, N, 32):                      # suiveur d'enveloppe, par blocs de 32 échantillons
    v = env[i:i + 32].max()
    acc = v + (acc - v) * (k_att ** 32 if v > acc else k_rel ** 32)
    sm[i:i + 32] = acc
duck = 1 - .4 * np.clip(sm / .25, 0, 1)
mix = music * .55 * duck + fx * 1.15
# instants des coups de basse (pour la pulsation de l'image)
mono = music.mean(axis=0)
hop, win = 256, 2048
nfr = (N - win) // hop
fr = np.lib.stride_tricks.as_strided(mono, shape=(nfr, win), strides=(mono.strides[0] * hop, mono.strides[0]))
sp = np.abs(np.fft.rfft(fr * np.hanning(win), axis=1))
fq = np.fft.rfftfreq(win, 1 / SR)
lowe = sp[:, (fq >= 30) & (fq < 130)].sum(1)
fl = np.concatenate([[0], np.maximum(0, np.diff(lowe))])
tt_ = np.arange(nfr) * hop / SR + win / 2 / SR
pulses, last = [], -1
thr = np.percentile(fl, 98) * .5
for i in range(1, nfr - 1):
    if fl[i] > thr and fl[i] >= fl[i - 1] and fl[i] >= fl[i + 1] and tt_[i] - last > .5:
        if (3.2 <= tt_[i] < SIL_A) or (SIL_B - .05 <= tt_[i] < MUSIC_CUT):
            pulses.append(round(float(tt_[i]), 3)); last = tt_[i]
import json
json.dump(pulses, open(os.path.join(ROOT, 'out', 'pulses.json'), 'w'))
print(len(pulses), 'pulsations')
fo = int(.4 * SR)
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2
mix = mix / np.max(np.abs(mix)) * 1.6
mix = np.tanh(mix) / np.tanh(1.6) * 10 ** (-1.0 / 20)
print('RMS %.1f dBFS' % (20 * np.log10(np.sqrt(np.mean(mix ** 2)))))
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(os.path.join(ROOT, 'out', 'audio-ncs.wav'), 'wb') as o:
    o.setnchannels(2)
    o.setsampwidth(2)
    o.setframerate(SR)
    o.writeframes(pcm.tobytes())
print('audio ok')
