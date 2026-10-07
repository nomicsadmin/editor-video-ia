#!/usr/bin/env python3
"""
Etapa final · conferência ANTES de mostrar (se você não publicaria, não mostre).
  1. loudness do arquivo final (alvo -14 LUFS, pico ≤ -1 dBTP)
  2. folha de contato do final (1 quadro a cada 1,5 s) e tira dos cortes (quadro logo depois de cada corte)
  3. RETRANSCREVE o áudio final e compara com as palavras que deviam estar lá → acha palavra comida no corte
  4. relatório do compositor: legenda reduzida por estouro, cenas sobrepostas, âncoras não achadas
Grava <projeto>/qa/relatorio.md.
Uso:  python3 qa.py <pasta-do-projeto>
"""
import _utf8  # noqa: F401 (Windows em UTF-8)
import difflib
import json
import os
import re
import subprocess
import sys
import unicodedata

M = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(M, ".."))
PROJ = os.path.abspath(sys.argv[1])
CFG = json.load(open(os.path.join(PROJ, "projeto.json"), encoding="utf-8"))
SAIDA = os.path.join(PROJ, (CFG.get("saida") or os.path.basename(PROJ)) + ".mp4")
B = os.path.join(PROJ, "_build")
Q = os.path.join(PROJ, "qa")
os.makedirs(Q, exist_ok=True)
tl = json.load(open(os.path.join(B, "timeline.json")))
linhas = [f"# QA · {CFG.get('titulo', os.path.basename(PROJ))}", "", f"Arquivo: `{SAIDA}`", ""]


CURTAS = {"esta": "ta", "estou": "to", "para": "pra", "estao": "tao", "estamos": "tamo", "parao": "pro"}  # fala coloquial


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9%]+", "", s)
    return CURTAS.get(s, s)


# 1 · loudness
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", SAIDA, "-af", "ebur128=peak=true", "-f", "null", "-"],
                   capture_output=True, text=True)
I = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
TP = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)
lufs = float(I[-1]) if I else None
pico = float(TP[-1]) if TP else None
ok_l = lufs is not None and abs(lufs + 14) <= 1 and pico is not None and pico <= -0.5
probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height,r_frame_rate:format=duration,size",
                                   "-of", "json", SAIDA], capture_output=True, text=True).stdout)
v = next(s for s in probe["streams"] if s.get("width"))
dur = float(probe["format"]["duration"])
linhas += ["## Render", "", "| Item | Valor |", "|---|---|",
           f"| Resolução | {v['width']}×{v['height']} · {v['r_frame_rate'].split('/')[0]} fps · {v['codec_name']} |",
           f"| Duração | {int(dur // 60)}:{dur % 60:05.2f} |",
           f"| Tamanho | {int(probe['format']['size']) / 1e6:.1f} MB |",
           f"| Loudness | {lufs} LUFS integrado · pico {pico} dBTP {'✅' if ok_l else '⚠️ fora do alvo -14 / -1'} |", ""]

# 1b · pedaços vizinhos dividindo o mesmo áudio = sílaba repetida ("então... ão")
sobre = [(round(p["b"] - q["a"], 2), round(q["o0"], 1)) for p, q in zip(tl["segs"], tl["segs"][1:])
         if q["bruto"] == p["bruto"] and q["a"] < p["b"] - 0.005]
em_som = tl.get("cortes_em_som", [])
linhas += ["## Cortes", "", (f"⚠️ {len(sobre)} ponto(s) com áudio repetido entre pedaços: {sobre}" if sobre else "Nenhum pedaço repete áudio do vizinho ✅"),
           (f"❌ {len(em_som)} corte(s) em cima de fala (come o fim ou o começo de uma palavra, mesmo que a retranscrição não perceba):" if em_som else "Nenhum corte em cima de fala ✅")]
linhas += [f"   - aos {c['onde']:.2f} s ({c['lado']}), perto de «{c['perto']}»" for c in em_som] + [""]

# 2 · folhas
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SAIDA, "-vf", "fps=1/1.5,scale=216:-2,tile=8x" + str(max(1, int(dur / 1.5 / 8) + 1)),
                "-frames:v", "1", "-q:v", "4", os.path.join(Q, "folha-final.jpg")])
