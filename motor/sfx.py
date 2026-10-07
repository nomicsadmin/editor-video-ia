#!/usr/bin/env python3
"""
Efeitos sonoros discretos, sintetizados (sem biblioteca de áudio, sem licença).
Regra: o efeito acompanha a ENTRADA DE ELEMENTO, não o corte seco.
  - whoosh curto na troca de layout (rosto ↔ fundo ↔ tela dividida)
  - pop em card, logo, número, selo, imagem em card
  - tique leve em cada item de lista
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


def pop():
    t = np.arange(int(0.12 * SR)) / SR
    f = 700 * np.exp(-t * 20) + 220
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.5


def tique():
    t = np.arange(int(0.05 * SR)) / SR
    return np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 90) * 0.25


def whoosh(d=0.34):
    n = rng.standard_normal(int(d * SR))
    F = np.fft.rfft(n)
    fr = np.fft.rfftfreq(len(n), 1 / SR)
    F *= np.exp(-((fr - 1800) / 1400) ** 2)
    x = np.fft.irfft(F, len(n))
    x /= np.abs(x).max() + 1e-9
    p = np.linspace(0, 1, len(x))
    return x * np.sin(np.pi * p) ** 1.5 * 0.35


out = np.zeros(int(dur * SR) + SR)


def put(t, s, g):
    i = max(0, int(t * SR))
    out[i:i + len(s)] += s[:len(out) - i] * g


segs = tl["segs"]
trocas = 0
for a, b in zip(segs, segs[1:]):
    if a.get("layout") != b.get("layout"):
        put(b["o0"] - 0.16, whoosh(0.3), 0.38)
        trocas += 1
POP = {"card", "logo", "numero", "selo", "imagem", "comparativo", "citacao"}
for c in cenas:
    if c["tipo"] in POP:
        put(c["t0"] - 0.02, pop(), 0.45)
    elif c["tipo"] == "logos":
        for i in range(c.get("n", 1)):
            put(c["t0"] + i * 0.12, pop(), 0.35)
    elif c["tipo"] == "lista":
        for i in range(c.get("n", 1)):
            put(c["t0"] + 0.15 + i * c.get("passo", 0.25), tique(), 0.5)
    elif c["tipo"] == "layout" and c.get("de") != c.get("para") and c["t0"] > 0.2:
        put(c["t0"] - 0.14, whoosh(0.28), 0.3)
        trocas += 1
    elif c["tipo"] == "frase" and c.get("fundo") in ("claro", "escuro"):
        put(c["t0"] - 0.2, whoosh(0.4), 0.3)

out = out[:int(dur * SR)]
with wave.open(os.path.join(B, "sfx.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(out, -1, 1) * 32767).astype("<i2").tobytes())
print(f"  sfx: {trocas} trocas de layout, {len(cenas)} cenas")
