#!/usr/bin/env python3
"""
Lê de 1 a 6 vídeos de referência e mede o que dá para medir, para o Claude olhar junto e, se a pessoa quiser, guardar
como um ESTILO com nome ("edita no estilo <nome>").

Por referência:
  - duração, formato, cortes por minuto, tempo de cada bloco (mediana, mais curto, mais longo), primeiro corte
  - fala: palavras por minuto, quando entra a primeira palavra
  - tela (2 quadros por segundo, detector de rosto local): % do tempo com o rosto cheio, com o rosto embaixo (tela
    dividida), sem rosto (print, card, gravação de tela) e zooms por minuto (o rosto muda de tamanho sem corte)
  - som: se tem música por baixo da fala (o fundo entre as frases) e quantos efeitos sonoros por minuto (estalos)
  - folha de contato (1 quadro por segundo) e um quadro logo depois de cada corte, para olhar a legenda, os cards e a cor
Com --estilo <nome>: junta as medidas (mediana de todas) em minhas-referencias/estilos/<nome>.json, com a tradução para
a edição (receita, pausa máxima, troca de tela, zoom, legenda, som), e escreve a folha legível <nome>.md + <nome>.jpg.
A parte que só se vê olhando (legenda, cards, cor) fica em "visto": a IA preenche depois de olhar as folhas e roda
--folha <nome> para refazer a folha legível.

Uso:
  <python do projeto> motor/referencia.py <arquivo-ou-link> <pasta-de-saida>                (uma referência, como antes)
  <python do projeto> motor/referencia.py <ref1> <ref2> ... <ref6> --estilo <nome>           (estilo salvo)
  <python do projeto> motor/referencia.py --folha <nome>                                     (refaz <nome>.md depois do "visto")
  <python do projeto> motor/referencia.py --aplicar <nome> edicoes/<pasta>                   (leva o estilo para o projeto.json)
  <python do projeto> motor/referencia.py --lista                                            (estilos salvos)
Link (Instagram, TikTok, YouTube): baixa sozinho. Se o site pedir login, usa o login do navegador da pessoa neste
computador (nada sai da máquina). Na primeira vez o Mac pode pedir a senha do Chaveiro: é normal.
"""
import _utf8  # noqa: F401 (Windows em UTF-8)
import datetime
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile

M = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(M, ".."))
ESTILOS = os.path.join(RAIZ, "minhas-referencias", "estilos")
med = lambda v: round(statistics.median(v), 2) if v else None


def baixar(link, OUT):
    """Baixa o vídeo do link. Tenta sem login; se o site pedir (Instagram quase sempre pede), usa sozinho o login
    do navegador da própria pessoa, só neste computador: Chrome primeiro, depois Firefox. O Chrome aberto trava o
    banco de cookies, então lê de uma cópia temporária que é apagada logo depois."""
    YTDLP = [sys.executable, "-m", "yt_dlp"]  # instalado no python do projeto (requirements.txt), Mac e Windows
    alvo = os.path.join(OUT, "referencia.%(ext)s")
    tentativas = [[]]
    chrome = os.path.expanduser("~/Library/Application Support/Google/Chrome")
    if sys.platform == "darwin":
        if os.path.exists(os.path.join(chrome, "Default", "Cookies")):
            tentativas.append(("chrome", os.path.join(OUT, "_chrome")))
        if os.path.isdir(os.path.expanduser("~/Library/Application Support/Firefox")):
            tentativas.append(["--cookies-from-browser", "firefox"])
    else:  # Windows: o Firefox funciona sempre; Chrome e Edge às vezes protegem o login e o yt-dlp não consegue ler
        tentativas += [["--cookies-from-browser", n] for n in ("firefox", "chrome", "edge")]
    for t in tentativas:
        extra = t
        if isinstance(t, tuple):
            os.makedirs(os.path.join(t[1], "Default"), exist_ok=True)
            shutil.copy(os.path.join(chrome, "Default", "Cookies"), os.path.join(t[1], "Default", "Cookies"))
            shutil.copy(os.path.join(chrome, "Local State"), os.path.join(t[1], "Local State"))
            extra = ["--cookies-from-browser", f"chrome:{t[1]}"]
        r = subprocess.run([*YTDLP, "-q", "--no-warnings", *extra, "-f", "mp4/best", "-o", alvo, link], capture_output=True, text=True)
        if isinstance(t, tuple):
            shutil.rmtree(t[1], ignore_errors=True)
        achados = [f for f in os.listdir(OUT) if f.startswith("referencia.") and not f.endswith(".part")]
        if r.returncode == 0 and achados:
            return os.path.join(OUT, achados[0])
    sys.exit(f"Não consegui baixar {link} (o post pode ser privado ou o navegador não está logado). "
             "Peça o arquivo do vídeo (o Instagram deixa baixar) ou 3 prints.")


