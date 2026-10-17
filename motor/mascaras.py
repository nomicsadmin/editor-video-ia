#!/usr/bin/env python3
"""Texto atrás da pessoa · etapa da máscara.
   python3 mascaras.py <pasta-do-projeto>
1. Recorta a pessoa em cada quadro de _build/f com o Vision do macOS (mascara.swift, local), na resolução
   cheia → _build/m/bruta/.
2. Refina a borda (03/Out, "bugado no meu cabelo"): o recorte do Vision é esfumaçado no cabelo, e a letra
   aparecia como névoa por cima dele. Suaviza 1 quadro para cada lado (tira o tremido, sem atravessar corte),
   passa um filtro guiado pelo PRÓPRIO quadro (a borda vai para o contorno real do cabelo) e uma curva suave
   (nítida sem serrilhar) → _build/m/NNNNN.png (alfa = pessoa).
3. Grava _build/m/topo.json com, por quadro: topo da cabeça, centro da cabeça (x) e luz da parede acima dela.
Cache: só refaz o que mudou (o base.py regrava os quadros a cada corte)."""
import json, os, subprocess, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.realpath(__file__))
RAIO, EPS, CURVA = 4, 4e-5, (0.15, 0.85)


def box(a, r):
    c = np.cumsum(np.cumsum(np.pad(a, ((r + 1, r), (r + 1, r)), mode="edge"), 0, dtype=np.float64), 1)
    return ((c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]) / (2 * r + 1) ** 2).astype(np.float32)


def guiado(I, p, r, eps):
    mI, mp = box(I, r), box(p, r)
    a = (box(I * p, r) - mI * mp) / (box(I * I, r) - mI * mI + eps)
    b = mp - a * mI
    return box(a, r) * I + box(b, r)


def bruta(M, i):
    return np.asarray(Image.open(os.path.join(M, "bruta", f"{i:05d}.png")).getchannel("A"), np.float32) / 255


def refinar(job):
    F, M, i, viz = job[:4]
    recorte = job[4] if len(job) > 4 else False
    out = os.path.join(M, f"{i:05d}.png")
    m = bruta(M, i)
    if viz:   # vizinhos com peso pela distância (±1 vale 2× o ±2): a borda não treme de um quadro para o outro
        pes = [1.0 / abs(j - i) for j in viz]
        m = 0.5 * m + sum(0.5 * w / sum(pes) * bruta(M, j) for w, j in zip(pes, viz))
    q = np.asarray(Image.open(os.path.join(F, f"{i:05d}.jpg")).convert("RGB"), np.float32) / 255
    I = q @ np.array([0.299, 0.587, 0.114], np.float32)
    g = np.clip(guiado(I, m, RAIO, EPS), 0, 1)
    x = np.clip((g - CURVA[0]) / (CURVA[1] - CURVA[0]), 0, 1); x = x * x * (3 - 2 * x)
    a = (x * 255 + 0.5).astype(np.uint8)
    Image.merge("LA", (Image.new("L", (a.shape[1], a.shape[0]), 255), Image.fromarray(a))).save(out, compress_level=1)
    if recorte:
        # 12/Out · recorte da pessoa por cima da tela (3ª camada): a borda do cabelo misturada com o teto claro vira halo
        # sobre fundo escuro. Curva mais fechada + 1 px de erosão (mínimo 3×3) tiram o halo sem serrilhar.
        y = np.clip((g - 0.3) / 0.6, 0, 1); y = y * y * (3 - 2 * y)
        y = np.minimum.reduce([np.pad(y, 1, mode="edge")[dy:dy + y.shape[0], dx:dx + y.shape[1]] for dy in range(3) for dx in range(3)])
        r = (y * 255 + 0.5).astype(np.uint8)
        os.makedirs(os.path.join(M, "recorte"), exist_ok=True)
        Image.merge("LA", (Image.new("L", (r.shape[1], r.shape[0]), 255), Image.fromarray(r))).save(os.path.join(M, "recorte", f"{i:05d}.png"), compress_level=1)
    return i


def medir(M, F, i, ant):
    m = np.asarray(Image.open(os.path.join(M, f"{i:05d}.png")).getchannel("A"), np.float32)[::8, ::8] / 255  # 1/8 do quadro (240×135 no vertical, 135×240 no 16:9)
    linhas = np.where((m > 0.5).sum(1) >= 3)[0]
    if not len(linhas): return ant
    topo = int(linhas[0]); h = m.shape[0]
    cab = m[topo:topo + int(0.12 * h)]
    cx = float((cab.sum(0) * np.arange(m.shape[1])).sum() / max(cab.sum(), 1)) / m.shape[1]
    im = Image.open(os.path.join(F, f"{i:05d}.jpg")); im.draft("L", (270, 480)); g = np.asarray(im.convert("L").resize((m.shape[1], m.shape[0])), np.float32) / 255
    y0 = max(0, topo - int(0.2 * h)); faixa, mf = g[y0:topo + 1], m[y0:topo + 1]
    luz = float(faixa[mf < 0.2].mean()) if (mf < 0.2).any() else ant[2]
    return (round(topo / h, 4), round(cx, 4), round(luz, 3))


