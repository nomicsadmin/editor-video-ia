#!/usr/bin/env python3
"""
Lê um vídeo de referência e mede o que dá para medir, para o Claude olhar junto:
  - duração, formato, de quanto em quanto tempo corta (troca de cena detectada no próprio vídeo)
  - folha de contato (1 quadro por segundo) e um quadro logo depois de cada corte
  - quantas palavras por segundo a pessoa fala (se tiver fala)

Uso:  <python do projeto> motor/referencia.py <arquivo-ou-link> <pasta-de-saida>
Link (Instagram, TikTok, YouTube): baixa sozinho. Se o site pedir login, usa o login do navegador da pessoa
neste computador (nada sai da máquina). Na primeira vez o Mac pode pedir a senha do Chaveiro: é normal.
Saída: <pasta>/ficha.json, <pasta>/folha.jpg, <pasta>/cortes.jpg
"""
import json
import os
import re
import shutil
import subprocess
import sys

M = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(M, ".."))
ent, OUT = sys.argv[1], os.path.abspath(sys.argv[2])
os.makedirs(OUT, exist_ok=True)

def baixar(link):
    """Baixa o vídeo do link. Tenta sem login; se o site pedir (Instagram quase sempre pede), usa sozinho o login
    do navegador da própria pessoa, só neste computador: Chrome primeiro, depois Firefox. O Chrome aberto trava o
    banco de cookies, então lê de uma cópia temporária que é apagada logo depois."""
    YTDLP = [sys.executable, "-m", "yt_dlp"]  # instalado no python do projeto (requirements.txt), Mac e Windows
    alvo = os.path.join(OUT, "referencia.%(ext)s")
    tentativas = [[]]
    chrome = os.path.expanduser("~/Library/Application Support/Google/Chrome")
    if sys.platform == "darwin":
        if os.path.exists(os.path.join(chrome, "Default", "Cookies")):
            tentativas.append(("chrome", os.path.join(OUT, "_chrome")))
        if os.path.isdir(os.path.expanduser("~/Library/Application Support/Firefox")):
            tentativas.append(["--cookies-from-browser", "firefox"])
    else:  # Windows: o Firefox funciona sempre; Chrome e Edge às vezes protegem o login e o yt-dlp não consegue ler
        tentativas += [["--cookies-from-browser", n] for n in ("firefox", "chrome", "edge")]
    for t in tentativas:
        extra = t
        if isinstance(t, tuple):
            os.makedirs(os.path.join(t[1], "Default"), exist_ok=True)
            shutil.copy(os.path.join(chrome, "Default", "Cookies"), os.path.join(t[1], "Default", "Cookies"))
            shutil.copy(os.path.join(chrome, "Local State"), os.path.join(t[1], "Local State"))
            extra = ["--cookies-from-browser", f"chrome:{t[1]}"]
        r = subprocess.run([*YTDLP, "-q", "--no-warnings", *extra, "-f", "mp4/best", "-o", alvo, link], capture_output=True, text=True)
        if isinstance(t, tuple):
            shutil.rmtree(t[1], ignore_errors=True)
        achados = [f for f in os.listdir(OUT) if f.startswith("referencia.") and not f.endswith(".part")]
        if r.returncode == 0 and achados:
            return os.path.join(OUT, achados[0])
    sys.exit("Não consegui baixar esse link (o post pode ser privado ou o navegador não está logado). "
             "Peça o arquivo do vídeo (o Instagram deixa baixar) ou 3 prints.")


if re.match(r"https?://", ent):
    ent = baixar(ent)

pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                "stream=width,height:format=duration", "-of", "json", ent], capture_output=True, text=True).stdout)
dur = float(pr["format"]["duration"]); w, h = pr["streams"][0]["width"], pr["streams"][0]["height"]

# trocas de cena: quadro muito diferente do anterior = corte
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", ent, "-vf", "scale=270:-2,select='gt(scene,0.32)',showinfo", "-an", "-f", "null", "-"],
                   capture_output=True, text=True)
cortes = [round(float(t), 2) for t in re.findall(r"pts_time:([\d.]+)", r.stderr)]
cortes = [c for i, c in enumerate(cortes) if i == 0 or c - cortes[i - 1] > 0.25]
blocos = [b - a for a, b in zip([0] + cortes, cortes + [dur])]

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", ent, "-vf", f"fps=1,scale=200:-2,tile=8x{int(dur // 8) + 1}", "-frames:v", "1",
                "-q:v", "4", os.path.join(OUT, "folha.jpg")])
if cortes:
    filtro = "+".join(f"between(t\\,{c + 0.1:.2f}\\,{c + 0.14:.2f})" for c in cortes[:40])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", ent, "-vf", f"select='{filtro}',scale=200:-2,tile=8x{(min(40, len(cortes)) + 7) // 8}",
                    "-frames:v", "1", "-fps_mode", "vfr", "-q:v", "4", os.path.join(OUT, "cortes.jpg")])

fala = None
py = sys.executable
if True:
    base = os.path.join(OUT, "fala")
    subprocess.run([py, os.path.join(M, "transcrever.py"), ent, base], capture_output=True, env={**os.environ, "EDITOR_IDIOMA": "auto"})
    if os.path.exists(base + ".json"):
        ws = [x for s in json.load(open(base + ".json"))["segments"] for x in s.get("words", [])]
        if len(ws) > 10:
            tempo = sum(s["end"] - s["start"] for s in json.load(open(base + ".json"))["segments"])
            fala = {"palavras": len(ws), "palavras_por_s": round(len(ws) / max(tempo, 1), 2)}

ficha = {
    "arquivo": ent, "duracao_s": round(dur, 1), "formato": f"{w}×{h}", "vertical": h > w,
    "cortes": len(cortes), "corta_a_cada_s": round(dur / (len(cortes) + 1), 2),
    "bloco_mais_curto_s": round(min(blocos), 2), "bloco_mais_longo_s": round(max(blocos), 2),
    "tempos_dos_cortes": cortes, "fala": fala,
    "olhe": ["folha.jpg (1 quadro por segundo)", "cortes.jpg (logo depois de cada corte)"],
}
json.dump(ficha, open(os.path.join(OUT, "ficha.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in ficha.items() if k != "tempos_dos_cortes"}, ensure_ascii=False, indent=1))
