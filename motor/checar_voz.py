#!/usr/bin/env python3
"""
Conferência rápida do corte SÓ pelo áudio, antes do render: retranscreve _build/voz.wav e
compara com as palavras que deviam estar lá. Leva ~10 s. Use depois de cada base.py.
  python3 checar_voz.py <pasta-do-projeto>
"""
import _utf8  # noqa: F401 (Windows em UTF-8)
import difflib, json, os, re, subprocess, sys, unicodedata
M = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(M, ".."))
P = os.path.abspath(sys.argv[1]); B = os.path.join(P, "_build")
tl = json.load(open(os.path.join(B, "timeline.json")))
glos = json.load(open(os.path.join(M, "glossario.json")))
edl = json.load(open(os.path.join(P, "edl.json")))
fix = {**glos["fix"], **edl.get("fix", {})}
CURTAS = {"esta": "ta", "estou": "to", "para": "pra", "estao": "tao", "estamos": "tamo"}  # o transcritor normaliza a fala coloquial


def norm(w):
    w = unicodedata.normalize("NFD", w.lower()); w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    w = re.sub(r"[^a-z0-9]+", "", w)
    return CURTAS.get(w, w)


base = os.path.join(B, "voz-check")
subprocess.run([sys.executable, os.path.join(M, "transcrever.py"),
                os.path.join(B, "voz.wav"), base], check=True, capture_output=True)
ouv = [w["word"].strip() for s in json.load(open(base + ".json"))["segments"] for w in s.get("words", [])]
ouv = [fix.get(re.sub(r"[.,!?…]+$", "", w), w) for w in ouv]
esp = [w["w"] for w in tl["words"] if not w.get("bip")]
a = [x for w in esp for x in map(norm, w.split()) if x]
b = [x for w in ouv for x in map(norm, w.split()) if x]
sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
falta = [(" ".join(a[i1:i2]), " ".join(a[max(0, i1 - 3):i2 + 3])) for op, i1, i2, j1, j2 in sm.get_opcodes() if op == "delete" and i2 - i1 >= 1]
print(f"  voz: {tl['frames'] / tl['fps']:.1f} s · concordância {sm.ratio() * 100:.1f}% · {len(falta)} trecho(s) que sumiram")
for f, ctx in falta:
    print(f"   - sumiu «{f}» · …{ctx}…")
