"""Son du reel 03 (POV) : pas de voix, bruitages + boucle. Timing = TIMELINE de reel.html."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from sfx import *

T = dict(s2=2.3, n=[3.0, 3.9, 4.8, 5.7], s3=7.2, s4=9.6, fill=10.7, s5=12.6, dur=15.4)

def buzz(d=.32):
    """Vibration de téléphone."""
    t = tt(d)
    s = np.sin(2 * np.pi * 150 * t) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 22 * t)))
    return fade(fft_filter(s, 60, 600) * np.exp(-t / .5), .005, .04) * .7

m = Mix(T['dur'])
pad = mixs(pad_note(55.0, T['dur']), pad_note(82.41, T['dur']) * .7)
m._put(m.music, 0, pad, .55)
m.add(0.0, tick(2300), .35)
m.add(T['s2'] - .25, whoosh(.7, (120, 500), (800, 5000), .7, 1.1), .7)
for i, a in enumerate(T['n']):
    m.add(a, buzz(), .9)
    m.add(a + .02, ding(), .55, -.2 + i * .13)
for k in ('s3', 's4', 's5'):
    m.add(T[k] - .2, swish(), .7)
for i in range(4):
    m.add(T['s3'] + .7 + i * .12, pop(520 * 1.19 ** i), .55, -.4 + i * .27)
m.add(T['s4'] + .2, whoosh(.5, (200, 800), (1500, 6000), .8, 1.0), .5)
m.add(T['fill'], pop(880), .8)
m.add(T['fill'] + .15, mixs(bell(1046.5, 1.6, .8), bell(1318.5, 1.6, .7), bell(1567.98, 1.6, .6)), .45)
m.add(T['s5'] - .8, rise(.85), .6)
m.add(T['s5'] + .05, impact(2.6, 70, 26), 1.1)
m.add(T['s5'] + .95, pop(990), .6)
# boucle : on la coupe pendant l'accroche, elle démarre quand le téléphone arrive
m.beat(bpm=100, start=T['s2'], end=T['dur'] - .6, drop=[(T['s5'] - .5, T['s5'] + .05)])
os.makedirs('out', exist_ok=True)
m.save('out/audio.wav', voice=False)
print('ok', T['dur'])
