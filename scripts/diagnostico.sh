#!/bin/bash
# Confere se tudo está pronto. Não mostra nenhuma senha nem chave (este projeto não usa nenhuma).
cd "$(dirname "$0")/.."
r=0
chk() { if eval "$2" >/dev/null 2>&1; then printf "  ✅ %s\n" "$1"; else printf "  ❌ %s  →  %s\n" "$1" "$3"; r=1; fi; }
echo "Diagnóstico do editor"
chk "ffmpeg" "command -v ffmpeg" "rode: bash scripts/setup.sh"
chk "node" "command -v node" "rode: bash scripts/setup.sh"
chk "python do projeto (.venv)" "test -x .venv/bin/python" "rode: bash scripts/setup.sh"
chk "numpy" ".venv/bin/python -c 'import numpy'" "rode: bash scripts/setup.sh"
chk "transcritor" ".venv/bin/python -c 'import mlx_whisper' || .venv/bin/python -c 'import faster_whisper'" "rode: bash scripts/setup.sh"
chk "Chromium do render" "node -e \"require('playwright').chromium.executablePath()\" && test -e \"\$(node -e \"console.log(require('playwright').chromium.executablePath())\")\"" "rode: npx playwright install chromium"
chk "detector de rosto" "test -x motor/_bin/rosto" "rode: bash scripts/setup.sh (pede as ferramentas da Apple)"
chk "espaço em disco (5 GB livres)" "test \$(df -g . | awk 'NR==2{print \$4}') -ge 5" "libere espaço: cada edição usa ~1 GB enquanto roda"
[ $r = 0 ] && echo "Tudo pronto." || echo "Falta algo acima. Cole este resultado no Claude que ele resolve com você."
exit $r
