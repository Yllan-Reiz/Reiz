#!/bin/bash
# usage: shots.sh dossier  → png/s1..s8.png + planche.png
d=$(cd "$1" && pwd); mkdir -p "$d/png"
for n in 1 2 3 4 5 6 7 8; do "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1080,1350 --virtual-time-budget=3000 --screenshot="$d/png/s$n.png" "file://$d/carrousel.html?s=$n" 2>/dev/null; done
/opt/homebrew/bin/ffmpeg -y -loglevel error $(for n in 1 2 3 4 5 6 7 8; do echo -i $d/png/s$n.png; done) -filter_complex "$(for i in 0 1 2 3 4 5 6 7; do echo -n "[$i:v]scale=360:-1[a$i];"; done)[a0][a1][a2][a3]hstack=4[r1];[a4][a5][a6][a7]hstack=4[r2];[r1][r2]vstack" -frames:v 1 "$d/planche.png"
