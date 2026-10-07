import os, html, shutil
src = open('../carrousel-03/carrousel.html').read()
css = src[src.index('<style>') + 7: src.index('</style>')]
EXTRA = """
  .big { font-size: 112px; } .bd { flex:1; display:flex; flex-direction:column; justify-content:center; padding:40px 0; }
  .vs { margin-top: 56px; display: grid; gap: 24px; }
  .opt { border-radius: 32px; padding: 36px 40px; border: 2px solid var(--line); background: var(--card); }
  .opt b { font-size: 52px; font-weight: 900; letter-spacing: -.03em; display:block; }
  .opt span { font-size: 34px; color: var(--muted); margin-top: 8px; display:block; }
  .opt.hi { border-color: #fff; background: rgba(255,255,255,.07); }
  .pillbtn { display:inline-block; margin-top: 56px; font-size: 48px; font-weight: 900; color:#000; background:#fff; border-radius: 999px; padding: 26px 56px; align-self:flex-start; }
  .bgs { display:flex; margin-top: 56px; } .bgs img { width: 250px; margin: 0 -14px; -webkit-mask-image: radial-gradient(circle, #000 50%, transparent 68%); }
  .stepn { width: 120px; height: 120px; border-radius: 50%; background:#fff; color:#000; display:grid; place-items:center; font-size: 72px; font-weight: 900; margin-bottom: 48px; }
  .logo-big { width: 420px; margin-bottom: 56px; display:block; }
"""
def slide(n, inner, logo=True, swipe=False):
    return f'<section class="slide" data-n="{n}"><div class="top"><img class="logo" src="assets/ecriture-reiz-blanc-trim.png" alt="Reiz"><span class="count"></span></div>{inner}{"<div class=swipe>Glisse →</div>" if swipe else ""}<div class="bars"></div></section>'
def body(kick, h, sub='', cls='xl', extra=''):
    k = f'<div class="kicker">{kick}</div>' if kick else ''
    s = f'<p class="sub">{sub}</p>' if sub else ''
    return f'<div class="body">{k}<h1 class="{cls}">{h}</h1>{s}{extra}</div>'
def build(name, slides, title):
    out = f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{title}</title><style>{css}{EXTRA}</style></head><body>' + ''.join(slides)
    out += """<script>
const slides=[...document.querySelectorAll('.slide')],total=slides.length;
slides.forEach((s,i)=>{s.querySelector('.count').textContent=`${i+1}/${total}`;s.querySelector('.bars').innerHTML=slides.map((_,j)=>`<i class="${j<=i?'on':''}"></i>`).join('')});
const n=new URLSearchParams(location.search).get('s');if(n){document.body.classList.add('single');slides[n-1].classList.add('on')}
</script></body></html>"""
    os.makedirs(name, exist_ok=True)
    for d in ('fonts', 'assets'):
        if not os.path.exists(f'{name}/{d}'): shutil.copytree(f'_commun/{d}', f'{name}/{d}')
    open(f'{name}/carrousel.html', 'w').write(out)