def detector_de_rosto():
    """O mesmo detector do preparar.py: Vision da Apple no Mac, OpenCV no Windows."""
    binario = os.path.join(M, "_bin", "rosto")
    fonte = os.path.join(M, "rosto.swift")
    if sys.platform == "darwin" and shutil.which("swiftc") and (not os.path.exists(binario) or os.path.getmtime(binario) < os.path.getmtime(fonte)):
        os.makedirs(os.path.dirname(binario), exist_ok=True)
        subprocess.run(["swiftc", "-O", fonte, "-o", binario], capture_output=True)
    return [binario] if os.path.exists(binario) else [sys.executable, os.path.join(M, "rosto.py")]


def tela(ent, dur, cortes):
    """2 quadros por segundo: onde está o rosto em cada um → % do tempo com rosto cheio, embaixo (tela dividida), sem rosto,
    e zooms por minuto (o rosto muda de tamanho mais de 12% de um quadro para o outro, sem corte no meio)."""
    tmp = tempfile.mkdtemp(prefix="ref-tela-")
    try:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", ent, "-vf", "fps=2,scale=480:480:force_original_aspect_ratio=decrease",
                        "-q:v", "4", os.path.join(tmp, "%05d.jpg")], check=True)
        r = subprocess.run([*detector_de_rosto(), tmp], capture_output=True, text=True)
        d = json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    q = d.get("por_quadro")
    if not q:
        return None
    n = len(q)
    cheio = embaixo = sem = pequeno = 0
    for b in q:
        if not b:
            sem += 1
            continue
        cy, h = (b[1] + b[3]) / 2, b[3] - b[1]
        if h < 0.07:
            pequeno += 1          # rosto numa janelinha (gravação de tela com câmera, por exemplo)
        elif cy > 0.58:
            embaixo += 1          # rosto na metade de baixo: tela dividida
        else:
            cheio += 1
    # zoom: o rosto muda de tamanho mais de 18% e FICA assim: 1,5 s estável antes (3 quadros) e 1,5 s estável depois,
    # no mesmo lugar (rosto cheio ↔ embaixo é troca de layout) e longe de corte. A caixa do detector oscila até 20% com a
    # mão perto do rosto: mudança que não se sustenta não conta.
    zooms, ult = 0, -9
    alt = [(b[3] - b[1]) if b else None for b in q]
    cyy = [((b[1] + b[3]) / 2) if b else None for b in q]
    estavel = lambda v: max(v) / max(min(v), 1e-6) < 1.12
    for i in range(3, n - 3):
        antes, depois = alt[i - 3:i], alt[i:i + 3]
        if any(v is None for v in antes + depois) or any(abs(i / 2 - c) < 1.5 for c in cortes) or i / 2 - ult < 2:
            continue
        if max(cyy[i - 3:i + 3]) - min(cyy[i - 3:i + 3]) > 0.08 or not (estavel(antes) and estavel(depois)):
            continue
        a, b = statistics.median(antes), statistics.median(depois)
        if a > 0.05 and abs(b - a) / a > 0.18:
            zooms += 1
            ult = i / 2
    pct = lambda k: round(100 * k / max(n, 1))
    return {"rosto_cheio_pct": pct(cheio), "rosto_embaixo_pct": pct(embaixo), "rosto_pequeno_pct": pct(pequeno),
            "sem_rosto_pct": pct(sem), "zooms_por_minuto": round(zooms / max(dur, 1) * 60, 1)}


