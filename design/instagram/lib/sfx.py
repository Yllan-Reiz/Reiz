"""Boîte à sons des reels Reiz : effets synthétisés en numpy + voix off macOS (say).

Utilisation dans un audio.py de reel :
    import sys; sys.path.insert(0, '../lib'); from sfx import *
    m = Mix(16.0)
    m.voice(0.1, "La motivation dure trois semaines.")
    m.add(2.9, impact(), .8)
    m.beat(bpm=100, start=0, end=15.5)
    m.save('out/audio-voix.wav', voice=True); m.save('out/audio-sons.wav', voice=False)
"""
import numpy as np, wave, os, subprocess, tempfile

SR = 48000
rng = np.random.default_rng(7)
VOICE = os.environ.get('REIZ_VOICE', 'Thomas (Français (France))')
FFMPEG = '/opt/homebrew/bin/ffmpeg'
def tt(d):
    return np.arange(int(d * SR)) / SR






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






# ======================= sons prêts à l'emploi =======================

def mixs(*parts):
    """Additionne des signaux de longueurs différentes."""
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def pop(f=880):
    """Apparition d'un élément (carte, avatar, mot)."""
    return mixs(blip(f * 1.6, f, .09) * .8, tick(f * 3, .02) * .3)


def ding():
    """Notification reçue."""
    return mixs(bell(1318.5, 1.2, .6) * .7, bell(1975.5, .8, .4) * .35)


def swish():
    """Changement de plan."""
    return whoosh(.32, (300, 1200), (2000, 7000), .75, 1.0)


def fail():
    """La barre qui cale."""
    return mixs(blip(330, 180, .22) * .7, blip(220, 120, .3) * .5)


def rise(d=1.2):
    """Montée avant un impact."""
    return whoosh(d, (150, 600), (1500, 9000), .95, 1.2)


# ======================= voix off =======================

def say(text, voice=None, rate=190):
    """Voix macOS → tableau mono 48 kHz. « Reiz » se prononce « raïz »."""
    text = text.replace('Reiz', 'Raïz')
    with tempfile.TemporaryDirectory() as d:
        a, w = os.path.join(d, 'v.aiff'), os.path.join(d, 'v.wav')
        subprocess.run(['say', '-v', voice or VOICE, '-r', str(rate), '-o', a, text], check=True)
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', a, '-ar', str(SR), '-ac', '1', w], check=True)
        with wave.open(w) as f:
            x = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(float) / 32768
    # coupe les silences de début et de fin
    nz = np.nonzero(np.abs(x) > .01)[0]
    if len(nz):
        x = x[max(0, nz[0] - 200): nz[-1] + 2400]
    return x


class Mix:
    def __init__(self, dur):
        self.dur, self.n = dur, int(SR * dur)
        self.fx = np.zeros((2, self.n))
        self.music = np.zeros((2, self.n))
        self.vo = np.zeros(self.n)
        self.lines = []

    def _put(self, buf, t0, sig, gain, pan=0.0):
        i0 = int(round(t0 * SR))
        if i0 >= self.n:
            return
        l, r = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2), np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        k = min(len(sig), self.n - i0)
        if buf.ndim == 1:
            buf[i0:i0 + k] += gain * sig[:k]
        else:
            buf[0, i0:i0 + k] += gain * l * sig[:k]
            buf[1, i0:i0 + k] += gain * r * sig[:k]

    def add(self, t0, sig, gain=1.0, pan=0.0):
        self._put(self.fx, t0, sig, gain, pan)

    def voice(self, t0, text, rate=190, maxdur=None, gain=1.0):
        """Place une phrase ; si maxdur est donné et dépassé, accélère la voix."""
        x = say(text, rate=rate)
        if maxdur and len(x) / SR > maxdur:
            x = say(text, rate=int(rate * (len(x) / SR) / maxdur) + 4)
        self._put(self.vo, t0, x, gain)
        self.lines.append((t0, round(t0 + len(x) / SR, 2), text))
        return len(x) / SR

    def beat(self, bpm=100, start=0.0, end=None, drop=()):
        """Boucle discrète kick, hat, basse. drop = liste de (a, b) sans batterie."""
        end = end or self.dur
        b = 60 / bpm
        notes = [55.0, 55.0, 65.41, 49.0]
        i, t = 0, start
        while t < end - .05:
            if not any(a <= t < z for a, z in drop):
                if i % 4 in (0, 2) or i % 8 == 7:
                    self._put(self.music, t, kick(), .55)
                self._put(self.music, t + b / 2, hat(), .18, .3)
                if i % 2 == 0:
                    self._put(self.music, t, bassnote(notes[(i // 4) % 4], b * 1.6), .45)
            i, t = i + 1, t + b

    def save(self, path, voice=True, music=True):
        out = self.fx.copy()
        if music:
            m = self.music.copy()
            if voice:  # la musique baisse sous la voix
                env = np.convolve(np.abs(self.vo) > .02, np.ones(int(.12 * SR)) / (.12 * SR), 'same')
                m *= 1 - .55 * np.clip(env * 3, 0, 1)
            out += m
        if voice:
            out += np.vstack([self.vo, self.vo]) * 1.1
        peak = np.max(np.abs(out)) or 1
        out = np.tanh(out / peak * 1.4) * .89
        k = int(.03 * SR)
        out[:, -k:] *= np.linspace(1, 0, k)
        pcm = (out.T * 32767).astype(np.int16)
        os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
        with wave.open(path, 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
        return path


def mux(video, audio, out):
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', video, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                    '-shortest', '-movflags', '+faststart', out], check=True)
    return out
