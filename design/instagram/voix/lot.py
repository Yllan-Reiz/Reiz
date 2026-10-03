"""Génère toutes les répliques d'un reel en une seule fois (le modèle n'est chargé qu'une fois).

    .venv/bin/python lot.py ../reel-02/repliques.json ../reel-02/voix/

repliques.json : [{"id": "r1", "texte": "...", "emotion": 0.9}, ...]
Sortie : un .wav par réplique (silences coupés) + durees.json {id: secondes}.
« Reiz » est réécrit « Raïz » pour la prononciation.
"""
import json, os, sys
import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
lignes = json.load(open(src, encoding='utf-8'))
device = 'mps' if torch.backends.mps.is_available() else 'cpu'
torch.manual_seed(7)
model = ChatterboxMultilingualTTS.from_pretrained(device=device)
durees = {}
for l in lignes:
    texte = l['texte'].replace('Reiz', 'Raïz')
    wav = model.generate(texte, language_id='fr', audio_prompt_path=l.get('ref'),
                         exaggeration=l.get('emotion', 0.85), cfg_weight=l.get('cfg', 0.35))
    x = wav[0]
    seuil = x.abs().max() * 0.02
    idx = (x.abs() > seuil).nonzero()
    if len(idx):
        a = max(0, int(idx[0]) - int(0.02 * model.sr))
        b = min(len(x), int(idx[-1]) + int(0.08 * model.sr))
        x = x[a:b]
    ta.save(os.path.join(out, l['id'] + '.wav'), x.unsqueeze(0), model.sr)
    durees[l['id']] = round(len(x) / model.sr, 3)
    print(l['id'], durees[l['id']], 's', flush=True)
json.dump(durees, open(os.path.join(out, 'durees.json'), 'w'), indent=1)
print('fini')
