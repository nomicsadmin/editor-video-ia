#!/bin/bash
# Instala o que falta para o editor rodar e confere tudo no fim. Mac (Terminal) ou Windows (Git Bash, que vem com o Claude Code).
# Rode da pasta do projeto: bash scripts/setup.sh
set -uo pipefail
cd "$(dirname "$0")/.."
ok() { printf "  ✅ %s\n" "$1"; }
falta() { printf "  ❌ %s\n" "$1"; }
case "$(uname -s)" in
  Darwin) SO=mac ;;
  MINGW*|MSYS*|CYGWIN*) SO=windows ;;
  *) SO=outro ;;
esac

echo "1 · Computador"
if [ "$SO" = mac ]; then ok "macOS $(sw_vers -productVersion) · chip $(uname -m)"
elif [ "$SO" = windows ]; then ok "Windows (Git Bash)"
else falta "este editor roda em Mac e Windows"; exit 1; fi

if [ "$SO" = mac ]; then
  echo "2 · Homebrew (instalador de programas)"
  if ! command -v brew >/dev/null; then
    echo "  Instalando o Homebrew (vai pedir a senha do Mac)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
    [ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
  fi
  command -v brew >/dev/null && ok "brew" || { falta "brew"; exit 1; }
  echo "3 · ffmpeg, Node e Python"
  command -v ffmpeg >/dev/null || brew install ffmpeg
  command -v node >/dev/null || brew install node
  command -v python3.12 >/dev/null || brew install python@3.12
  PYBIN=$(command -v python3.12 || command -v python3)
else
  echo "2 · winget (instalador de programas do Windows)"
  WG="winget.exe"
  temtudo() { command -v ffmpeg >/dev/null && command -v node >/dev/null && { py -3.12 --version || python --version; } >/dev/null 2>&1; }
  if ! temtudo; then
    command -v "$WG" >/dev/null && ok "winget" || { falta "winget: atualize o 'Instalador de Aplicativo' na Microsoft Store"; exit 1; }
  else ok "ffmpeg, Node e Python já instalados"; fi
  echo "3 · ffmpeg, Node e Python"
  instala() { "$WG" install --id "$1" -e --silent --accept-source-agreements --accept-package-agreements >/dev/null 2>&1; }
  command -v ffmpeg >/dev/null || instala Gyan.FFmpeg
  command -v node >/dev/null || instala OpenJS.NodeJS.LTS
  { py -3.12 --version || python --version; } >/dev/null 2>&1 || instala Python.Python.3.12
  # o que o winget acabou de instalar só entra no PATH de janelas novas: acrescenta aqui para seguir sem reabrir
  LAD=$(cygpath "$LOCALAPPDATA" 2>/dev/null); PF=$(cygpath "$PROGRAMFILES" 2>/dev/null)
  export PATH="$PATH:$LAD/Microsoft/WinGet/Links:$PF/nodejs:$LAD/Programs/Python/Python312:$LAD/Programs/Python/Launcher"
  if py -3.12 --version >/dev/null 2>&1; then PYBIN="py -3.12"; else PYBIN="python"; fi
fi
command -v ffmpeg >/dev/null && ok "ffmpeg" || falta "ffmpeg (feche e abra o Claude Code e rode o setup de novo)"
command -v node >/dev/null && ok "node $(node -v)" || falta "node (feche e abra o Claude Code e rode o setup de novo)"
$PYBIN --version >/dev/null 2>&1 && ok "python $($PYBIN --version 2>&1 | cut -d' ' -f2)" || { falta "python (feche e abra o Claude Code e rode o setup de novo)"; exit 1; }

echo "4 · Transcritor local (seu áudio não sai do computador)"
[ -d .venv ] || $PYBIN -m venv .venv
PY=.venv/bin/python; [ -x "$PY" ] || PY=.venv/Scripts/python.exe
"$PY" -m pip install -q --upgrade pip >/dev/null 2>&1
"$PY" -m pip install -q -r requirements.txt && ok "transcritor, leitor de links e numpy" || falta "transcritor"

echo "5 · Navegador que desenha o vídeo"
npm install --silent >/dev/null 2>&1 && npx --yes playwright install chromium >/dev/null 2>&1 && ok "Chromium do render" || falta "Chromium do render"

echo "6 · Detector de rosto"
if [ "$SO" = mac ]; then
  mkdir -p motor/_bin
  if swiftc -O motor/rosto.swift -o motor/_bin/rosto 2>/dev/null; then ok "detector de rosto (Vision da Apple)"
  else ok "detector de rosto (OpenCV; o da Apple pede as ferramentas de linha de comando: xcode-select --install)"
       "$PY" -m pip install -q "opencv-python-headless>=4.10,<5" >/dev/null 2>&1; fi
else ok "detector de rosto (OpenCV)"; fi

echo ""
bash scripts/diagnostico.sh || exit 1

echo ""
echo "7 · Vídeo de teste (na primeira vez baixa o modelo do transcritor, ~1,5 GB)"
if bash motor/montar.sh edicoes/exemplo > edicoes/exemplo/teste.log 2>&1; then
  ok "vídeo de teste pronto: edicoes/exemplo/exemplo-editado.mp4"
  grep "QA:" edicoes/exemplo/teste.log | sed 's/^ */  /'
else
  falta "o vídeo de teste falhou (detalhe em edicoes/exemplo/teste.log). Cole o fim desse arquivo no Claude."
  tail -20 edicoes/exemplo/teste.log
  exit 1
fi
