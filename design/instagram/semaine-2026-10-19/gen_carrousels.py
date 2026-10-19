import re
src = open('../semaine-2026-10-05/s17-carrousel/carrousel.html').read()
head = src.split('</style>')[0]
script = '<script>' + src.split('<script>')[1]
extra = """
  .avs { display: flex; margin-top: 70px; } .avs i { width: 150px; height: 150px; border-radius: 50%; background: #fff; color: #000; display: grid; place-items: center; font-style: normal; font-size: 64px; font-weight: 900; border: 8px solid #0a0a0a; margin-right: -26px; }
  .avs i.q { background: #1c1c1c; color: #8a8a8a; border-color: #0a0a0a; box-shadow: inset 0 0 0 4px #444; }
  .who img { width: 430px; }
  .who .tagname { display: inline-flex; align-items: center; gap: 18px; margin-top: 30px; font-size: 34px; font-weight: 800; color: #999; }
  .who .tagname b { width: 64px; height: 64px; border-radius: 50%; background: #fff; color: #000; display: grid; place-items: center; font-size: 30px; font-weight: 900; }
  .tip { font-size: 30px; font-weight: 800; letter-spacing: .3em; color: var(--dim); margin-bottom: 36px; }
"""
L = '<div class="top"><img class="logo" src="assets/ecriture-reiz-blanc-trim.png" alt="Reiz"><span class="count"></span></div>'
def slide(n, inner): return f'<section class="slide" data-n="{n}">{L}{inner}<div class="bars"></div></section>'
def page(title, slides):
    return head.replace('<title>Reiz carrousel excuses</title>', f'<title>{title}</title>') + extra + '</style></head><body>' + ''.join(slide(i + 1, s) for i, s in enumerate(slides)) + script

dots = lambda k: '<div class="dots">' + ''.join(f'<i class="{"on" if j < k else ""}"></i>' for j in range(4)) + '</div>'
m21 = [
 '<div class="body"><h1 class="xl">5 trucs pour tenir 3 séances par semaine.</h1><p class="sub">Le n°4, presque personne le fait.</p></div><div class="swipe">Glisse →</div>',
 '<div class="who2"><div class="tip">N° 1</div><h1 class="xl">Choisis tes jours.</h1><p class="sub">Pas «&nbsp;quand j\'aurai le temps&nbsp;». <b>Lundi, mercredi, vendredi.</b> Écrits quelque part.</p></div>',
 '<div class="who2"><div class="tip">N° 2</div><h1 class="xl">Même heure, chaque fois.</h1><p class="sub">Au bout de 2 semaines, ta tête arrête de négocier.</p></div>',
 '<div class="who2"><div class="tip">N° 3</div><h1 class="xl">Ton sac, la veille.</h1><p class="sub">Moins de trucs à décider, moins d\'excuses à trouver.</p></div>',
 '<div class="who2"><div class="tip">N° 4, CELUI QUE PERSONNE FAIT</div><h1 class="xl">Dis-le à quelqu\'un.</h1><p class="sub">Un objectif que personne voit, tu peux l\'abandonner <b>en silence</b>. Un objectif que ton pote connaît, non.</p></div>',
 '<div class="who2"><div class="tip">N° 5</div><h1 class="l">Compte en séances, pas en&nbsp;%.</h1><div class="card" style="margin-top:56px"><div class="good">3 séances sur 4</div>' + dots(3) + '</div><p class="sub">Tu sais exactement ce qu\'il te reste.</p></div>',
 '<div class="body"><div class="kicker">Le n°4, en appli</div><h1 class="l">Reiz le fait pour toi.</h1><p class="sub">Tu postes ta séance, <b>ton cercle la voit</b>. Et il remarque quand tu lâches.</p></div>',
 '<div class="body"><div class="kicker">Reiz arrive sur iPhone</div><h1 class="l">Abonne-toi.</h1><p class="sub">On te prévient dès que c\'est sorti.</p><img class="big-logo" src="assets/ecriture-reiz-blanc-trim.png" alt="Reiz"></div>',
]
def who(num, img, name, desc, ini, pseudo):
    return f'<div class="who"><img src="assets/{img}.png" alt=""><div class="num">N° {num}</div><h2>{name}</h2><p>{desc}</p><div class="tagname"><b>{ini}</b>{pseudo}</div></div>'
d25 = [
 '<div class="body"><h1 class="xl">Ton cercle idéal tient en 4 potes.</h1><p class="sub">Glisse, puis tague les tiens en commentaire.</p><div class="avs"><i>S</i><i>T</i><i>I</i><i>H</i><i class="q">?</i></div></div><div class="swipe">Glisse →</div>',
 who(1, 'regulier', 'Le régulier', 'Il rate jamais. Il te met la pression sans dire un mot.', 'S', 'comme Sarah'),
 who(2, 'binome', 'Le binôme', 'Toujours partant. Tu dis «&nbsp;séance&nbsp;?&nbsp;», il est déjà en route.', 'T', 'comme Théo'),
 who(3, 'leve-tot', 'Le lève-tôt', 'Séance à 7h, photo à 8h. Toi, tu culpabilises au petit-déj.', 'I', 'comme Inès'),
 who(4, 'premier-pas', 'Le revenant', 'Il lâche, il revient. Et c\'est vous qui le faites revenir.', 'H', 'comme Hugo'),
 '<div class="body"><div class="kicker">Et toi&nbsp;?</div><h1 class="l">T\'es lequel des 4&nbsp;?</h1><p class="sub">Réponds en commentaire. Sois honnête, ton cercle lit.</p></div>',
 '<div class="body"><div class="kicker">Sur Reiz</div><h1 class="l">Ton cercle voit tes séances.</h1><p class="sub">Et il remarque <b>quand tu lâches</b>. C\'est tout le principe.</p><div class="bgs"><img src="assets/regulier.png"><img src="assets/binome.png"><img src="assets/leve-tot.png"></div></div>',
 '<div class="body"><div class="kicker">À toi</div><h1 class="l">Tague tes 4 potes.</h1><p class="sub">Le jour de la sortie, tu sauras qui inviter en premier.</p><img class="big-logo" src="assets/ecriture-reiz-blanc-trim.png" alt="Reiz"></div>',
]
open('m21-carrousel/carrousel.html', 'w').write(page('Reiz carrousel 3 séances', m21))
open('d25-carrousel/carrousel.html', 'w').write(page('Reiz carrousel cercle', d25))
print('ok')
