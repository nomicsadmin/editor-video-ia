#!/usr/bin/env python3
"""
Etapa 3 · a base do vídeo a partir da lista de cortes (<projeto>/edl.json).

O que ele faz:
  - cada trecho é quebrado nas pausas internas maiores que `gapmax` (a pausa sai)
  - a borda de cada pedaço é ajustada no SILÊNCIO REAL do áudio (função snap): a
    transcrição costuma marcar fim de palavra cedo e o corte comia sílaba
  - nunca corta dentro de palavra; folga de 40–60 ms nas bordas; fade de 12 ms
  - extrai os quadros no formato do projeto (padrão 1080×1920) a 30 fps (cobrir = recorta; conter = cabe inteiro)
  - nivela a voz trecho a trecho pela fala, limpa ruído, aplica bips de privacidade
  - grava _build/timeline.json com as palavras JÁ no tempo do vídeo final

Uso:  python3 base.py <pasta-do-projeto>
"""
import json
import os
import re
import shutil
import subprocess
import sys
import wave

import numpy as np

FPS, SR = 30, 48000
PROJ = os.path.abspath(sys.argv[1])
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CFG = json.load(open(os.path.join(PROJ, "projeto.json"), encoding="utf-8"))
# formato do quadro: padrão 1080×1920 (vertical). Horizontal: "formato": {"largura": 1920, "altura": 1080}
FMT = CFG.get("formato") or {}
W, H = int(FMT.get("largura", 1080)), int(FMT.get("altura", 1920))
OUT = os.path.join(PROJ, "_build")
shutil.rmtree(os.path.join(OUT, "f"), ignore_errors=True)
os.makedirs(os.path.join(OUT, "f"), exist_ok=True)

EDL = json.load(open(os.path.join(PROJ, "edl.json"), encoding="utf-8"))

BRUTO = {}
for b in CFG["brutos"]:
    p = b["arquivo"]
    BRUTO[b["id"]] = os.path.expanduser(p) if p.startswith("~") else (p if os.path.isabs(p) else os.path.join(RAIZ, p))

# ---------------------------------------------------------------- palavras e correções
GLOS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "glossario.json"), encoding="utf-8"))
FIX = {**GLOS["fix"], **EDL.get("fix", {})}
JUNTAR = [tuple(j) for j in GLOS["juntar"]] + [tuple(j) for j in EDL.get("juntar", [])]
BIPS = set(EDL.get("bips", []))
CACHE = {}


def palavras(bid):
    if bid not in CACHE:
        ws = json.load(open(os.path.join(PROJ, "transcricoes", bid + ".palavras.json"), encoding="utf-8"))
        m = []
        for w in ws:  # junta pedaços que o Whisper separa: "5" ".5", "2" "%", "click" "-up"
            if m and (w["w"][:1] in "-.%" and len(w["w"]) > 1 or re.fullmatch(r"\.\d+", w["w"])):
                m[-1]["w"] += w["w"]; m[-1]["e"] = w["e"]
            else:
                m.append(dict(w))
        j = []
        for w in m:
            base = re.sub(r"[.,!?…:;]+$", "", w["w"]).lower()
            feito = False
            for a, b, junto in JUNTAR:
                if j and re.sub(r"[.,!?…:;]+$", "", j[-1]["w"]).lower() == a.lower() and base.startswith(b.lower()):
                    cauda = w["w"][len(b):] if w["w"].lower().startswith(b.lower()) else ""
                    j[-1]["w"] = junto + cauda; j[-1]["e"] = w["e"]; feito = True
                    break
            if not feito:
                j.append(w)
        CACHE[bid] = j
    return CACHE[bid]


COMUNS = {"de", "mas", "pode", "que", "e", "eu", "um", "uma", "como", "o", "a", "os", "as", "então", "tô", "outra", "outro",
          "nossa", "aí", "porque", "se", "não", "isso", "ele", "ela", "também", "só", "tem", "vai", "pra", "para"}


