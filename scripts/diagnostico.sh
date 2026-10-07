#!/bin/bash
# Confere se tudo está pronto (Mac ou Windows). Não mostra nenhuma senha nem chave (este projeto não usa nenhuma).
cd "$(dirname "$0")/.."
PY=.venv/bin/python; [ -x "$PY" ] || PY=.venv/Scripts/python.exe
r=0
chk() { if eval "$2" >/dev/null 2>&1; then printf "  ✅ %s\n" "$1"; else printf "  ❌ %s  →  %s\n" "$1" "$3"; r=1; fi; }
echo "Diagnóstico do editor"
chk "ffmpeg" "command -v ffmpeg" "rode: bash scripts/setup.sh"
chk "node" "command -v node" "rode: bash scripts/setup.sh"
chk "python do projeto (.venv)" "test -x \"$PY\"" "rode: bash scripts/setup.sh"
chk "numpy" "\"$PY\" -c 'import numpy'" "rode: bash scripts/setup.sh"
chk "transcritor" "\"$PY\" -c 'import mlx_whisper' || \"$PY\" -c 'import faster_whisper'" "rode: bash scripts/setup.sh"
chk "leitor de links (yt-dlp)" "\"$PY\" -m yt_dlp --version" "rode: bash scripts/setup.sh"
chk "Chromium do render" "test -e \"\$(node -e \"console.log(require('playwright').chromium.executablePath())\")\"" "rode: npx playwright install chromium"
chk "detector de rosto" "test -x motor/_bin/rosto || \"$PY\" -c 'import cv2'" "rode: bash scripts/setup.sh"
chk "espaço em disco (5 GB livres)" "test \$(df -Pk . | awk 'NR==2{print \$4}') -ge 5000000" "libere espaço: cada edição usa ~1 GB enquanto roda"
[ $r = 0 ] && echo "Tudo pronto." || echo "Falta algo acima. Cole este resultado no Claude que ele resolve com você."
exit $r
