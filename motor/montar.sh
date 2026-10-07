#!/bin/bash
# Pipeline inteiro de um projeto, do edl.json ao .mp4 final (formato do projeto.json, padrão 1080×1920; 30 fps, -14 LUFS, pico -1 dBTP).
#   bash montar.sh <pasta-do-projeto> [--so-mix]
# Etapas: base.py (cortes, quadros, voz) → render.mjs (compositor) → sfx.py → mix + loudnorm em 2 passadas → qa.py
# A saída sai em <projeto>/<saida>.mp4 (campo `saida` do projeto.json; padrão: nome da pasta).
set -euo pipefail
M="$(cd "$(dirname "$0")" && pwd)"
PY="$M/../.venv/bin/python"
P="$(cd "$1" && pwd)"
B="$P/_build"
SAIDA=$(python3 -c "import json,os,sys; c=json.load(open('$P/projeto.json')); print(c.get('saida') or os.path.basename('$P'))")
TRILHA=$(python3 -c "import json; c=json.load(open('$P/projeto.json')); print((c.get('edicao') or {}).get('trilha') or '')")

if [ "${2:-}" != "--so-mix" ]; then
  "$PY" "$M/base.py" "$P"
  node "$M/render.mjs" "$P"
fi
"$PY" "$M/sfx.py" "$P"

# voz já sai limpa e nivelada do base.py; aqui só compressão leve + SFX por baixo (+ trilha com ducking, se houver)
if [ -n "$TRILHA" ]; then
  T="$TRILHA"; [[ "$T" = ~* ]] && T="${T/#\~/$HOME}"; [[ "$T" != /* ]] && T="$P/$T"
  ffmpeg -y -v error -i "$B/voz.wav" -i "$B/sfx.wav" -stream_loop -1 -i "$T" -filter_complex \
    "[0:a]aresample=48000,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=150:makeup=2,asplit=2[v][vk];[1:a]volume=0.8[s];[2:a]aresample=48000,volume=-20dB[t0];[t0][vk]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[t];[v][s][t]amix=inputs=3:normalize=0:duration=first[m]" \
    -map "[m]" -ac 2 "$B/mix.wav"
else
  ffmpeg -y -v error -i "$B/voz.wav" -i "$B/sfx.wav" -filter_complex \
    "[0:a]aresample=48000,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=150:makeup=2[v];[1:a]volume=0.8[s];[v][s]amix=inputs=2:normalize=0[m]" \
    -map "[m]" -ac 2 "$B/mix.wav"
fi
J=$(ffmpeg -hide_banner -nostats -i "$B/mix.wav" -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
m() { echo "$J" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
if [ "$(m input_i)" = "-inf" ]; then  # sem som nenhum: não há o que nivelar
  ffmpeg -y -v error -i "$B/video.mp4" -i "$B/mix.wav" -map 0:v -map 1:a -c:v copy -ar 48000 -c:a aac -b:a 256k -movflags +faststart -shortest "$P/$SAIDA.mp4"
else
ffmpeg -y -v error -i "$B/video.mp4" -i "$B/mix.wav" -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=$(m input_i):measured_TP=$(m input_tp):measured_LRA=$(m input_lra):measured_thresh=$(m input_thresh):offset=$(m target_offset):linear=true" \
  -ar 48000 -c:a aac -b:a 256k -movflags +faststart -shortest "$P/$SAIDA.mp4"
fi
echo "  pronto: $P/$SAIDA.mp4"
"$PY" "$M/qa.py" "$P"
