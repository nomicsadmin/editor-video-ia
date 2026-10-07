#!/usr/bin/env python3
"""
Etapa 1 · inventário e leitura do bruto.

Para cada bruto declarado em <projeto>/projeto.json:
  - mede (ffprobe: duração, resolução já girada, fps)
  - transcreve com MLX Whisper, palavra a palavra, com cache (só retranscreve se o
    arquivo mudou de tamanho/data) → <projeto>/transcricoes/<id>.json
  - gera a folha de contato (1 quadro a cada 2 s) → <projeto>/qa/bruto-<id>.jpg
e escreve <projeto>/leitura.md: a transcrição em frases com [início-fim], quebrando
em pausas ≥ 0,5 s, que é o que o modelo lê para decidir os cortes (o modelo
lê isso para decidir os cortes).

Uso:  python3 preparar.py <pasta-do-projeto>
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
VENV_PY = os.path.join(RAIZ, ".venv", "bin", "python")
TRANSCREVER = os.path.join(RAIZ, "motor", "transcrever.py")
PAUSA = 0.5


def caminho(p):
    return os.path.expanduser(p) if p.startswith("~") else (p if os.path.isabs(p) else os.path.join(RAIZ, p))


def medir(arq):
    d = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate:stream_side_data=rotation:format=duration",
         "-of", "json", arq], capture_output=True, text=True, check=True).stdout)
    st = d["streams"][0]
    w, h = st["width"], st["height"]
    rot = 0
    for sd in st.get("side_data_list", []) or []:
        rot = abs(int(sd.get("rotation", 0) or 0))
    if rot in (90, 270):
        w, h = h, w
    n, dnm = st["r_frame_rate"].split("/")
    return {"duracao": round(float(d["format"]["duration"]), 3), "largura": w, "altura": h,
            "fps": round(int(n) / max(int(dnm), 1), 2)}


def transcrever(arq, destino_base):
    js = destino_base + ".json"
    marca = destino_base + ".fonte"
    assinatura = f"{os.path.getsize(arq)}:{int(os.path.getmtime(arq))}"
    if os.path.exists(js) and os.path.exists(marca) and open(marca).read().strip() == assinatura:
        return json.load(open(js)), True
    subprocess.run([VENV_PY, TRANSCREVER, arq, destino_base], check=True, capture_output=True)
    open(marca, "w").write(assinatura)
    return json.load(open(js)), False


def palavras(tr):
    out = []
    for s in tr.get("segments", []):
        for w in s.get("words", []):
            out.append({"w": w["word"].strip(), "s": round(w["start"], 2), "e": round(w["end"], 2)})
    return out


def rosto(arq, dur):
    """Mediana da caixa do rosto (Vision, local) em quadros a cada ~8 s. None se não houver rosto."""
    binario = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_bin", "rosto")
    if not os.path.exists(binario):
        os.makedirs(os.path.dirname(binario), exist_ok=True)
        subprocess.run(["swiftc", "-O", os.path.join(os.path.dirname(os.path.abspath(__file__)), "rosto.swift"), "-o", binario],
                       check=True, capture_output=True)
    tmp = tempfile.mkdtemp(prefix="rosto-")
    try:
        passo = max(2.0, dur / 14)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", arq, "-vf",
                        f"fps=1/{passo:.2f},scale=540:960:force_original_aspect_ratio=increase,crop=540:960", "-q:v", "3",
                        os.path.join(tmp, "%03d.jpg")], check=True)
        d = json.loads(subprocess.run([binario, tmp], capture_output=True, text=True, check=True).stdout)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if d["com_rosto"] < max(2, d["quadros"] // 3):
        return None
    m = d["mediana"]
    return {"cx": round((m["x0"] + m["x1"]) / 2, 3), "cy": round((m["y0"] + m["y1"]) / 2, 3),
            "topo": round(m["y0"], 3), "queixo": round(m["y1"], 3), "quadros": d["quadros"], "com_rosto": d["com_rosto"]}


def frases(ws):
    blocos, cur = [], []
    for w in ws:
        if cur and (w["s"] - cur[-1]["e"] >= PAUSA or cur[-1]["w"][-1:] in ".?!"):
            blocos.append(cur)
            cur = []
        cur.append(w)
    if cur:
        blocos.append(cur)
    return blocos


def folha(arq, dur, destino):
    passo = 2 if dur <= 160 else 4
    n = int(dur // passo) + 1
    cols = 10
    lin = (n + cols - 1) // cols
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", arq, "-vf",
                    f"fps=1/{passo},scale=180:-2,tile={cols}x{lin}",
                    "-frames:v", "1", "-q:v", "4", destino], check=False)


def main():
    proj = os.path.abspath(sys.argv[1])
    cfg = json.load(open(os.path.join(proj, "projeto.json"), encoding="utf-8"))
    os.makedirs(os.path.join(proj, "transcricoes"), exist_ok=True)
    os.makedirs(os.path.join(proj, "qa"), exist_ok=True)

    linhas = [f"# Leitura do bruto · {cfg.get('titulo', os.path.basename(proj))}", "",
              "> Gerado por `preparar.py`. Frases quebradas em pausas ≥ 0,5 s. Tempos em segundos do bruto.",
              "> Uma linha por frase (quebra em pausa ≥ 0,5 s ou em ponto final). `⏸ 1,2 s` = silêncio ≥ 0,3 s antes da frase (candidato a corte).",
              "> `⟨61.9–64.7 esticada⟩` = palavra com mais de 0,8 s: quase sempre esconde hesitação (\"é...\"). Corte com `skip` no tempo. Tempo de cada palavra: `transcricoes/<id>.palavras.json`.", f"> Folha de contato de cada bruto (1 quadro a cada 2 s): `qa/bruto-<id>.jpg`.", ""]
    for b in cfg["brutos"]:
        arq = caminho(b["arquivo"])
        m = medir(arq)
        b.update(m)
        if m["altura"] > m["largura"]:
            b["rosto"] = rosto(arq, m["duracao"])
        tr, do_cache = transcrever(arq, os.path.join(proj, "transcricoes", b["id"]))
        ws = palavras(tr)
        json.dump(ws, open(os.path.join(proj, "transcricoes", b["id"] + ".palavras.json"), "w"), ensure_ascii=False)
        folha(arq, m["duracao"], os.path.join(proj, "qa", f"bruto-{b['id']}.jpg"))
        fr = frases(ws)
        fala = sum(f[-1]["e"] - f[0]["s"] for f in fr)
        ritmo = len(ws) / fala if fala else 0
        linhas += [f"## {b['id']} · {os.path.basename(arq)}",
                   f"{m['duracao']:.1f} s · {m['largura']}×{m['altura']} · {m['fps']} fps · {len(ws)} palavras · "
                   f"fala {fala:.1f} s ({ritmo:.2f} pal/s) · transcrição {'do cache' if do_cache else 'nova'}"
                   + (f" · rosto em x {b['rosto']['cx']:.2f}, queixo a {b['rosto']['queixo'] * 100:.0f}% da altura" if b.get("rosto") else ""), ""]
        ant = None
        for f in fr:
            if ant is not None and f[0]["s"] - ant >= 0.3:
                linhas.append(f"⏸ {f[0]['s'] - ant:.1f} s")
            linhas.append(f"[{f[0]['s']:7.2f}–{f[-1]['e']:7.2f}] " + " ".join(
                w["w"] + (f"⟨{w['s']:.1f}–{w['e']:.1f} esticada⟩" if w["e"] - w["s"] > 0.8 else "") for w in f))
            ant = f[-1]["e"]
        linhas.append("")
        print(f"  {b['id']}: {m['duracao']:.1f} s, {len(ws)} palavras, {len(fr)} frases ({'cache' if do_cache else 'transcrito'})")

    json.dump(cfg, open(os.path.join(proj, "projeto.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(os.path.join(proj, "leitura.md"), "w", encoding="utf-8").write("\n".join(linhas))
    print(f"  leitura: {os.path.join(proj, 'leitura.md')}")


if __name__ == "__main__":
    main()