def caixa_frase(txt, anterior):
    """'Mas devido ao histórico deles De fevereiro': o Whisper sem pontuação capitaliza no meio da frase."""
    nucleo = re.sub(r"[.,!?…:;]+$", "", txt)
    if anterior and anterior[-1:] not in ".?!…" and nucleo.lower() in COMUNS and nucleo[:1].isupper():
        return txt[0].lower() + txt[1:]
    return txt


def corrigir(w):
    nucleo = re.sub(r"[.,!?…:;]+$", "", w)
    cauda = w[len(nucleo):]
    novo = FIX.get(nucleo, nucleo)
    return novo + cauda, (nucleo in BIPS or novo in BIPS)


# ---------------------------------------------------------------- borda no silêncio real
ENV = {}


def envelope(bid):
    if bid not in ENV:
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", BRUTO[bid], "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                           capture_output=True, check=True)
        x = np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768
        n = len(x) // 160
        e = 20 * np.log10(np.sqrt((x[:n * 160].reshape(n, 160) ** 2).mean(1)) + 1e-9)  # janelas de 10 ms
        piso, p90 = np.percentile(e, 15), np.percentile(e, 90)
        # limiar adaptativo: em gravação barulhenta (carro) a fala fica só 5–12 dB acima do ruído,
        # e um limiar fixo de +9 dB tratava fala baixa como silêncio 
        ENV[bid] = (e, piso + min(9.0, max(3.0, 0.3 * (p90 - piso))))
    return ENV[bid]


def snap(bid, sa, sb, lo, hi):
    """Empurra o fim para depois do último som da palavra e o início para antes do primeiro."""
    e, lim_som = envelope(bid)
    q = lambda t: e[min(len(e) - 1, max(0, int(t * 100)))]
    t, lim = sb, min(hi, sb + 0.45)
    while t < lim and max(q(t), q(t + 0.01), q(t + 0.02), q(t + 0.03)) > lim_som:
        t += 0.01
    sb = min(lim, t + 0.06)
    t, lim = sa, max(lo, sa - 0.3)
    while t > lim and max(q(t), q(t - 0.01), q(t - 0.02)) > lim_som:
        t -= 0.01
    sa = max(lim, t - 0.04)
    return sa, sb


def silencios(bid, sa, sb, minimo):
    """Silêncios reais (envelope do áudio) dentro de [sa, sb] com duração >= minimo.
    O Whisper estica o fim/início das palavras e esconde hesitação: 'o ... posto' com 2,8 s
    de silêncio vem como duas palavras coladas."""
    e, lim = envelope(bid)
    i0, i1 = int((sa + 0.08) * 100), int((sb - 0.08) * 100)
    out, ini = [], None
    for i in range(max(0, i0), min(len(e), i1)):
        if e[i] <= lim:
            ini = i if ini is None else ini
        else:
            if ini is not None and (i - ini) / 100 >= minimo:
                out.append((ini / 100, i / 100))
            ini = None
    if ini is not None and (i1 - ini) / 100 >= minimo:
        out.append((ini / 100, i1 / 100))
    return out


# ---------------------------------------------------------------- extração
fcount = 0
aud = []