CTA = lambda kick: body(kick, 'Le 10 octobre sur iPhone.', '<b>Abonne-toi pour la sortie.</b>', 'xl')
# 1
build('j06-carrousel', [
 slide(1, body('', 'Poster ta séance, c\'est pas frimer.', 'C\'est te rendre des comptes.', 'xl'), swipe=True),
 slide(2, body('Frimer', 'Montrer pour être admiré.', '', 'l', '<p class="sub" style="margin-top:64px"><b>Rendre des comptes</b>, c\'est montrer pour qu\'on remarque quand tu t\'arrêtes.</p>')),
 slide(3, body('Le problème', 'Un objectif que personne ne voit,', 'tu peux l\'abandonner <b>en silence</b>.', 'l')),
 slide(4, '<div class="bd"><div class="kicker">Avec ton cercle</div><div class="card"><div class="row"><div class="av" style="background:#f5c26b">N</div><div><div class="name">Nathan</div><div class="meta">maintenant</div></div></div><div class="msg">T\'étais où hier ? 👀</div></div><p class="sub">Ça change tout.</p></div>'),
 slide(5, '<div class="bd"><div class="kicker">Comment ça marche</div><h1 class="m">Une photo ou une vidéo de 15 s.</h1><div class="proof"><img src="assets/photo-seance.jpg" alt=""><div class="foot"><span>💪 Aller à la salle</span><span>3 / 4 séances</span></div></div></div>'),
 slide(6, body('Pas de pression', 'Pas de classement.', 'Juste ton cercle, et ton objectif.', 'l')),
 slide(7, body('Notre avis', 'Tes potes valent mieux qu\'un coach à 60 € par mois.', 'Pour être régulier, en tout cas.', 'm')),
 slide(8, CTA('Reiz')),
], 'Reiz carrousel frimer')
# 2
def opt(t, s, hi=''): return f'<div class="opt {hi}"><b>{t}</b><span>{s}</span></div>'
build('j08-carrousel', [
 slide(1, body('', 'Qui te regarde&nbsp;?', 'Sur Reiz, tu choisis. Objectif par objectif.', 'xl'), swipe=True),
 slide(2, body('Niveau 1', 'Privé.', 'Juste pour toi. Personne ne voit rien.', 'xl')),
 slide(3, body('Niveau 2', 'Mon cercle.', 'Tes amis voient ta séance et peuvent réagir.', 'xl')),
 slide(4, body('Niveau 3', 'Cercle proche&nbsp;★', 'Les potes à qui tu dois vraiment des comptes.', 'l')),
 slide(5, '<div class="bd"><div class="kicker">Chaque objectif a la sienne</div><h1 class="m">Trois niveaux, un choix.</h1><div class="vs">' + opt('🔒 Privé', 'Juste toi') + opt('👥 Mon cercle', 'Tes amis') + opt('★ Cercle proche', 'Tes plus proches', 'hi') + '</div></div>'),
 slide(6, body('Flexible', 'Tu changes d\'avis quand tu veux.', 'Un tap sur le menu de l\'objectif.', 'l')),
 slide(7, body('Notre conseil', 'Le cercle proche pour l\'objectif qui compte vraiment.', '', 'l')),
 slide(8, CTA('Reiz')),
], 'Reiz carrousel visibilite')
# 3
def step(n, h, s): return slide(n + 1, f'<div class="bd"><div class="stepn">{n}</div><h1 class="xl">{h}</h1><p class="sub">{s}</p></div>')
build('j10-carrousel', [
 slide(1, body('Reiz est disponible', 'Démarre en 3 étapes.', 'Ça va vite.', 'xl'), swipe=True),
 step(1, 'Crée ton objectif.', 'Un nom, un chiffre : «&nbsp;4 séances&nbsp;», «&nbsp;170&nbsp;kg au bench&nbsp;».'),
 step(2, 'Invite ton cercle.', 'Envoie ton lien d\'invitation à tes potes.'),
 step(3, 'Poste ta séance.', 'Une photo, ou une vidéo de 15 s.'),
 slide(5, '<div class="bd"><div class="kicker">Et là, ça commence</div><div class="card"><div class="row"><div class="av" style="background:#8fb8ff">S</div><div><div class="name">Sarah</div><div class="meta">a posté sa séance</div></div></div><div class="msg">Toi ? 💪</div></div><p class="sub">Ton cercle voit si t\'es venu.</p></div>'),
 slide(6, '<div class="bd"><div class="kicker">Chaque semaine tenue</div><h1 class="l">Un badge de plus.</h1><div class="bgs"><img src="assets/en-feu.png" alt=""><img src="assets/inarretable.png" alt=""><img src="assets/binome.png" alt=""></div></div>'),
 slide(7, body('Un conseil', 'Un seul pote suffit pour commencer.', '', 'l')),
 slide(8, '<div class="bd"><img class="logo-big" src="assets/ecriture-reiz-blanc-trim.png" alt=""><h1 class="xl">Télécharge Reiz.</h1><p class="sub"><b>Disponible sur l\'App Store.</b> Lien en bio.</p></div>'),
], 'Reiz carrousel 3 etapes')
