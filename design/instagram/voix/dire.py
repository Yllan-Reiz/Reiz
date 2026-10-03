"""Voix off des reels Reiz avec Chatterbox Multilingual (Resemble AI, licence MIT), en local.

    .venv/bin/python dire.py "Texte à dire." sortie.wav [--ref voix-reference.wav] [--emotion 0.7]

--ref    : 10 à 15 s d'une vraie voix (Yllan ou un pote, avec son accord) pour que la voix
           sonne française et humaine. Sans --ref, voix par défaut du modèle.
--emotion: 0.5 neutre, 0.7 à 1.0 plus expressif.
« Reiz » est réécrit « Raïz » pour la prononciation.
"""
import argparse
import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

p = argparse.ArgumentParser()
p.add_argument('texte')
p.add_argument('sortie')
p.add_argument('--ref')
p.add_argument('--emotion', type=float, default=0.7)
p.add_argument('--cfg', type=float, default=0.35)
a = p.parse_args()

device = 'mps' if torch.backends.mps.is_available() else 'cpu'
model = ChatterboxMultilingualTTS.from_pretrained(device=device)
texte = a.texte.replace('Reiz', 'Raïz')
wav = model.generate(texte, language_id='fr', audio_prompt_path=a.ref, exaggeration=a.emotion, cfg_weight=a.cfg)
ta.save(a.sortie, wav, model.sr)
print('ok', a.sortie, round(wav.shape[-1] / model.sr, 2), 's')
