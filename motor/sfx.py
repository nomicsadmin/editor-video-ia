#!/usr/bin/env python3
"""
Som desenhado: efeitos sonoros discretos, todos SINTETIZADOS aqui (sem arquivo de som, sem licença de terceiros).
Regra medida nas referências: o efeito acompanha a ENTRADA DE ELEMENTO, não o corte seco, e fica sempre ABAIXO da voz.
  - whoosh curto na troca de layout (rosto ↔ fundo ↔ tela dividida)
  - pop em card, logo, número, selo, imagem em card · tique em cada item de lista
  - efeitos prontos (print, tela_assunto, checklist, holofote, comentario, contador, hodometro, antes_depois,
    timeline_chamas...): a lista de sons que o próprio efeito pede (whoosh na entrada e na saída, clique em cada
    clique do cursor, tique em cada item, pop quando o número pousa, riser antes da virada, impacto)
Campo "som" em qualquer cena troca o som dela: "whoosh", "whoosh-curto", "whoosh-cinematico", "clique", "clique-suave",
"pop", "tique", "digitacao", "brilho", "riser", "impacto", "impacto-grave" ou "nenhum" (silêncio). "som_ganho"
multiplica o volume. Cena {"tipo": "som", "som": "riser", "quando": "palavra"} só agenda um som, sem nada na tela.
Música: nenhuma por padrão (só se a pessoa pedir; ela entra pelo montar.sh com `edicao.trilha`).
Uso:  python3 sfx.py <pasta-do-projeto>  → _build/sfx.wav
"""
import _utf8  # noqa: F401 (Windows em UTF-8)
import json
import os
import sys
import wave

import numpy as np

SR = 48000
PROJ = os.path.abspath(sys.argv[1])
B = os.path.join(PROJ, "_build")
tl = json.load(open(os.path.join(B, "timeline.json")))
cenas = []
if os.path.exists(os.path.join(B, "cenas_resolvidas.json")):
    cenas = json.load(open(os.path.join(B, "cenas_resolvidas.json")))
dur = tl["frames"] / tl["fps"]
rng = np.random.default_rng(7)


def filtra(n, centro, largura):
    F = np.fft.rfft(n)
    fr = np.fft.rfftfreq(len(n), 1 / SR)
    F *= np.exp(-((fr - centro) / largura) ** 2)
    x = np.fft.irfft(F, len(n))
    return x / (np.abs(x).max() + 1e-9)


def pop():
    t = np.arange(int(0.12 * SR)) / SR
    f = 700 * np.exp(-t * 20) + 220
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.5


def tique():
    t = np.arange(int(0.05 * SR)) / SR
    return np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 90) * 0.25


def whoosh(d=0.34, centro=1800):
    x = filtra(rng.standard_normal(int(d * SR)), centro, 1400)
    p = np.linspace(0, 1, len(x))
    return x * np.sin(np.pi * p) ** 1.5 * 0.35


def whoosh_cinematico(d=0.85):
    """Passagem longa: o centro do ruído desce de 3 kHz para 500 Hz e o volume cresce até o pico e cai (a janela que chega)."""
    n = rng.standard_normal(int(d * SR))
    p = np.linspace(0, 1, len(n))
    out = np.zeros_like(n)
    seg = 2048
    for k in range(0, len(n), seg):
        c = 3000 - 2500 * p[k]
        out[k:k + seg] = filtra(n[k:k + seg], c, c * 0.7) if len(n[k:k + seg]) > 8 else 0
    env = np.where(p < 0.62, (p / 0.62) ** 2, np.exp(-(p - 0.62) * 9))
    return out * env * 0.42


def riser(d=0.6):
    """Subida de ruído filtrado (a tensão antes da virada)."""
    n = rng.standard_normal(int(d * SR))
    p = np.linspace(0, 1, len(n))
    out = np.zeros_like(n)
    for a, b in zip(np.linspace(0, 1, 9)[:-1], np.linspace(0, 1, 9)[1:]):
        i0, i1 = int(a * len(n)), int(b * len(n))
        out[i0:i1] = filtra(n[i0:i1], 500 + 3500 * a, 700 + 1500 * a)
    out /= np.abs(out).max() + 1e-9
    return out * p ** 2 * 0.45


def impacto(d=0.7):
    """Pancada grave (seno que cai de 110 para 40 Hz) com um estalo de ruído no ataque."""
    t = np.arange(int(d * SR)) / SR
    f = 40 + 70 * np.exp(-t * 9)
    corpo = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5.5)
    estalo = rng.standard_normal(len(t)) * np.exp(-t * 60) * 0.35
    return (corpo + estalo) * 0.7


def impacto_grave(d=1.4):
    """O impacto do gancho: sub grave longo (55 → 32 Hz) com um baque curto por cima, sem estalo."""
    t = np.arange(int(d * SR)) / SR
    f = 32 + 23 * np.exp(-t * 3)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    baque = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 14) + 45) / SR) * np.exp(-t * 16)
    return (sub * 0.8 + baque * 0.5) * 0.8


def clique(suave=False):
    """Clique de mouse/obturador: dois transientes curtos de banda larga (~70 ms entre eles) e um corpo grave."""
    def tr(d, corte):
        n = rng.standard_normal(int(d * SR))
        t = np.arange(len(n)) / SR
        F = np.fft.rfft(n)
        fr = np.fft.rfftfreq(len(n), 1 / SR)
        F *= 1 / (1 + (corte / (fr + 1)) ** 2)
        if suave:
            F *= np.exp(-(fr / 6000) ** 2)
        y = np.fft.irfft(F, len(n))
        return y / (np.abs(y).max() + 1e-9) * np.exp(-t * (220 if suave else 160))
    a, b = tr(0.035, 700), tr(0.03, 1500)
    out = np.zeros(int(0.12 * SR))
    out[:len(a)] += a * 0.55
    i = int(0.07 * SR)
    out[i:i + len(b)] += b * (0.25 if suave else 0.4)
    t = np.arange(int(0.05 * SR)) / SR
    out[:len(t)] += np.sin(2 * np.pi * 95 * t) * np.exp(-t * 70) * 0.35
    return out * (0.6 if suave else 1.0)


