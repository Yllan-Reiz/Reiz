# Film de lancement Reiz (v2)

Film de 35 s, rendu en deux formats depuis le même projet :
9:16 (1080 × 1920, TikTok, Reels, Shorts) et 16:9 (1920 × 1080). 30 i/s, 120 BPM.
Storyboard d'origine : https://claude.ai/artifact/EPvTwZjpgMwY1EyuC6xq6e

## Ce qui a changé depuis la v1

- Textes en français. Seul « Rise to your goals » reste en anglais, sous le logo (ouverture et fin).
- Aucune personne réelle : utilisateur fictif « Théo » (@theo), amis fictifs Sarah, Nathan, Inès, Hugo, Maël,
  avatars à initiales (le rendu de l'app quand il n'y a pas de photo). Photo de séance : `assets/photo-seance.jpg`,
  prise par Yllan dans sa salle (sans personne), recadrée pour retirer la caisse au nom de la salle.
- Plus dynamique : 35 s au lieu de 45, ouverture en 3 s, musique à 120 BPM avec kick, claps et basse.
- « Le réseau social des sportifs. » dès la troisième seconde.

## Fichiers

- `film.html` : l'animation. `render(t)` dessine l'image au temps réel `t`. `?fmt=v` pour le 9:16, `?fmt=h` pour le 16:9.
- `audio.py` : sound design provisoire synthétisé (sortie `out/audio-v2.wav`).
- `photos.py` : photos de sport dessinées en code (plus utilisées depuis l'arrivée de la vraie photo).
- `render.mjs` : pilote Chrome image par image et envoie les images à ffmpeg.
- `film-v1.html`, `audio-v1.py` : version 1 (45 s, anglais), gardée pour mémoire.

## Refaire le film

```bash
cd ~/Desktop/Reiz/design/film
python3 audio.py
node render.mjs video v 0 35 video-v.mp4
node render.mjs video h 0 35 video-h.mp4
/opt/homebrew/bin/ffmpeg -y -i out/video-v.mp4 -i out/audio-v2.wav -c:v libx264 -crf 19 -maxrate 16M -bufsize 32M -pix_fmt yuv420p -c:a aac -b:a 256k -shortest out/Reiz-film-9x16.mp4
```

Images fixes pour vérifier un plan : `node render.mjs stills v 12.5 20` (dans `out/stills/`).

## À remplacer pour la version finale

- Écrans reconstruits en HTML (valeurs de `src/styles.ts`) : par les enregistrements d'écran d'un compte démo.
- Rendus des niveaux de badge : exports d'au moins 1024 px (le bord droit des niveaux 2 à 6 a été reconstruit).
- Musique : provisoire. À remplacer par une composition ou une piste sous licence à 120 BPM
  (silences à 21,6 s et 31,8 s, impact des badges à 22,0 s).

## Version sur « Royalty Funk » (LXNGVX, Maestro Chives, NCS)

⚠ Publication soumise à une licence commerciale NCS (vidéo de marque) : https://ncs.io/usage-policy

- `audio-ncs.py` : montage du morceau (`music/royalty-funk.wav`) + sons d'interface transposés en sol mineur,
  la musique s'efface légèrement sous chaque son. Sortie `out/audio-ncs.wav` et `out/pulses.json`.
- Morceau : 80 BPM, sol mineur. Coup du drop à 46,565 s → 3,25 s dans le film (l'app apparaît),
  un temps de silence 21,25 → 22,0 s, le drop revient à 22,0 s (badges), coupure à 31,75 s, dernier coup à 32,5 s.
- `film.html` : la table `KEYS` cale chaque changement de plan sur un temps du morceau ; `PULSES` (collée depuis
  `out/pulses.json`) fait battre l'image sur les coups de basse. Durée 35,5 s.
- Rendus : `node render.mjs video v 0 35.5 video-v.mp4`, puis assemblage avec `out/audio-ncs.wav`
  → `out/Reiz-film-9x16-ncs.mp4` et `out/Reiz-film-16x9-ncs.mp4`.
- La version 120 BPM avec musique synthétisée reste reproductible avec `audio.py` et l'ancienne loi de temps (voir historique).