def som(ent, palavras):
    """Fundo entre as frases (música por baixo?) e estalos fora da fala (efeitos sonoros por minuto). Estimativa: 🟡."""
    import numpy as np
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", ent, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True)
    x = np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768
    if not len(x):
        return None
    n = 160  # 10 ms
    m = len(x) // n
    e = 20 * np.log10(np.sqrt((x[:m * n].reshape(m, n) ** 2).mean(1)) + 1e-9)
    fala = np.zeros(m, bool)
    for w in palavras:
        fala[max(0, int(w["s"] * 100) - 5):int(w["e"] * 100) + 5] = True
    voz = float(np.percentile(e[fala], 70)) if fala.any() else float(np.percentile(e, 80))
    # o fundo é medido só nas pausas de 0,35 s ou mais (sem a borda das palavras); edição muito apertada não deixa
    # pausa para ouvir: aí a resposta é "incerto" e a IA confere ouvindo
    lacunas, i = [], 0
    while i < m:
        if not fala[i]:
            j = i
            while j < m and not fala[j]:
                j += 1
            if j - i >= 35:
                lacunas.append(float(np.percentile(e[i + 5:j - 5], 30)))
            i = j
        else:
            i += 1
    fundo = float(np.median(lacunas)) if len(lacunas) >= 3 else None
    # estalo: sobe mais de 14 dB em 30 ms fora da fala e passa de 20 dB abaixo da voz
    est, ult = 0, -100
    for i in range(3, m):
        if not fala[i] and e[i] - e[i - 3] > 14 and e[i] > voz - 20 and i - ult > 25:
            est += 1
            ult = i
    dur = m / 100
    musica = "incerto" if fundo is None else ("provável" if fundo > voz - 26 else "não")
    return {"voz_db": round(voz, 1), "fundo_entre_frases_db": None if fundo is None else round(fundo, 1),
            "musica": musica, "efeitos_sonoros_por_minuto": round(est / max(dur, 1) * 60, 1)}