def digitacao(d=1.1):
    """Teclas: cliques suaves em ritmo irregular (~11 por segundo)."""
    out = np.zeros(int(d * SR))
    t = 0.0
    while t < d - 0.06:
        k = clique(True)[: int(0.05 * SR)] * (0.5 + 0.4 * rng.random())
        i = int(t * SR)
        out[i:i + len(k)] += k[:len(out) - i]
        t += 0.06 + 0.07 * rng.random()
    return out * 0.7


def brilho(d=0.9):
    """Cintilar: notas agudas curtas subindo (o "pronto" do antes e depois)."""
    out = np.zeros(int(d * SR))
    for j, f in enumerate([1568, 2093, 2637, 3136, 4186]):
        t = np.arange(int(0.35 * SR)) / SR
        nota = np.sin(2 * np.pi * f * t) * np.exp(-t * 14) * 0.18
        i = int(j * 0.07 * SR)
        out[i:i + len(nota)] += nota[:len(out) - i]
    return out


# nome → (som, adianto em s para o ponto certo cair na palavra, ganho padrão)
SONS = {
    "whoosh": (lambda: whoosh(0.34), -0.16, 0.38), "whoosh-curto": (lambda: whoosh(0.22, 2300), -0.1, 0.38),
    "whoosh-cinematico": (whoosh_cinematico, -0.53, 0.5), "clique": (clique, -0.01, 0.6),
    "clique-suave": (lambda: clique(True), -0.01, 0.6), "pop": (pop, -0.02, 0.45), "tique": (tique, 0.0, 0.5),
    "digitacao": (digitacao, 0.0, 0.4), "brilho": (brilho, -0.02, 0.4), "riser": (lambda: riser(0.9), -0.88, 0.42),
    "impacto": (impacto, -0.03, 0.55), "impacto-grave": (impacto_grave, -0.02, 0.45),
}
# os nomes que os efeitos prontos usam (vindos do editor da casa) → os sintetizados daqui
APELIDO = {"whoosh-cinematic": "whoosh-cinematico", "whoosh-short": "whoosh-curto", "click-soft": "clique-suave",
           "click": "clique", "typing": "digitacao", "sparkle": "brilho", "impact-bass-1": "impacto-grave",
           "impact-bass-2": "impacto-grave", "key-press": "clique-suave"}


def som(nome):
    nome = str(nome or "").replace("sons/", "")
    return SONS.get(APELIDO.get(nome, nome))


out = np.zeros(int(dur * SR) + SR)


def put(t, s, g):
    i = int(t * SR)
    if i < 0:   # som que começaria antes do vídeo: corta a cabeça e mantém o ponto no lugar
        s, i = s[-i:], 0
    out[i:i + len(s)] += s[:len(out) - i] * g


segs = tl["segs"]
trocas = n_sons = 0
for a, b in zip(segs, segs[1:]):
    if a.get("layout") != b.get("layout"):
        put(b["o0"] - 0.16, whoosh(0.3), 0.38)
        trocas += 1
POP = {"card", "logo", "numero", "selo", "imagem", "comparativo", "citacao", "traco", "cinetica"}
for c in cenas:
    pedido = c.get("som")
    if pedido == "nenhum":
        continue
    if c.get("sons") and not pedido:   # efeito pronto: toca os sons que ele mesmo pediu (ganho relativo ao padrão de cada um)
        for s in c["sons"]:
            q = som(s.get("som"))
            if q:
                f, _, g = q
                put(s["t"], f(), g * 0.6 * s.get("ganho", 1))   # sem música por baixo: o efeito fica sempre abaixo da voz
                n_sons += 1
        continue
    if pedido:
        q = som(pedido)
        if not q:
            print(f"  aviso: som '{pedido}' não existe (sons: {', '.join(SONS)})")
            continue
        f, dt, g = q
        put(c["t0"] + dt, f(), g * (c.get("som_ganho") or 1.0))
        n_sons += 1
    elif c["tipo"] in POP:
        put(c["t0"] - 0.02, pop(), 0.45)
    elif c["tipo"] == "logos":
        for i in range(c.get("n", 1)):
            put(c["t0"] + i * 0.12, pop(), 0.35)
    elif c["tipo"] == "lista":
        tis = c.get("tis") or [c["t0"] + 0.15 + i * c.get("passo", 0.25) for i in range(c.get("n", 1))]
        for t in tis:
            put(t, tique(), 0.5)
    elif c["tipo"] == "layout" and c.get("de") != c.get("para") and c["t0"] > 0.2:
        put(c["t0"] - 0.14, whoosh(0.28), 0.3)
        trocas += 1
    elif c["tipo"] == "frase" and c.get("fundo") in ("claro", "escuro"):
        put(c["t0"] - 0.2, whoosh(0.4), 0.3)

out = out[:int(dur * SR)]
with wave.open(os.path.join(B, "sfx.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(out, -1, 1) * 32767).astype("<i2").tobytes())
print(f"  sfx: {trocas} trocas de layout, {len(cenas)} cenas, {n_sons} sons desenhados")
