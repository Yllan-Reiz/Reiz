#!/bin/bash
# usage: sheet.sh dossier  → out/planche.png (stills côte à côte)
d=$1; cd "$d/out/stills" && ls t*.png | sed "s/^/-i /" | xargs echo > /dev/null
n=$(ls t*.png | wc -l)
/opt/homebrew/bin/ffmpeg -y -loglevel error $(for f in t*.png; do echo -i $f; done) -filter_complex "$(for i in $(seq 0 $((n-1))); do echo -n "[$i:v]scale=360:-1[a$i];"; done)$(for i in $(seq 0 $((n-1))); do echo -n "[a$i]"; done)hstack=inputs=$n" -frames:v 1 ../planche.png
