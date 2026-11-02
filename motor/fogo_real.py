#!/usr/bin/env python3
"""
Fogo de verdade: transforma uma filmagem real de papel queimando em fundo verde (banco grátis, como o Pexels) em duas
camadas por quadro, que o extra.js usa para queimar QUALQUER coisa da tela (um papel com a headline, um logo, a tela
inteira) com fogo filmado, não desenhado.

  .venv/bin/python motor/fogo_real.py <clip.mp4> <saida/> --largura 900 --altura 400 [opções]

Camadas (PNG, 30 quadros/s, um par por quadro):
  <saida>/m/00000.png  máscara RGBA do tamanho da caixa: alfa = o que ainda não queimou; cor = o tom de queimado
                       (branco longe do fogo, marrom/preto na borda que está queimando). Multiplica o conteúdo.
  <saida>/c/00000.png  as chamas e brasas da filmagem, sobre preto (desenhe com mistura "screen"), com a mesma
                       largura da caixa e `--acima` px a mais em cima (a chama sobe além do papel).
  <saida>/fogo.json    {n, fps, largura, altura, acima, fonte, licença}

Opções:
  --de S --ate S        trecho da filmagem (do primeiro fogo até quase tudo verde)
  --velocidade V        acelera a filmagem (2 = o dobro); a queima dura (ate-de)/V segundos
  --espelhar            espelha na horizontal (o fogo nasce do outro lado)
  --zoom Z              aproxima a filmagem (1 = cobre a caixa); --foco X Y (0..1) escolhe o ponto da filmagem que fica
                        no centro da caixa (o lugar onde o fogo nasce, para ele bater com o isqueiro, por exemplo)
  --girar G             gira a filmagem G graus antes de enquadrar
  --acima PX            espaço de chama acima da caixa (a chama nesse espaço só aparece enquanto ainda há o que queimar)
  --sumir S             no fim, as chamas somem em S segundos depois que a caixa queimou (padrão 0,35)
  --acabar S            a partir de S segundos, o que ainda não queimou some em 0,35 s (quando o trecho não queima tudo)
Como achar o trecho: a filmagem precisa começar com o papel inteiro (escuro) e terminar com o verde quase todo à mostra.
O guia `docs/07-efeitos-extras.md` mostra como desenhar as camadas no extra.js (motor/comp/efeitos/fogo_real.js).
"""
import _utf8  # noqa: F401
import argparse
import json
import os
import subprocess
import sys

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("clip"); ap.add_argument("saida")
ap.add_argument("--largura", type=int, required=True); ap.add_argument("--altura", type=int, required=True)
ap.add_argument("--acima", type=int, default=0)
ap.add_argument("--de", type=float, default=0.0); ap.add_argument("--ate", type=float, default=None)
ap.add_argument("--velocidade", type=float, default=1.0)
ap.add_argument("--espelhar", action="store_true")
ap.add_argument("--zoom", type=float, default=1.0)
ap.add_argument("--foco", type=float, nargs=2, default=[0.5, 0.5])
ap.add_argument("--girar", type=float, default=0.0)
ap.add_argument("--sumir", type=float, default=0.35)
ap.add_argument("--acabar", type=float, default=None)   # a partir de S s, o que sobrou some em 0,35 s (filmagem que não queima tudo)
ap.add_argument("--fps", type=int, default=30)
ap.add_argument("--licenca", default="")
A = ap.parse_args()

W, H, AC = A.largura, A.altura, A.acima
TH = H + AC
os.makedirs(os.path.join(A.saida, "m"), exist_ok=True)
os.makedirs(os.path.join(A.saida, "c"), exist_ok=True)

info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                  "stream=width,height:format=duration", "-of", "json", A.clip], capture_output=True, text=True, check=True).stdout)
cw, ch = info["streams"][0]["width"], info["streams"][0]["height"]
ate = A.ate if A.ate is not None else float(info["format"]["duration"])
dur_saida = (ate - A.de) / A.velocidade
N = int(round(dur_saida * A.fps))

# quadros da filmagem já no tempo da saída (setpts acelera, fps reamostra), numa resolução de trabalho
RW = 1280; RH = int(round(ch * RW / cw))
vf = f"setpts=(PTS-STARTPTS)/{A.velocidade},fps={A.fps},scale={RW}:{RH}:flags=lanczos" + (",hflip" if A.espelhar else "")
proc = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{A.de}", "-t", f"{ate - A.de}", "-i", A.clip, "-vf", vf,
                         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)