if __name__ == "__main__":
    # --so 0-12.3,72-79.7 → só esses trechos (segundos do vídeo final) · --recorte → grava também _build/m/recorte/ (3ª camada)
    ARGS = sys.argv[2:]
    SO = [tuple(float(v) for v in r.split("-")) for r in ARGS[ARGS.index("--so") + 1].split(",")] if "--so" in ARGS else None
    RECORTE = "--recorte" in ARGS
    PROJ = os.path.abspath(sys.argv[1]); B = os.path.join(PROJ, "_build")
    F, M = os.path.join(B, "f"), os.path.join(B, "m")
    BIN = os.path.join(AQUI, "_bin", "mascara")
    if not os.path.exists(BIN) or os.path.getmtime(BIN) < os.path.getmtime(os.path.join(AQUI, "mascara.swift")):
        os.makedirs(os.path.dirname(BIN), exist_ok=True)
        subprocess.run(["swiftc", "-O", os.path.join(AQUI, "mascara.swift"), "-o", BIN], check=True)
    _q = Image.open(os.path.join(F, sorted(f for f in os.listdir(F) if f.endswith(".jpg"))[0])); QW, QH = _q.size   # 17/Out: tamanho real do quadro (16:9 ou 9:16)
    n = len([f for f in os.listdir(F) if f.endswith(".jpg")])
    QS = set(range(1, n + 1)) if not SO else {i for i in range(1, n + 1) if any(a <= (i - 1) / 30 <= b for a, b in SO)}
    if SO:   # só os quadros pedidos: pasta de atalhos com os mesmos nomes (o Vision grava a máscara com o nome do quadro)
        import tempfile
        tmp = tempfile.mkdtemp(prefix="masc-")
        for i in sorted(QS): os.symlink(os.path.join(F, f"{i:05d}.jpg"), os.path.join(tmp, f"{i:05d}.jpg"))
        subprocess.run([BIN, tmp, os.path.join(M, "bruta"), str(QW), str(QH)], check=True)
    else:
        subprocess.run([BIN, F, os.path.join(M, "bruta"), str(QW), str(QH)], check=True)
    # vizinho só dentro do mesmo pedaço contínuo do bruto (nunca mistura os dois lados de um corte)
    pedaco = {}
    tl = json.load(open(os.path.join(B, "timeline.json")))
    for k, s in enumerate(tl["segs"]):
        for i in range(s["f0"], s["f0"] + s["n"]): pedaco[i] = k
    def viz(i): return [j for j in ((i - 2, i - 1, i + 1, i + 2) if RECORTE else (i - 1, i + 1)) if j in QS and pedaco.get(j) == pedaco.get(i)]
    def velho(i):
        o = os.path.join(M, f"{i:05d}.png")
        if RECORTE and not os.path.exists(os.path.join(M, "recorte", f"{i:05d}.png")): return True
        return not os.path.exists(o) or os.path.getmtime(o) < max(os.path.getmtime(os.path.join(M, "bruta", f"{j:05d}.png")) for j in [i] + viz(i))
    jobs = [(F, M, i, viz(i), RECORTE) for i in sorted(QS) if velho(i)]
    if jobs:
        with Pool(max(2, (os.cpu_count() or 4) - 2)) as p:
            for k, _ in enumerate(p.imap_unordered(refinar, jobs, chunksize=8), 1):
                if k % 300 == 0: print(f"  borda refinada: {k}/{len(jobs)}")
    print(f"  bordas refinadas: {len(jobs)} novas")

    out, ant = [], (0.33, 0.5, 0.2)
    for i in range(1, n + 1):
        if i in QS: ant = medir(M, F, i, ant)
        out.append(ant)
    json.dump({"campos": ["topo", "cx", "luz"], "q": out}, open(os.path.join(M, "topo.json"), "w"))
    tp = np.array([o[0] for o in out]); lz = np.array([o[2] for o in out])
    print(f"  topo da cabeça: mediana {np.median(tp)*100:.0f}% da altura (mín {tp.min()*100:.0f}%) · parede acima: luz {np.median(lz):.2f} → texto {'escuro' if np.median(lz) > 0.5 else 'claro'}")
