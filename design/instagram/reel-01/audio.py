"""Son du reel 01 : voix off + bruitages + petite boucle. Deux sorties :
out/audio-voix.wav (tout) et out/audio-sons.wav (sans voix ni boucle, pour poser une musique Instagram)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from sfx import *

m = Mix(16.0)
# voix (calée sur les plans de reel.html)
m.voice(0.15, "La motivation dure trois semaines.", maxdur=2.1)
m.voice(2.55, "Tes potes ? Trois ans.", maxdur=1.8)
m.voice(4.55, "Parce qu'eux, ils remarquent quand tu lâches.", maxdur=2.9)
m.voice(7.75, "Sur Reiz, tu postes ta séance.", maxdur=2.3)
m.voice(10.75, "Et ton cercle la voit.", maxdur=1.6)
m.voice(12.8, "Le dix octobre sur iPhone. Abonne-toi pour la sortie.", maxdur=2.9)

# bruitages
for i in range(4):
    m.add(i * .1, tick(2200 + i * 300), .5)
m.add(0.0, rise(1.3), .5)
m.add(1.35, fail(), .8)
for t in (2.4, 4.4, 7.6, 10.6, 12.5):
    m.add(t - .18, swish(), .7)
m.add(2.85, impact(1.6, 80, 32), 1.0)
m.add(5.0, ding(), .7, -.2)
m.add(5.9, ding(), .6, .2)
for i, t in enumerate((8.2, 8.7, 9.2)):
    m.add(t, pop(660 * 1.25 ** i), .8)
for i in range(5):
    m.add(10.8 + i * .12, pop(520 * 1.19 ** i), .55, -.4 + i * .2)
m.add(11.6, tick(3000), .4)
m.add(12.7, impact(2.4, 70, 28), 1.0)
m.add(13.1, pop(990), .8)

m.beat(bpm=100, start=0, end=15.6, drop=[(2.4, 2.85)])
print('\n'.join(f'{a:5.2f} {b:5.2f}  {t}' for a, b, t in m.lines))
os.makedirs('out', exist_ok=True)
m.save('out/audio-voix.wav', voice=True)
m.save('out/audio-sons.wav', voice=False, music=False)
