#!/usr/bin/env python3
"""
Acha onde está um trecho de texto num print e devolve a "area" pronta para o cenas.json (marca-texto ou caixa do
efeito "print"): [x, y, largura, altura] em fração da imagem; trecho que quebra de linha volta como uma área por linha.
Mac: lê o texto com o Vision da Apple (local). Windows: não há leitor de texto embutido; olhe o print e estime a área
(a IA faz isso olhando a imagem) ou use --grade para gerar o print com uma grade de 10% por cima.
Uso:  <python do projeto> motor/achar_texto.py <print.png> "o trecho dito"
      <python do projeto> motor/achar_texto.py <print.png> --grade   → <print>-grade.png
"""
import _utf8  # noqa: F401 (Windows em UTF-8)
import json
import os
import shutil
import subprocess
import sys
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
img, alvo = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "")


def grade():
    from PIL import Image, ImageDraw
    im = Image.open(img).convert("RGB")
    d = ImageDraw.Draw(im)
    w, h = im.size
    for k in range(1, 10):
        d.line([(w * k / 10, 0), (w * k / 10, h)], fill=(255, 0, 80), width=max(1, w // 600))
        d.line([(0, h * k / 10), (w, h * k / 10)], fill=(255, 0, 80), width=max(1, w // 600))
        d.text((w * k / 10 + 4, 4), f"{k / 10:.1f}", fill=(255, 0, 80))
        d.text((4, h * k / 10 + 4), f"{k / 10:.1f}", fill=(255, 0, 80))
    saida = os.path.splitext(img)[0] + "-grade.png"
    im.save(saida)
    print(saida)


if alvo == "--grade":
    grade()
    sys.exit(0)
if sys.platform != "darwin" or not shutil.which("swiftc"):
    sys.exit("Sem leitor de texto neste computador (só no Mac). Olhe o print e estime a área, ou rode com --grade.")
BIN = os.path.join(AQUI, "_bin", "texto")
if not os.path.exists(BIN) or os.path.getmtime(BIN) < os.path.getmtime(os.path.join(AQUI, "texto.swift")):
    os.makedirs(os.path.dirname(BIN), exist_ok=True)
    subprocess.run(["swiftc", "-O", os.path.join(AQUI, "texto.swift"), "-o", BIN], check=True)
# print alto (página inteira): o leitor reduz a imagem e perde o texto miúdo. Lê em fatias de ~1,3× a largura, com
# sobra entre elas, e devolve tudo em fração da imagem inteira.
from PIL import Image
import tempfile
im = Image.open(img).convert("RGB")
W0, H0 = im.size
alt = int(W0 * 1.3)
P, vistos, base = [], set(), 0
tmp = tempfile.mkdtemp(prefix="texto-")
y0 = 0
while True:
    y1 = min(H0, y0 + alt)
    arq = os.path.join(tmp, "fatia.png")
    im.crop((0, y0, W0, y1)).save(arq)
    d = json.loads(subprocess.run([BIN, arq], capture_output=True, text=True, check=True).stdout)
    linhas = {}
    for p in d["palavras"]:
        bx, by, bw, bh = p["b"]
        yy = (y0 + by * (y1 - y0)) / H0
        chave = (p["t"], round(bx, 2), round(yy, 3))
        if any(abs(yy - v[2]) < 0.002 and v[0] == p["t"] and abs(bx - v[1]) < 0.01 for v in vistos):
            continue
        vistos.add(chave)
        P.append({"t": p["t"], "l": base + p["l"], "b": [bx, yy, bw, bh * (y1 - y0) / H0]})
        linhas[p["l"]] = 1
    base += 10000
    if y1 >= H0:
        break
    y0 = y1 - int(alt * 0.2)
shutil.rmtree(tmp, ignore_errors=True)


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(ch for ch in s if ch.isalnum())


busca = [norm(w) for w in alvo.split() if norm(w)]
if not busca:
    print(json.dumps({"w": W0, "h": H0, "palavras": P}, ensure_ascii=False)[:4000])
    sys.exit(0)
# linhas (cada uma do jeito que o leitor viu) e, para cada linha, a que vem logo abaixo dela na mesma coluna
L = {}
for p in P:
    L.setdefault(p["l"], []).append(p)
linhas = list(L.values())
for ln in linhas:
    ln.sort(key=lambda p: p["b"][0])


def caixa(ws):
    x0 = min(w["b"][0] for w in ws); y0 = min(w["b"][1] for w in ws)
    x1 = max(w["b"][0] + w["b"][2] for w in ws); y1 = max(w["b"][1] + w["b"][3] for w in ws)
    return [x0, y0, x1 - x0, y1 - y0]


CX = [caixa(ln) for ln in linhas]


def abaixo(k):
    x, y, w, h = CX[k]
    melhor = None
    for j, (x2, y2, w2, h2) in enumerate(CX):
        if j == k or y2 <= y + h * 0.5 or y2 - (y + h) > h * 1.6:
            continue
        if min(x + w, x2 + w2) - max(x, x2) <= 0:   # precisa estar na mesma coluna
            continue
        if melhor is None or y2 < CX[melhor][1]:
            melhor = j
    return melhor


def casa(k, i, q):
    """tenta casar a busca q começando na palavra i da linha k; devolve a lista de (linha, palavras) ou None"""
    usadas = []
    while q:
        ln = linhas[k]
        pega = []
        while q and i < len(ln):
            w = norm(ln[i]["t"])
            if not w:
                i += 1
                continue
            if w == q[0] or (len(q) == 1 and w.startswith(q[0])):
                pega.append(ln[i]); q = q[1:]; i += 1
            else:
                return None
        usadas.append(pega)
        if q:
            k = abaixo(k)
            if k is None:
                return None
            i = 0
    return usadas


achados = []
for k, ln in enumerate(linhas):
    for i in range(len(ln)):
        r = casa(k, i, busca)
        if r:
            areas = [[round(v, 4) for v in caixa(ws)] for ws in r if ws]
            achados.append(areas[0] if len(areas) == 1 else areas)
if not achados:
    sys.exit(f'Não achei "{alvo}" no print (o leitor viu {len(P)} palavras). Tente um pedaço mais curto do trecho.')
for a in achados:
    print(json.dumps(a))
