"""Reel 02 v2 (badges) : timing calé sur la voix Chatterbox, puis son.
1. lit voix/durees.json  2. écrit timeline.json (lu par reel.html)  3. mixe out/audio-voix.wav et out/audio-sons.wav"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from sfx import *

def segs(path, gap=.12, minseg=.08):
    """Découpe une réplique en morceaux de parole (seuil d'énergie, fenêtres de 50 ms)."""
    x = load_wav(path); hop = int(.05 * SR)
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x), hop)])
    on = e > e.max() * .08; out = []; i = 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and (on[j] or (j + int(gap / .05) < len(on) and on[j:j + int(gap / .05) + 1].any())): j += 1
            if (j - i) * .05 >= minseg: out.append([i * .05, j * .05])
            i = j
        else: i += 1
    return x, out

def coupe(x, segments, keep):
    """Garde les morceaux de parole jusqu'à `keep` inclus (enlève les bruits parasites de fin)."""
    return x[:int((segments[keep][1] + .06) * SR)]

V = {}
# accroche : on coupe tout ce qui suit le premier long silence
x, sg = segs('voix/r1.wav', gap=.4); V['r1'] = coupe(x, sg, 0)
# « Ici, si. Premier pas. » : 3 morceaux, l'impact tombe sur « si »
x, sg = segs('voix-liste/premier.wav', gap=.12); V['premier'] = coupe(x, sg, 2); SP = sg[:3]
# liste des 6 badges d'une traite, découpée sur les 5 plus grands silences
x, sg = segs('voix-liste/liste.wav', gap=.06)
gaps = sorted(range(len(sg) - 1), key=lambda i: sg[i + 1][0] - sg[i][1], reverse=True)[:5]
cuts = sorted(gaps); LS = []; a0 = 0
for c in cuts + [len(sg) - 1]: LS.append([sg[a0][0], sg[c][1]]); a0 = c + 1
V['liste'] = coupe(x, sg, len(sg) - 1)
print('liste :', [[round(a, 2), round(b, 2)] for a, b in LS])
for k in ('r4', 'r5'):
    x, sg = segs(f'voix/{k}.wav', gap=.45); V[k] = coupe(x, sg, 0)
# fin : « Raïz. / Le dix octobre, sur iPhone. / Abonne-toi. » puis un bruit parasite qu'on coupe
x, s6g = segs('voix/r6.wav', gap=.2); V['r6'] = coupe(x, s6g, min(2, len(s6g) - 1))
dur = {k: len(v) / SR for k, v in V.items()}

T = {}
T['r1'] = .12; t = T['r1'] + dur['r1'] + .3
T['s2'] = t; T['premier'] = t + .05
T['impact'] = T['premier'] + SP[1][0] + .02
T['r3'] = T['premier'] + SP[2][0]
T['s3'] = T['premier'] + SP[2][1] + .45
T['liste'] = T['s3'] + .2
slots = []
for i, (a, b) in enumerate(LS):
    st = T['liste'] + a - .1
    en = T['liste'] + LS[i + 1][0] - .1 if i < 5 else T['liste'] + b + .55
    slots.append([round(st, 3), round(en - st, 3)])
slots[0][1] += slots[0][0] - T['s3']; slots[0][0] = T['s3']
T['slots'] = slots
t = slots[-1][0] + slots[-1][1]
T['s4'] = t; T['r4'] = t + .25; t += dur['r4'] + 1.35
T['s5'] = t; T['r5'] = t + .3; t += dur['r5'] + .85
T['s6'] = t; T['r6'] = t + .35; t += dur['r6'] + 1.2
T['r6a'] = T['r6'] + s6g[1][0] if len(s6g) > 1 else T['r6'] + .7
T['r6b'] = T['r6'] + s6g[2][0] if len(s6g) > 2 else T['r6'] + 2.5
print('r6 morceaux', [[round(a,2), round(b,2)] for a, b in s6g])
T['dur'] = round(t, 2)
T = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in T.items()}
json.dump(T, open('timeline.json', 'w'), indent=1)
print('durée', T['dur'], 's', {k: round(v, 2) for k, v in dur.items()})

m = Mix(T['dur'])
for k in ('r1', 'premier', 'liste', 'r4', 'r5', 'r6'):
    m._put(m.vo, T[k], V[k], 1.0); m.lines.append((T[k], round(T[k] + dur[k], 2), k))

# son : nappe sombre, montées, impacts, une pulsation par badge
pad = mixs(pad_note(55.0, T['dur']), pad_note(82.41, T['dur']) * .7)
m._put(m.music, 0, pad, .5)
m.add(0.0, tick(2400), .35)
m.add(T['s2'] - 1.1, rise(1.25), .8)
m.add(T['impact'], impact(2.6, 90, 28), 1.25)
m.add(T['impact'], bell(2637, 1.8, 1.0), .45)
m.add(T['impact'] + .02, bell(1975.5, 2.0, .8), .35)
m.add(T['impact'], whoosh(.6, (100, 400), (800, 4000), .1, 1.0), .5)
for i, (a, d) in enumerate(slots):
    m.add(a - .16, swish(), .6, (-1) ** i * .35)
    m._put(m.music, a, kick(), .75)
    m._put(m.music, a + d / 2, hat(), .25, .3)
    m.add(a + .06, pop(620 + i * 70), .45)
lv = T['s4'] + .55
for i in range(6):
    m.add(lv + i * .2, pop(392 * 1.122 ** i), .6, -.5 + i * .2)
m.add(lv + 1.25, bell(1567.98, 1.4, .8), .35)
for i in range(12):
    m.add(T['s5'] + .15 + ((i % 4) + i // 4) * .06, tick(1700 + (i % 5) * 320), .3, -.45 + (i % 4) * .3)
m.add(T['s5'] + .9, kick(), .7)
for k in ('s3', 's4', 's5', 's6'):
    m.add(T[k] - .2, swish(), .7)
m.add(T['s6'] - .9, rise(.95), .6)
m.add(T['s6'] + .05, impact(2.8, 70, 26), 1.1)
m.add(T['s6'] + .05, bell(1318.5, 2.4, .7), .3)
print('\n'.join(f'{a:5.2f} {b:5.2f}  {n}' for a, b, n in m.lines))
os.makedirs('out', exist_ok=True)
m.save('out/audio-voix.wav', voice=True)
m.save('out/audio-sons.wav', voice=False)
m.save('out/audio-bruitages.wav', voice=False, music=False)  # bruitages seuls, pour poser une musique Instagram par-dessus
