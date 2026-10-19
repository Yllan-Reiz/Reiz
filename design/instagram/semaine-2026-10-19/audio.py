"""Sons des reels de la semaine du 19/10 (pas de voix, bruitages + boucle). Usage : python3 audio.py l19-reel"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from sfx import *
name = sys.argv[1]
def run(dur, f):
    m = Mix(dur); m._put(m.music, 0, mixs(pad_note(55.0, dur), pad_note(82.41, dur) * .7), .5); f(m)
    os.makedirs(f'{name}/out', exist_ok=True); m.save(f'{name}/out/audio.wav', voice=False)
if name == 'l19-reel':
    T = dict(s2=2.8, cut=5.3, s3=6.8, f=(7.5, 8.0, 8.5), rest=9.3, s4=11.0, notif=11.7, s5=13.4, dur=16.2)
    def f(m):
        m.add(0, impact(1.8, 80, 30), .9)
        for k in ('s2', 's3', 's4', 's5'): m.add(T[k] - .2, swish(), .7)
        for i in range(12): m.add(T['s2'] + .5 + i * .11, tick(1400 + i * 90), .25)
        m.add(T['cut'], fail(), .55); m.add(T['cut'], whoosh(.4, (300, 900), (2000, 6000), .5, .9), .5)
        for i, a in enumerate(T['f']): m.add(a, pop(660 + i * 165), .8)
        m.add(T['rest'], ding(), .6)
        m.add(T['notif'], pop(990), .7)
        m.add(T['s5'] - .8, rise(.85), .6); m.add(T['s5'] + .05, impact(2.6, 70, 26), 1.1); m.add(T['s5'] + .95, pop(990), .6)
        m.beat(bpm=100, start=T['s2'], end=T['dur'] - .6, drop=[(T['cut'] - .1, T['s3']), (T['s5'] - .5, T['s5'] + .05)])
    run(T['dur'], f)
else:
    T = dict(s2=2.8, flip=3.6, notif=4.1, s3=6.6, r=(7.1, 7.6, 8.1), r4=8.8, s4=10.8, s5=13.4, dur=16.2)
    def f(m):
        m.add(0, impact(1.8, 80, 30), .9)
        for i in range(6): m.add(.4 + i * .5, tick(2200), .35)
        for k in ('s2', 's3', 's4', 's5'): m.add(T[k] - .2, swish(), .7)
        m.add(T['flip'], mixs(bell(1046.5, 1.6, .8), bell(1318.5, 1.6, .7)), .5)
        m.add(T['notif'], ding(), .8)
        for i, a in enumerate(T['r']): m.add(a, pop(700 + i * 150), .7)
        m.add(T['r4'], fail(), .35)
        m.add(T['s5'] - .8, rise(.85), .6); m.add(T['s5'] + .05, impact(2.6, 70, 26), 1.1); m.add(T['s5'] + .95, pop(990), .6)
        m.beat(bpm=110, start=T['flip'], end=T['dur'] - .6, drop=[(T['s5'] - .5, T['s5'] + .05)])
    run(T['dur'], f)
print('ok', name)
