src=open('gen_carrousels.py').read()
exec(src[:src.index('# 1\n')])
def ex_(n,num,h,p): return slide(n,f'<div class="who2"><div class="num">EXCUSE N° {num}</div><h1 class="xl">{h}</h1><p class="sub">{p}</p></div>')
EXTRA3=EXTRA+"""
  .who2 { flex:1; display:flex; flex-direction:column; justify-content:center; }
  .who2 .num { font-size: 30px; font-weight: 800; letter-spacing: .3em; color: var(--dim); margin-bottom: 36px; }
"""
EXTRA=EXTRA3
build('s17-carrousel',[
 slide(1, body('', 'Les 6 excuses pour sauter la salle.', 'Laquelle t\'es ? Commente ton numéro.', 'xl'), swipe=True),
 ex_(2,1,'« J\'ai mal dormi. »','Spoiler : t\'as quand même scrollé jusqu\'à 1h.'),
 ex_(3,2,'« Je double demain. »','Demain, tu doubles le canapé.'),
 ex_(4,3,'« Il pleut. »','La salle est couverte. Depuis toujours.'),
 ex_(5,4,'« Je commence lundi. »','C\'est lundi aujourd\'hui, au passage.'),
 ex_(6,5,'« Mes potes viennent pas. »','Alors c\'est eux qui t\'attendent pas non plus.'),
 slide(7, body('Le point commun', 'Personne t\'a vu l\'écrire.', 'Une excuse que personne ne voit, c\'est une excuse qui passe.', 'l')),
 slide(8, body('Reiz', 'Mets ton e-mail sur le site.', 'On te prévient dès que c\'est sorti. Lien dans la bio.', 'l')),
],'Reiz carrousel excuses')