def extrair(bid, a, b, speed, nframes, enquadrar, fala=True):
    global fcount
    vf = f"setpts=PTS/{speed}," if speed != 1 else ""
    if enquadrar == "conter":
        geo = f"scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black"
    else:
        geo = f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H}"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-i", BRUTO[bid], "-t", f"{(b - a):.3f}",
                    "-vf", f"{vf}fps={FPS},{geo}", "-frames:v", str(nframes), "-q:v", "2",
                    "-start_number", str(fcount + 1), os.path.join(OUT, "f", "%05d.jpg")], check=True)
    tem = sum(1 for i in range(fcount + 1, fcount + nframes + 1) if os.path.exists(os.path.join(OUT, "f", f"{i:05d}.jpg")))
    while tem < nframes:  # completa com o último quadro se o bruto acabar antes
        shutil.copy(os.path.join(OUT, "f", f"{fcount + tem:05d}.jpg"), os.path.join(OUT, "f", f"{fcount + tem + 1:05d}.jpg"))
        tem += 1
    n = nframes * SR // FPS
    if fala:
        af = ["-af", f"atempo={speed}"] if speed != 1 else []
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-i", BRUTO[bid], "-t", f"{(b - a):.3f}", "-vn",
                            "-ac", "1", "-ar", str(SR), *af, "-f", "s16le", "-"], capture_output=True, check=True)
        x = np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768
        env = np.sqrt(np.convolve(x ** 2, np.ones(2400) / 2400, "same") + 1e-12)
        alto = env[env > np.percentile(env, 70)]
        if len(alto):  # nivela pela fala; o silêncio não é empurrado para cima
            g = 10 ** ((-20 - 20 * np.log10(np.sqrt((alto ** 2).mean()) + 1e-9)) / 20)
            x = x * float(np.clip(g, 10 ** (-6 / 20), 10 ** (14 / 20)))
    else:
        x = np.zeros(0, np.float32)
    x = np.pad(x, (0, max(0, n - len(x))))[:n]
    f = min(len(x) // 2, int(0.012 * SR))
    if f:
        rampa = np.linspace(0, 1, f)
        x[:f] *= rampa
        x[-f:] *= rampa[::-1]
    aud.append(x)
    fcount += nframes


# ---------------------------------------------------------------- trechos → pedaços sem pausa
GAP = EDL.get("gapmax", 0.5)
ULTIMO = {}
RITMO = EDL.get("ritmo", 1.0)
segs, words = [], []
for i, S in enumerate(EDL["trechos"]):
    bid, a, b = S["bruto"], S["a"], S["b"]
    speed = S.get("speed", RITMO)
    fala = S.get("fala", True)
    todas = palavras(bid)
    ws = [w for w in todas if w["s"] >= a - 0.05 and w["e"] <= b + 0.3 and w["s"] < b] if fala else []
    for w in todas:  # palavra que começa dentro do trecho mas termina depois da borda: some da fala sem aviso
        if fala and a <= w["s"] < b and w["e"] > b + 0.3:
            print(f"  ⚠️  trecho {i + 1}: «{w['w']}» ({w['s']:.2f}–{w['e']:.2f}) passa da borda b={b}; aumente o b ou corte antes dela", flush=True)
    skip = S.get("skip", [])
    fica = [not any(x0 <= w["s"] < x1 for x0, x1 in skip) for w in ws]
    pedacos = []
    if ws and S.get("cortar_pausas", True):
        cur = []
        for w, ok in zip(ws, fica):
            if not ok:
                if cur: pedacos.append(cur); cur = []
                continue
            if cur and w["s"] - cur[-1]["e"] > S.get("gapmax", GAP):
                pedacos.append(cur); cur = []
            cur.append(w)
        if cur: pedacos.append(cur)
        spans = []
        for p in pedacos:
            i0, i1 = todas.index(p[0]), todas.index(p[-1])
            lo = todas[i0 - 1]["e"] + 0.02 if i0 > 0 else -1e9
            hi = todas[i1 + 1]["s"] - 0.02 if i1 + 1 < len(todas) else 1e9
            sa0 = max(a - 0.1, lo, p[0]["s"] - 0.12)
            sb0 = min(b + 0.1, hi, p[-1]["e"] + 0.12)
            spans.append((*snap(bid, sa0, sb0, max(lo, a - 0.3), min(hi, b + 0.5)), p))
        # quebra também nos silêncios medidos no áudio que a transcrição escondeu
        finos = []
        for sa_, sb_, p in spans:
            limites, cur_a = [], sa_
            for s0, s1 in silencios(bid, sa_, sb_, S.get("gapmax", GAP)):
                c0, c1 = s0 + 0.07, s1 - 0.05
                # proteção: silêncio medido em cima de palavra de duração normal (< 0,7 s) é fala baixa, não pausa.
                # Só corta dentro de palavra "esticada", que é onde o Whisper esconde a hesitação.
                if any(w["e"] - w["s"] < 0.7 and min(c1, w["e"]) - max(c0, w["s"]) > 0.1 for w in p):
                    continue
                if c1 - c0 >= 0.12:
                    limites.append((cur_a, c0)); cur_a = c1
            limites.append((cur_a, sb_))
            grupos = [[] for _ in limites]
            for w in p:  # palavra que "começa" dentro do silêncio cortado vai para o pedaço seguinte
                k = next((j for j, (_, fim) in enumerate(limites) if w["s"] < fim - 0.02), len(limites) - 1)
                grupos[k].append(w)
            finos += [(a_, b_, g) for (a_, b_), g in zip(limites, grupos)]
        spans = [f for f in finos if f[1] - f[0] > 0.08]
    else:
        spans = [(a, b, [w for w, ok in zip(ws, fica) if ok])]
    dur_bruto = next((b.get("duracao") for b in CFG["brutos"] if b["id"] == bid), None)
    spans = [(max(0.0, sa), min(sb, dur_bruto) if dur_bruto else sb, pw) for sa, sb, pw in spans]  # o 1º corte nunca começa antes do zero
    # pedaços vizinhos não podem dividir o mesmo áudio: a folga do snap de um invadia a do outro e o fim
    # da palavra tocava duas vezes ("então... ão"). Corta no ponto mais silencioso.
    e_env, _ = envelope(bid)
    arrumados = []
    for sa, sb, pw in spans:
        if arrumados and sa < arrumados[-1][1]:
            pa, pb, ppw = arrumados[-1]
            i0, i1 = int(sa * 100), max(int(sa * 100) + 1, int(pb * 100))
            corte = (i0 + int(np.argmin(e_env[i0:i1]))) / 100 if i1 <= len(e_env) else (sa + pb) / 2
            arrumados[-1] = (pa, max(pa + 0.05, corte), ppw); sa = corte
        arrumados.append((sa, sb, pw))
    spans = [(a_, b_, w_) for a_, b_, w_ in arrumados if b_ - a_ > 0.05]
    # `skip` corta também o TEMPO, não só as palavras que começam dentro dele: a hesitação que o Whisper esconde
    # dentro de uma palavra esticada ("o[61.9–64.7] posto") não tem palavra começando ali e o skip não fazia nada.
    if skip and fala:
        cortados = []
        for sa, sb, pw in spans:
            partes = [(sa, sb)]
            for x0, x1 in skip:
                novas = []
                for pa, pb in partes:
                    if x1 <= pa or x0 >= pb:
                        novas.append((pa, pb)); continue
                    if x0 - pa > 0.05: novas.append((pa, x0))
                    if pb - x1 > 0.05: novas.append((x1, pb))
                partes = novas
            grupos = [[] for _ in partes]
            for w in pw:
                k = next((j for j, (_, fim) in enumerate(partes) if w["s"] < fim - 0.02), len(partes) - 1)
                if partes: grupos[k].append(w)
            cortados += [(pa, pb, g) for (pa, pb), g in zip(partes, grupos)]
        spans = cortados
    if ULTIMO.get(bid) is not None and spans and spans[0][0] < ULTIMO[bid]:  # trecho anterior do mesmo bruto
        spans[0] = (ULTIMO[bid], spans[0][1], spans[0][2])
    if spans: ULTIMO[bid] = spans[-1][1]
    for k, (sa, sb, pw) in enumerate(spans):
        nfr = max(1, round((sb - sa) / speed * FPS))
        o0 = fcount / FPS
        segs.append(dict(i=i, k=k, bruto=bid, a=round(sa, 3), b=round(sb, 3), o0=round(o0, 4), o1=round(o0 + nfr / FPS, 4),
                         f0=fcount + 1, n=nfr, speed=speed, fala=fala,
                         zoom=S.get("zoom", "auto"), foco=S.get("foco"), layout=S.get("layout", "cheio"),
                         enquadrar=S.get("enquadrar", "cobrir"), cena=S.get("cena")))
        for w in pw:
            txt, bip = corrigir(w["w"])
            txt = caixa_frase(txt, words[-1]["w"] if words else ".")
            words.append(dict(t0=round(o0 + (max(w["s"], sa) - sa) / speed, 3), t1=round(o0 + (min(w["e"], sb) - sa) / speed, 3),
                              w=txt, bip=bip, src=[bid, w["s"], w["e"]]))
        extrair(bid, sa, sb, speed, nfr, S.get("enquadrar", "cobrir"), fala)
    print(f"  trecho {i + 1}/{len(EDL['trechos'])} {bid} {a:.1f}–{b:.1f} → {len(spans)} pedaço(s), vídeo em {fcount / FPS:.1f} s", flush=True)

# ---------------------------------------------------------------- voz: limpeza + bips
voz = np.concatenate(aud) if aud else np.zeros(0, np.float32)
cru, limpo = os.path.join(OUT, "voz_bruta.wav"), os.path.join(OUT, "voz_limpa.wav")


def grava(caminho, x):
    with wave.open(caminho, "wb") as wv:
        wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR)
        wv.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