# enquadramento: a caixa inteira (W × TH) coberta pela filmagem girada, com zoom e foco
def enquadra(fr):
    if A.girar:
        M = cv2.getRotationMatrix2D((RW / 2, RH / 2), A.girar, 1.0)
        fr = cv2.warpAffine(fr, M, (RW, RH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    k = max(W / RW, TH / RH) * A.zoom
    fx, fy = A.foco[0] * RW * k, A.foco[1] * RH * k
    x0 = np.clip(fx - W / 2, 0, RW * k - W); y0 = np.clip(fy - TH / 2, 0, RH * k - TH)
    M = np.float32([[k, 0, -x0], [0, k, -y0]])
    return cv2.warpAffine(fr, M, (W, TH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

def suave(e0, e1, v):
    u = np.clip((v - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u)

CHAR = np.float32([0.16, 0.09, 0.05])        # marrom-carvão da borda queimada
fim_queima = None
restos = []
k = 0
while k < N:
    raw = proc.stdout.read(RW * RH * 3)
    if len(raw) < RW * RH * 3:
        break
    fr = np.frombuffer(raw, np.uint8).reshape(RH, RW, 3).astype(np.float32) / 255
    f = enquadra(fr)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    verde = suave(0.05, 0.16, g - np.maximum(r, b))                  # fundo verde = já queimou
    verde = cv2.GaussianBlur(verde, (0, 0), 1.0)
    fica = 1 - verde
    # chama e brasa: o que é claro e não é verde (com o verde que vaza na borda da chama tirado)
    lum = f.max(-1)
    chama = suave(0.18, 0.55, lum) * fica * suave(0.02, 0.12, r - b)   # fogo é quente: fumaça cinza não entra
    cor = f.copy(); cor[..., 1] = np.minimum(cor[..., 1], np.maximum(cor[..., 0], cor[..., 2]) * 1.02 + 0.03)  # tira o verde da borda
    c = cor * chama[..., None]
    # tom de queimado: perto do verde (a borda que está queimando) o papel escurece em carvão
    perto = cv2.GaussianBlur(verde, (0, 0), max(4.0, W / 90))
    queimado = np.clip(perto * 3.2, 0, 1) ** 0.8
    tom = 1 - queimado[..., None] * (1 - CHAR)
    if A.acabar is not None and k / A.fps > A.acabar:
        fica = fica * max(0.0, 1 - (k / A.fps - A.acabar) / 0.35)
    m = np.dstack([tom, fica])[AC:]                                  # máscara só na caixa (sem a área de chama acima)
    resto = float(m[..., 3].mean()); restos.append(resto)
    if fim_queima is None and resto < 0.015:
        fim_queima = k
    # chama acima da caixa só enquanto ainda há o que queimar; no fim, tudo some em `sumir` s
    if AC:
        c[:AC] *= min(1.0, resto / 0.08)
    if fim_queima is not None:
        c *= max(0.0, 1 - (k - fim_queima) / (A.sumir * A.fps))
    cv2.imwrite(os.path.join(A.saida, "m", f"{k:05d}.png"), cv2.cvtColor((np.clip(m, 0, 1) * 255 + 0.5).astype(np.uint8), cv2.COLOR_RGBA2BGRA))
    cv2.imwrite(os.path.join(A.saida, "c", f"{k:05d}.png"), cv2.cvtColor((np.clip(c, 0, 1) * 255 + 0.5).astype(np.uint8), cv2.COLOR_RGB2BGR))
    k += 1
proc.stdout.close(); proc.wait()
json.dump({"n": k, "fps": A.fps, "largura": W, "altura": H, "acima": AC, "fonte": os.path.basename(A.clip), "licenca": A.licenca,
           "de": A.de, "ate": ate, "velocidade": A.velocidade, "espelhar": A.espelhar, "zoom": A.zoom, "foco": A.foco, "girar": A.girar,
           "queimou_em": (fim_queima / A.fps) if fim_queima is not None else None, "resto": [round(v, 3) for v in restos[::3]]},
          open(os.path.join(A.saida, "fogo.json"), "w"), indent=1)
print(f"  fogo real: {k} quadros ({k / A.fps:.2f} s) em {A.saida}; a caixa queima toda em "
      f"{(fim_queima / A.fps) if fim_queima is not None else 'nunca (aumente --ate ou --zoom)'} s")