def medir(ent, OUT):
    """Uma referência: baixa (se for link), mede, faz as folhas e grava <OUT>/ficha.json."""
    os.makedirs(OUT, exist_ok=True)
    fonte = ent
    if re.match(r"https?://", ent):
        ent = baixar(ent, OUT)
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                    "stream=width,height:format=duration", "-of", "json", ent], capture_output=True, text=True).stdout)
    dur = float(pr["format"]["duration"]); w, h = pr["streams"][0]["width"], pr["streams"][0]["height"]

    # trocas de cena: quadro muito diferente do anterior = corte. Mede o quadro inteiro e cada metade em separado: na tela
    # dividida a troca do print de cima muda só meia tela e passaria batido no quadro inteiro.
    achados = []
    for recorte, limiar in (("", 0.32), (",crop=iw:ih/2:0:0", 0.38), (",crop=iw:ih/2:0:ih/2", 0.38)):
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", ent, "-vf", f"scale=270:-2{recorte},select='gt(scene,{limiar})',showinfo", "-an", "-f", "null", "-"],
                           capture_output=True, text=True)
        achados += [round(float(t), 2) for t in re.findall(r"pts_time:([\d.]+)", r.stderr)]
    achados.sort()
    cortes = [c for i, c in enumerate(achados) if i == 0 or c - achados[i - 1] > 0.25]
    blocos = [b - a for a, b in zip([0] + cortes, cortes + [dur])]

    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", ent, "-vf", f"fps=1,scale=200:-2,tile=8x{int(dur // 8) + 1}", "-frames:v", "1",
                    "-q:v", "4", os.path.join(OUT, "folha.jpg")])
    if cortes:
        filtro = "+".join(f"between(t\\,{c + 0.1:.2f}\\,{c + 0.14:.2f})" for c in cortes[:40])
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", ent, "-vf", f"select='{filtro}',scale=200:-2,tile=8x{(min(40, len(cortes)) + 7) // 8}",
                        "-frames:v", "1", "-fps_mode", "vfr", "-q:v", "4", os.path.join(OUT, "cortes.jpg")])

    fala, ws = None, []
    base = os.path.join(OUT, "fala")
    if not (os.path.exists(base + ".json") and os.path.getmtime(base + ".json") > os.path.getmtime(ent)):   # cache da transcrição
        subprocess.run([sys.executable, os.path.join(M, "transcrever.py"), ent, base], capture_output=True, env={**os.environ, "EDITOR_IDIOMA": "auto"})
    if os.path.exists(base + ".json"):
        segs = json.load(open(base + ".json", encoding="utf-8"))["segments"]
        ws = [{"s": x["start"], "e": x["end"]} for s in segs for x in s.get("words", [])]
        if len(ws) > 10:
            tempo = sum(s["end"] - s["start"] for s in segs)
            fala = {"palavras": len(ws), "palavras_por_s": round(len(ws) / max(tempo, 1), 2),
                    "palavras_por_minuto": round(len(ws) / max(tempo, 1) * 60), "primeira_palavra_s": round(ws[0]["s"], 2)}

    ficha = {
        "fonte": fonte, "arquivo": ent, "duracao_s": round(dur, 1), "formato": f"{w}×{h}", "vertical": h > w,
        "cortes": len(cortes), "corta_a_cada_s": round(dur / (len(cortes) + 1), 2),
        "cortes_por_minuto": round(len(cortes) / max(dur, 1) * 60, 1),
        "bloco_mediano_s": med(blocos), "bloco_mais_curto_s": round(min(blocos), 2), "bloco_mais_longo_s": round(max(blocos), 2),
        "primeiro_corte_s": cortes[0] if cortes else None,
        "tempos_dos_cortes": cortes, "fala": fala,
        "tela": tela(ent, dur, cortes), "som": som(ent, ws),
        "olhe": ["folha.jpg (1 quadro por segundo)", "cortes.jpg (logo depois de cada corte)"],
    }
    json.dump(ficha, open(os.path.join(OUT, "ficha.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return ficha


# ------------------------------------------------------------------ estilo salvo
def juntar(fichas):
    """Mediana de cada medida entre as referências (com a faixa, para a IA ver se elas concordam)."""
    def col(f):
        v = [f(x) for x in fichas]
        return [y for y in v if y is not None]
    campos = {
        "cortes_por_minuto": lambda x: x["cortes_por_minuto"],
        "bloco_mediano_s": lambda x: x["bloco_mediano_s"],
        "bloco_mais_curto_s": lambda x: x["bloco_mais_curto_s"],
        "bloco_mais_longo_s": lambda x: x["bloco_mais_longo_s"],
        "primeiro_corte_s": lambda x: x["primeiro_corte_s"],
        "duracao_s": lambda x: x["duracao_s"],
        "palavras_por_minuto": lambda x: (x["fala"] or {}).get("palavras_por_minuto"),
        "primeira_palavra_s": lambda x: (x["fala"] or {}).get("primeira_palavra_s"),
        "rosto_cheio_pct": lambda x: (x["tela"] or {}).get("rosto_cheio_pct"),
        "rosto_embaixo_pct": lambda x: (x["tela"] or {}).get("rosto_embaixo_pct"),
        "rosto_pequeno_pct": lambda x: (x["tela"] or {}).get("rosto_pequeno_pct"),
        "sem_rosto_pct": lambda x: (x["tela"] or {}).get("sem_rosto_pct"),
        "zooms_por_minuto": lambda x: (x["tela"] or {}).get("zooms_por_minuto"),
        "efeitos_sonoros_por_minuto": lambda x: (x["som"] or {}).get("efeitos_sonoros_por_minuto"),
    }
    medido, faixa = {}, {}
    for k, f in campos.items():
        v = col(f)
        medido[k] = med(v)
        if len(v) > 1:
            faixa[k] = [round(min(v), 2), round(max(v), 2)]
    mus = col(lambda x: (x["som"] or {}).get("musica"))
    medido["musica"] = ("provável" if mus.count("provável") > len(mus) / 2 else "não" if mus.count("não") > len(mus) / 2 else "incerto") if mus else None
    medido["referencias"] = len(fichas)
    return medido, faixa


def traduzir(m, visto=None):
    """Das medidas para a edição deste editor (o que o Claude aplica quando a pessoa diz "edita no estilo <nome>")."""
    visto = visto or {}
    cpm = m.get("cortes_por_minuto") or 0
    tela_pct = (m.get("rosto_embaixo_pct") or 0) + (m.get("sem_rosto_pct") or 0)
    if tela_pct >= 45 and cpm >= 24:
        receita = "motion-de-produto"
    elif tela_pct >= 35:
        receita = "tela-dividida"
    elif cpm < 8:
        receita = "conversa-crua"
    else:
        receita = "rosto-e-ideia"
    ppm = m.get("palavras_por_minuto") or 170
    gapmax = 0.25 if ppm >= 200 or cpm >= 30 else 0.3 if ppm >= 165 else 0.45
    zpm = m.get("zooms_por_minuto") or 0
    bloco = m.get("bloco_mediano_s")
    return {
        "receita": receita,
        "gapmax": gapmax,
        "troca_de_tela_a_cada_s": bloco,
        "zoom": [1.0, 1.0] if zpm < 1 else [1.0, 1.12] if zpm < 6 else [1.0, 1.18],
        "legenda": visto.get("legenda_tipo") or "palavra",
        "legenda_ajuste": {"sobe": 0.12} if (visto.get("legenda_tipo") or "palavra") == "palavra" else {},
        "tela_dividida_pct": m.get("rosto_embaixo_pct"),
        "efeitos_por_minuto": round(cpm / 4, 1) if cpm else None,
        "som": "desenhado (whoosh nas trocas, clique no cursor, pop no número)" if (m.get("efeitos_sonoros_por_minuto") or 0) >= 2 else "discreto (só nas entradas)",
        "musica": False,
        "_musica": "A referência " + {"provável": "parece ter música por baixo", "não": "não tem música"}.get(m.get("musica"), "corta tão justo que não dá para medir a música (confira ouvindo)") +
                   ". Aqui música só entra se a pessoa pedir (edicao.trilha).",
    }


VISTO = {"_leia": "A IA preenche olhando folha.jpg e cortes.jpg de cada referência (o script não lê imagem). Depois: referencia.py --folha <nome>.",
         "legenda_tipo": None, "legenda": None, "cards_texto_pct": None, "prints_pct": None, "cor_destaque": None,
         "fundo": None, "movimento": None, "observacoes": []}


def folha_legivel(nome):
    arq = os.path.join(ESTILOS, nome + ".json")
    e = json.load(open(arq, encoding="utf-8"))
    m, ed, v = e["medido"], e["edicao"], e.get("visto") or {}
    f = lambda x, suf="": "—" if x is None else f"{x}{suf}".replace(".", ",")
    L = [f"# Estilo · {nome}", "",
         f"Medido em {e['criado']} a partir de {m['referencias']} referência(s). "
         f"Para usar: **\"edita esse vídeo no estilo {nome}\"**.", "",
         "## Ritmo", "",
         "| Medida | Valor |", "|---|---|",
         f"| Cortes por minuto | {f(m['cortes_por_minuto'])} |",
         f"| Tempo de cada bloco (mediana) | {f(m['bloco_mediano_s'], ' s')} (de {f(m['bloco_mais_curto_s'], ' s')} a {f(m['bloco_mais_longo_s'], ' s')}) |",
         f"| Primeiro corte | {f(m['primeiro_corte_s'], ' s')} |",
         f"| Palavras por minuto | {f(m['palavras_por_minuto'])} |",
         f"| Primeira palavra | {f(m['primeira_palavra_s'], ' s')} |",
         f"| Zooms por minuto | {f(m['zooms_por_minuto'])} |", "",
         "## Tela", "",
         "| Medida | Valor |", "|---|---|",
         f"| Rosto na tela toda | {f(m['rosto_cheio_pct'], '%')} do tempo |",
         f"| Rosto embaixo (tela dividida) | {f(m['rosto_embaixo_pct'], '%')} |",
         f"| Sem rosto (print, card, gravação) | {f(m['sem_rosto_pct'], '%')} |",
         f"| Prints (visto) | {f(v.get('prints_pct'), '%')} |",
         f"| Cards de texto (visto) | {f(v.get('cards_texto_pct'), '%')} |",
         f"| Legenda (visto) | {v.get('legenda') or '—'} |",
         f"| Cor de destaque (visto) | {v.get('cor_destaque') or '—'} |", "",
         "## Som", "",
         f"- Música por baixo: {m.get('musica') or '—'} · efeitos sonoros por minuto: {f(m['efeitos_sonoros_por_minuto'])}",
         f"- {ed['_musica']}", "",
         "## Como o editor aplica", "",
         f"- Receita: **{ed['receita']}** · pausa máxima {f(ed['gapmax'], ' s')} · zoom {ed['zoom']}",
         f"- Tela nova a cada ~{f(ed['troca_de_tela_a_cada_s'], ' s')} · legenda {ed['legenda']} · som {ed['som']}", ""]
    if v.get("observacoes"):
        L += ["## O que a IA viu", ""] + [f"- {o}" for o in v["observacoes"]] + [""]
    if e.get("faixa"):
        L += ["## As referências concordam?", "", "Faixa entre a menor e a maior: " +
              " · ".join(f"{k.replace('_', ' ')} {a}–{b}" for k, (a, b) in e["faixa"].items()), ""]
    L += ["## Referências", ""] + [f"{i + 1}. {r['fonte']} ({f(r['duracao_s'], ' s')}, {f(r['cortes_por_minuto'])} cortes/min)" for i, r in enumerate(e["referencias"])]
    L += ["", "> Medidas automáticas são estimativa (🟡): cortes pela troca de imagem, rosto pelo detector local, música e "
          "efeitos pelo volume entre as frases. O que só se vê olhando está em \"visto\"."]
    open(os.path.join(ESTILOS, nome + ".md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    return os.path.join(ESTILOS, nome + ".md")


def salvar_estilo(nome, fichas, pastas):
    os.makedirs(ESTILOS, exist_ok=True)
    medido, faixa = juntar(fichas)
    arq = os.path.join(ESTILOS, nome + ".json")
    visto = json.load(open(arq, encoding="utf-8")).get("visto") if os.path.exists(arq) else None
    e = {"nome": nome, "criado": datetime.date.today().isoformat(),
         "referencias": [{k: f[k] for k in ("fonte", "duracao_s", "formato", "cortes_por_minuto", "bloco_mediano_s")} | {"pasta": os.path.relpath(p, RAIZ)}
                         for f, p in zip(fichas, pastas)],
         "medido": medido, "faixa": faixa, "visto": visto or dict(VISTO), "edicao": traduzir(medido, visto)}
    json.dump(e, open(arq, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # folha de imagens: os quadros logo depois dos cortes de cada referência, um embaixo do outro
    imgs = [os.path.join(p, "cortes.jpg") if os.path.exists(os.path.join(p, "cortes.jpg")) else os.path.join(p, "folha.jpg") for p in pastas]
    imgs = [i for i in imgs if os.path.exists(i)]
    if imgs:
        try:
            from PIL import Image
            ims = [Image.open(i).convert("RGB") for i in imgs]
            larg = max(i.width for i in ims)
            ims = [i.resize((larg, int(i.height * larg / i.width))) for i in ims]
            tudo = Image.new("RGB", (larg, sum(i.height for i in ims) + 8 * (len(ims) - 1)), (20, 20, 22))
            y = 0
            for i in ims:
                tudo.paste(i, (0, y)); y += i.height + 8
            tudo.save(os.path.join(ESTILOS, nome + ".jpg"), quality=85)
        except Exception as erro:  # noqa: BLE001
            print("  (folha de imagens não saiu:", erro, ")")
    return arq, folha_legivel(nome)


def aplicar(nome, pasta):
    """Leva o estilo para o projeto.json (só o que a pessoa não definiu) e devolve as metas do plano."""
    e = json.load(open(os.path.join(ESTILOS, nome + ".json"), encoding="utf-8"))
    ed = traduzir(e["medido"], e.get("visto"))
    pj_arq = os.path.join(pasta, "projeto.json")
    pj = json.load(open(pj_arq, encoding="utf-8"))
    edicao = pj.setdefault("edicao", {})
    edicao["estilo"] = nome
    edicao.setdefault("receita", ed["receita"])
    edicao.setdefault("legenda", ed["legenda"])
    edicao.setdefault("zoom", ed["zoom"])
    if ed["legenda_ajuste"]:
        edicao.setdefault("legenda_ajuste", ed["legenda_ajuste"])
    json.dump(pj, open(pj_arq, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    metas = {"estilo": nome, "receita": ed["receita"], "gapmax_no_edl": ed["gapmax"], "tela_nova_a_cada_s": ed["troca_de_tela_a_cada_s"],
             "tela_dividida_pct": ed["tela_dividida_pct"], "efeitos_por_minuto": ed["efeitos_por_minuto"], "som": ed["som"], "musica": ed["_musica"],
             "visto": {k: v for k, v in (e.get("visto") or {}).items() if not k.startswith("_") and v}}
    print(json.dumps(metas, ensure_ascii=False, indent=1))


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        sys.exit(__doc__)
    if args[0] == "--lista":
        os.makedirs(ESTILOS, exist_ok=True)
        for f in sorted(os.listdir(ESTILOS)):
            if f.endswith(".json"):
                e = json.load(open(os.path.join(ESTILOS, f), encoding="utf-8"))
                print(f"{e['nome']}: {e['medido']['referencias']} referência(s), {e['edicao']['receita']}, criado em {e['criado']}")
        return
    if args[0] == "--folha":
        print(folha_legivel(args[1]))
        return
    if args[0] == "--aplicar":
        aplicar(args[1], os.path.abspath(args[2]))
        return
    nome = None
    if "--estilo" in args:
        i = args.index("--estilo"); nome = re.sub(r"[^\w-]+", "-", args[i + 1].strip().lower()).strip("-"); del args[i:i + 2]
    if nome:
        refs = args
        if not 1 <= len(refs) <= 6:
            sys.exit("Mande de 1 a 6 referências.")
        base = os.path.join(ESTILOS, nome)
    else:
        if len(args) != 2:
            sys.exit("Uso: referencia.py <arquivo-ou-link> <pasta-de-saida>   ou   referencia.py <ref1> ... <ref6> --estilo <nome>")
        refs, base = args[:1], os.path.abspath(args[1])
    pastas = [base] if len(refs) == 1 and not nome else [os.path.join(base, f"ref-{i + 1}") for i in range(len(refs))]
    fichas = []
    for ref, pasta in zip(refs, pastas):
        print(f"  lendo {ref} …", flush=True)
        f = medir(ref, pasta)
        fichas.append(f)
        print(json.dumps({k: v for k, v in f.items() if k not in ("tempos_dos_cortes", "olhe")}, ensure_ascii=False, indent=1))
    if nome:
        arq, md = salvar_estilo(nome, fichas, pastas)
        print(f"  estilo salvo: {os.path.relpath(arq, RAIZ)} · folha: {os.path.relpath(md, RAIZ)}")
        print("  falta o que só se vê olhando: preencha \"visto\" no json (legenda, cards, prints, cor) e rode --folha", nome)


if __name__ == "__main__":
    main()