grava(cru, voz)
LIMPEZA = {
    "leve": "highpass=f=75,afftdn=nr=10:nf=-42:tn=1",
    # voz clara: gravação no carro deixa a voz embolada (100–300 Hz domina, quase sem agudo). Tira o embolo,
    # devolve presença e ar. 
    "padrao": "highpass=f=90,equalizer=f=180:t=q:w=1.0:g=-5,equalizer=f=380:t=q:w=1.2:g=-2.5,equalizer=f=3500:t=q:w=1.0:g=4,highshelf=f=7000:g=5,afftdn=nr=8:nf=-48:tn=1",
    "neutro": "highpass=f=85,afftdn=nr=18:nf=-40:tn=1,deesser=i=0.25",
    "forte": "highpass=f=110,afftdn=nr=30:nf=-36:tn=1,deesser=i=0.35",
}
aud_cfg = EDL.get("audio", {})
cadeia = LIMPEZA.get(aud_cfg.get("limpeza", "padrao"), LIMPEZA["padrao"])
for hz in aud_cfg.get("zumbido", []):  # ex.: [68, 101, 113] = zumbido de ar-condicionado
    cadeia = f"equalizer=f={hz}:t=q:w=3:g=-20," + cadeia
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", cru, "-af", cadeia, "-ar", str(SR), limpo], check=True)
with wave.open(limpo) as wv:
    voz = np.frombuffer(wv.readframes(wv.getnframes()), np.int16).astype(np.float32) / 32768
