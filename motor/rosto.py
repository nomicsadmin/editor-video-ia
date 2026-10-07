#!/usr/bin/env python3
"""
Onde está o rosto (Windows e Mac sem as ferramentas da Apple): OpenCV, local, só localização (não identifica ninguém).
Mesma saída do rosto.swift: JSON com a caixa do maior rosto de cada quadro (0 a 1, origem no topo) e a mediana.
Uso:  python motor/rosto.py <pasta-com-jpgs>
"""
import json
import os
import sys

import cv2

pasta = sys.argv[1]
det = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
arqs = sorted(f for f in os.listdir(pasta) if f.endswith(".jpg"))
caixas = []
for f in arqs:
    im = cv2.imread(os.path.join(pasta, f))
    if im is None:
        continue
    h, w = im.shape[:2]
    rs = det.detectMultiScale(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), scaleFactor=1.1, minNeighbors=6, minSize=(w // 8, w // 8))
    if len(rs):
        x, y, bw, bh = max(rs, key=lambda r: r[2] * r[3])
        # calibrado contra o Vision da Apple no mesmo vídeo (07/Out/2026): queixo a menos de 1% de diferença
        caixas.append([x / w, y / h, (x + bw) / w, min(1.0, (y + bh * 1.03) / h)])
med = lambda i: sorted(c[i] for c in caixas)[len(caixas) // 2] if caixas else -1
print(json.dumps({"quadros": len(arqs), "com_rosto": len(caixas),
                  "mediana": {"x0": med(0), "y0": med(1), "x1": med(2), "y1": med(3)}, "caixas": caixas}))
