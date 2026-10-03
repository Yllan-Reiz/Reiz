"""Son du reel 02 (badges) : voix off + bruitages + boucle à 133 BPM (un badge tous les 2 temps)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from sfx import *

m = Mix(18.0)
m.voice(0.15, "À la salle, personne te donne de médaille.", maxdur=2.05)
m.voice(2.35, "Ici, si.", maxdur=.5)
m.voice(3.15, "Premier pas.", maxdur=.8)
for i, n in enumerate(["En action.", "En feu.", "Lève-tôt.", "Couche-tard.", "Inarrêtable.", "Acharné."]):
    m.voice(4.15 + i * .9, n, maxdur=.8)
m.voice(9.65, "Et six niveaux par badge.", maxdur=2.2)
m.voice(12.85, "Douze badges. Combien t'en débloques ?", maxdur=2.3)
m.voice(15.4, "Le dix octobre sur iPhone. Abonne-toi pour la sortie.", maxdur=2.5)

for i in range(3):
    m.add(i * .35, tick(2000 + i * 400), .45)
m.add(1.3, rise(1.55), .9)
m.add(2.85, impact(2.2, 85, 30), 1.1)
m.add(2.85, bell(2637, 1.6, 1.0), .5)
m.add(2.85, bell(1975.5, 1.8, .8), .4)
for i in range(6):
    t = 4.1 + i * .9
    m.add(t - .15, swish(), .55, (-1) ** i * .3)
    m.add(t + .05, pop(700 + i * 90), .6)
for i in range(6):
    m.add(9.9 + i * .28, pop(440 * 1.12 ** i), .7, -.5 + i * .2)
for i in range(12):
    m.add(12.95 + ((i % 4) + i // 4) * .09, tick(1800 + (i % 5) * 300), .35, -.4 + (i % 4) * .27)
for t in (9.5, 12.7, 15.3):
    m.add(t - .18, swish(), .7)
m.add(15.5, impact(2.3, 70, 28), 1.0)
m.add(15.9, pop(990), .8)

m.beat(bpm=133.33, start=0.05, end=17.6, drop=[(0, 2.85)])
print('\n'.join(f'{a:5.2f} {b:5.2f}  {t}' for a, b, t in m.lines))
os.makedirs('out', exist_ok=True)
m.save('out/audio-voix.wav', voice=True)
m.save('out/audio-sons.wav', voice=False, music=False)
