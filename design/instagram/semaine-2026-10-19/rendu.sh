#!/bin/bash
cd ~/Desktop/Reiz/design/instagram
for n in l19-reel v23-reel; do D=semaine-2026-10-19/$n/out
 node render-reel.mjs semaine-2026-10-19/$n video 0 16.2 video.mp4 2>&1 | tail -1
 /opt/homebrew/bin/ffmpeg -y -loglevel error -i $D/video.mp4 -i $D/audio.wav -c:v libx264 -preset slow -crf 24 -maxrate 4M -bufsize 8M -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart $D/$n-sons.mp4
 ls -la $D/$n-sons.mp4; done
echo FINI
