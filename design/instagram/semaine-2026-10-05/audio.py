"""Sons des 3 reels de la semaine (pas de voix, bruitages + boucle). Usage : python3 audio.py j06-reel"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from sfx import *
name = sys.argv[1]
def run(dur, f):
    m = Mix(dur); m._put(m.music, 0, mixs(pad_note(55.0, dur), pad_note(82.41, dur) * .7), .5); f(m)
    os.makedirs(f'{name}/out', exist_ok=True); m.save(f'{name}/out/audio.wav', voice=False)
if name == 'j06-reel':
    T = dict(s2=3.0, s3=7.4, ok=10.0, s4=11.6, s5=13.4, dur=16.2)
    def f(m):
        m.add(0, impact(1.6, 80, 30), .8)
        m.add(T['s2'] - .25, whoosh(.7, (120, 500), (800, 5000), .7, 1.1), .7)
        m.add(T['s2'] + .15, ding(), .8); 
        for i in range(12): m.add(T['s2'] + 1 + i * .3, tick(1800 + i * 40), .25)
        for k in ('s3', 's4', 's5'): m.add(T[k] - .2, swish(), .7)
        m.add(T['ok'], pop(880), .8); m.add(T['ok'] + .1, mixs(bell(1046.5, 1.6, .8), bell(1318.5, 1.6, .7), bell(1567.98, 1.6, .6)), .45)
        m.add(T['s5'] - .8, rise(.85), .6); m.add(T['s5'] + .05, impact(2.6, 70, 26), 1.1); m.add(T['s5'] + .95, pop(990), .6)
        m.beat(bpm=100, start=T['s2'], end=T['dur'] - .6, drop=[(T['s5'] - .5, T['s5'] + .05)])
    run(T['dur'], f)
elif name == 'j08-reel':
    T = dict(a=2.0, b=4.0, c=6.0, d=8.0, e=10.0, s5=12.0, dur=15.0)
    def f(m):
        m.add(0, impact(1.5, 80, 30), .8)
        for i, k in enumerate('abcde'): m.add(T[k] - .2, swish(), .7); m.add(T[k] + .4, pop(660 + i * 110), .6)
        for i in range(3): m.add(T['c'] + 1.0 + i * .22, pop(900 + i * 150), .5, -.4 + i * .4)
        m.add(T['d'] + .3, ding(), .8)
        for i in range(3): m.add(T['e'] + .3 + i * .15, bell(880 * 1.25 ** i, 1.2, .8), .4)
        m.add(T['s5'] - .8, rise(.85), .6); m.add(T['s5'] + .05, impact(2.6, 70, 26), 1.1); m.add(T['s5'] + .95, pop(990), .6)
        m.beat(bpm=120, start=0.5, end=T['dur'] - .6, drop=[(T['s5'] - .5, T['s5'] + .05)])
    run(T['dur'], f)
else:
    T = dict(s2=2.4, load=3.4, done=5.0, s3=6.8, s4=11.0, s5=12.8, dur=15.6)
    def f(m):
        m.add(0, impact(1.8, 80, 30), .9)
        for k in ('s2', 's3', 's4', 's5'): m.add(T[k] - .2, swish(), .7)
        for i in range(10): m.add(T['load'] + i * .16, tick(1500 + i * 120), .3)
        m.add(T['done'], pop(1046), .9); m.add(T['done'] + .1, mixs(bell(1046.5, 1.6, .8), bell(1318.5, 1.6, .7), bell(1567.98, 1.6, .6)), .5)
        for i in range(3): m.add(T['s3'] + .6 + i * .55, pop(700 + i * 150), .6)
        m.add(T['s5'] - .8, rise(.85), .6); m.add(T['s5'] + .05, impact(2.6, 70, 26), 1.1); m.add(T['s5'] + .95, pop(990), .6)
        m.beat(bpm=110, start=T['s2'], end=T['dur'] - .6, drop=[(T['s5'] - .5, T['s5'] + .05)])
    run(T['dur'], f)
print('ok', name)
