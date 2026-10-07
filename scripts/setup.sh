#!/bin/bash
# Instala o que falta para o editor rodar neste Mac e confere tudo no fim.
# Rode da pasta do projeto: bash scripts/setup.sh
set -uo pipefail
cd "$(dirname "$0")/.."
ok() { printf "  ✅ %s\n" "$1"; }
falta() { printf "  ❌ %s\n" "$1"; }

echo "1 · Mac"
[ "$(uname -s)" = "Darwin" ] && ok "macOS $(sw_vers -productVersion) · chip $(uname -m)" || { falta "este editor roda em Mac por enquanto"; exit 1; }

echo "2 · Homebrew (instalador de programas)"
if ! command -v brew >/dev/null; then
  echo "  Instalando o Homebrew (vai pedir a senha do Mac)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
fi
command -v brew >/dev/null && ok "brew" || { falta "brew"; exit 1; }

echo "3 · ffmpeg, Node e Python"
for p in ffmpeg node python@3.12; do
  n=${p%@*}; [ "$n" = "python" ] && n=python3.12
  command -v "$n" >/dev/null || brew install "$p"
done
command -v ffmpeg >/dev/null && ok "ffmpeg" || falta "ffmpeg"
command -v node >/dev/null && ok "node $(node -v)" || falta "node"
PYBIN=$(command -v python3.12 || command -v python3)
ok "python $($PYBIN --version | cut -d' ' -f2)"

echo "4 · Transcritor local (seu áudio não sai do computador)"
[ -d .venv ] || "$PYBIN" -m venv .venv
.venv/bin/pip install -q --upgrade pip >/dev/null
.venv/bin/pip install -q -r requirements.txt && ok "transcritor e numpy" || falta "transcritor"

echo "5 · Navegador que desenha o vídeo"
npm install --silent >/dev/null 2>&1 && npx --yes playwright install chromium >/dev/null 2>&1 && ok "Chromium do render" || falta "Chromium do render"

echo "6 · Detector de rosto (recurso do próprio Mac)"
mkdir -p motor/_bin
if swiftc -O motor/rosto.swift -o motor/_bin/rosto 2>/dev/null; then ok "detector de rosto"; else
  echo "  Falta a ferramenta de linha de comando da Apple. Vai abrir uma janela: clique em Instalar e rode este setup de novo."
  xcode-select --install 2>/dev/null; falta "detector de rosto"; fi

echo ""
bash scripts/diagnostico.sh || exit 1

echo ""
echo "7 · Vídeo de teste (uns 30 segundos; na primeira vez baixa o modelo do transcritor, ~1,5 GB)"
if bash motor/montar.sh edicoes/exemplo > edicoes/exemplo/teste.log 2>&1; then
  ok "vídeo de teste pronto: edicoes/exemplo/exemplo-editado.mp4"
  grep "QA:" edicoes/exemplo/teste.log | sed 's/^ */  /'
else
  falta "o vídeo de teste falhou (detalhe em edicoes/exemplo/teste.log). Cole o fim desse arquivo no Claude."
fi
