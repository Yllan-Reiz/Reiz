import shutil
p='k10-reel/reel.html'; s=open(p).read()
s=s.replace("<div class=\"l\">JOURS D'ATTENTE</div>","<div class=\"l\" id=\"dl\">JOUR D'ATTENTE</div>")
s=s.replace("$('#dn').textContent = d;","$('#dn').textContent = d; $('#dl').textContent = d > 1 ? \"JOURS D'ATTENTE\" : \"JOUR D'ATTENTE\";")
open(p,'w').write(s)
shutil.copytree('j08-carrousel','j13-carrousel',dirs_exist_ok=True)
p='j13-carrousel/carrousel.html'; s=open(p).read()
s=s.replace('Le 10 octobre sur iPhone.','Bientôt sur iPhone.').replace('Abonne-toi pour la sortie.',"Abonne-toi, on te prévient dès que c'est sorti.")
open(p,'w').write(s)
shutil.copytree('j08-reel','j15-reel',dirs_exist_ok=True)
p='j15-reel/reel.html'; s=open(p).read()
s=s.replace('Le 10 octobre sur iPhone','Bientôt sur iPhone').replace('Abonne-toi pour la sortie','Abonne-toi pour être prévenu').replace('<div style="margin-top: 60px"><span class="jtag" id="jtag">J-2</span></div>','').replace("[['#jtag', .45], ['#date', .6], ['#pill', .9]]","[['#date', .6], ['#pill', .9]]")
open(p,'w').write(s)
p='stories/stories.html'; s=open(p).read()
new='''<section class="st" id="e1"><img class="logo" src="assets/ecriture-reiz-blanc-trim.png"><span class="tag">INFO</span><div class="in" style="top:520px"><div class="kicker">Nouveau reel</div><h1 style="font-size:112px">Reiz est en attente chez Apple.</h1><div class="sub">Le statut en direct 👀</div></div><div class="hint">Il est dans ton fil 👆</div></section>
<section class="st" id="e2"><div class="glow"></div><img class="logo" src="assets/ecriture-reiz-blanc-trim.png"><span class="tag">INFO</span><div class="in"><div class="kicker">Question du jour</div><h1>Le premier pote à qui tu l'envoies ?</h1></div><div class="hint">Tu sais déjà qui 👇</div></section>
'''
if 'id="e1"' not in s: s=s.replace('<script>const f=',new+'<script>const f=',1)
open(p,'w').write(s)