voz = voz.copy()
for w in words:
    if not w["bip"]:
        continue
    i0, i1 = int((w["t0"] - 0.04) * SR), int((w["t1"] + 0.06) * SR)
    t = np.arange(i1 - i0) / SR
    tom = 0.22 * np.sin(2 * np.pi * 1000 * t)
    f = int(0.006 * SR)
    tom[:f] *= np.linspace(0, 1, f); tom[-f:] *= np.linspace(1, 0, f)
    voz[i0:i1] = tom
grava(os.path.join(OUT, "voz.wav"), voz)

json.dump(dict(frames=fcount, fps=FPS, w=W, h=H, segs=segs, words=words), open(os.path.join(OUT, "timeline.json"), "w"),
          ensure_ascii=False, indent=1)
dur_bruto = sum(b.get("duracao", 0) for b in CFG["brutos"])
ritmo_final = len(words) / max(fcount / FPS, 0.1)
print(f"  ritmo depois do corte: {ritmo_final:.2f} palavras/s (alvo 2,8 a 3,2; abaixo arrasta, acima cansa)")
print(f"  base pronta: {fcount} quadros · {fcount / FPS:.1f} s (bruto {dur_bruto:.1f} s) · {len(words)} palavras · "
      f"{sum(w['bip'] for w in words)} bips · {len(segs)} pedaços")
