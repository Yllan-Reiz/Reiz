#!/bin/bash
cd ~/Desktop/Reiz/design/instagram
for r in k10-reel:16 j15-reel:15; do n=${r%%:*}; d=${r##*:}; node render-reel.mjs semaine-2026-10-05/$n video 0 $d video.mp4 2>&1 | tail -1
 /opt/homebrew/bin/ffmpeg -y -loglevel error -i semaine-2026-10-05/$n/out/video.mp4 -i semaine-2026-10-05/$n/out/audio.wav -c:v libx264 -preset slow -crf 24 -maxrate 4M -bufsize 8M -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart semaine-2026-10-05/$n/out/reel.mp4; done
echo FINI