cortes = [s["o0"] for s in tl["segs"][1:]][:40]
if cortes:
    filtro = "+".join(f"between(t\\,{c + 0.08:.3f}\\,{c + 0.12:.3f})" for c in cortes)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SAIDA, "-vf",
                    f"select='{filtro}',scale=216:-2,tile=8x{(len(cortes) + 7) // 8}", "-frames:v", "1", "-fps_mode", "vfr", "-q:v", "4",
                    os.path.join(Q, "cortes.jpg")])
linhas += ["## Imagem", "", f"- Folha de contato: `qa/folha-final.jpg`", f"- Quadro logo depois de cada corte ({len(cortes)}): `qa/cortes.jpg`", ""]

# 3 · retranscrição do final
venv = sys.executable
base_tr = os.path.join(Q, "final-transcricao")
subprocess.run([venv, os.path.join(M, "transcrever.py"), SAIDA, base_tr], capture_output=True)
esperado = [w["w"] for w in tl["words"] if not w.get("bip")]
obtido = []
if os.path.exists(base_tr + ".json"):
    for s in json.load(open(base_tr + ".json"))["segments"]:
        obtido += [w["word"].strip() for w in s.get("words", [])]
juntos = []
for w in obtido:  # o transcritor separa "6" ".1" e "GPT" "-6"
    if juntos and w[:1] in ".-" and len(w) > 1:
        juntos[-1] += w
    else:
        juntos.append(w)
obtido = juntos
glos = json.load(open(os.path.join(M, "glossario.json"), encoding="utf-8"))
edl = json.load(open(os.path.join(PROJ, "edl.json"), encoding="utf-8"))
fix = {**glos["fix"], **edl.get("fix", {})}
obtido = [fix.get(re.sub(r"[.,!?…:;]+$", "", w), re.sub(r"[.,!?…:;]+$", "", w)) + w[len(re.sub(r"[.,!?…:;]+$", "", w)):] for w in obtido]
a, b = [norm(w) for w in esperado], [norm(w) for w in obtido]
sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
problemas = []
for op, i1, i2, j1, j2 in sm.get_opcodes():
    if op == "insert" and j2 - j1 >= 1:
        problemas.append(f"- `fala sem legenda`: ouvido «{' '.join(obtido[j1:j2])}» perto de «{' '.join(esperado[max(0, i1 - 3):i1 + 2])}» (a transcrição pulou: acrescente no `fix`/legenda ou confira ouvindo)")
    if op in ("delete", "replace"):
        ctx_a = " ".join(esperado[max(0, i1 - 3):i2 + 2])
        problemas.append(f"- `{op}`: esperado «{' '.join(esperado[i1:i2])}» → ouvido «{' '.join(obtido[j1:j2])}» · contexto: …{ctx_a}…")
taxa = sm.ratio()
linhas += ["## Fala (retranscrição do arquivo final)", "",
           f"Concordância com a fala esperada: **{taxa * 100:.1f}%** ({len(esperado)} palavras esperadas, {len(obtido)} ouvidas).",
           "Divergência pequena costuma ser o transcritor variando; palavra sumida perto de um corte é corte comendo sílaba: confira ouvindo.", ""]
linhas += (problemas[:30] or ["- nenhuma divergência ✅"]) + [""]

# 4 · compositor
r = subprocess.run(["node", os.path.join(M, "render.mjs"), PROJ, "--qa"], capture_output=True, text=True)
try:
    cq = json.loads(r.stdout[r.stdout.index("{"):])
except Exception:
    cq = {"erro": r.stdout[-400:] + r.stderr[-400:]}
linhas += ["## Compositor", "", "```json", json.dumps(cq, ensure_ascii=False, indent=1), "```", ""]

open(os.path.join(Q, "relatorio.md"), "w", encoding="utf-8").write("\n".join(linhas))
print(f"  QA: {lufs} LUFS / {pico} dBTP · fala {taxa * 100:.1f}% · {len(problemas)} divergência(s) · {len(em_som)} corte(s) em cima de fala · qa/relatorio.md")
