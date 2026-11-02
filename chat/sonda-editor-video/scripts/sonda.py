#!/usr/bin/env python3
"""Sonda do editor de vídeo no chat do Claude.

Mede o que o ambiente de código do claude.ai aguenta e, no fim, edita os primeiros
15 s do vídeo enviado com legenda animada palavra por palavra e efeitos.

uso: python3 sonda.py <etapa> [--video ARQ] [--saida PASTA] [--legenda palavra|blocos|normal|todas] [--fonte nome|número]
         [--estilo estilo.json] [--ref imagem-ou-video]
         [--headline "texto" | --headline sem] [--headline-modo abertura|fixa] [--sem-cortes] [--pausa 0.35]
etapas, nesta ordem: ambiente · ffmpeg · whisper · [referencia] · fontes · chromium · demo · conferir · relatorio
"""
import os, re, sys, json, time, shutil, platform, subprocess, traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(AQUI, "..", "assets")
TMP = os.environ.get("SONDA_TMP", "/tmp/sonda")
LIMITE = 90          # segundos do bruto que a sonda lê (reels de até 1 min e meio)
ESTADO = os.path.join(TMP, "estado.json")
os.makedirs(TMP, exist_ok=True)


def carregar():
    return json.load(open(ESTADO)) if os.path.exists(ESTADO) else {"etapas": {}}


def salvar(e):
    json.dump(e, open(ESTADO, "w"), ensure_ascii=False, indent=1)


def sh(cmd, timeout=600, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, **kw)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def pip(*pacotes, timeout=900):
    return sh([sys.executable, "-m", "pip", "install", "-q", "--disable-pip-version-check", *pacotes], timeout=timeout)


def registrar(nome, fn):
    e = carregar()
    t0 = time.time()
    try:
        ok, detalhe = fn(e)
    except Exception as ex:
        ok, detalhe = False, f"{type(ex).__name__}: {ex}\n{traceback.format_exc()[-1500:]}"
    e = {**carregar(), **{k: v for k, v in e.items() if k != "etapas"}}
    e.setdefault("etapas", {})[nome] = {"ok": ok, "segundos": round(time.time() - t0, 1), "detalhe": detalhe}
    salvar(e)
    print(f"[{'OK' if ok else 'FALHOU'}] {nome} em {time.time()-t0:.1f}s\n{detalhe}")


# ---------------------------------------------------------------- etapas
def ambiente(e):
    linhas = [f"python {platform.python_version()} · {platform.platform()} · arquitetura {platform.machine()}",
              f"núcleos: {os.cpu_count()}"]
    try:
        mem = open("/proc/meminfo").read().split("\n")[0]
        linhas.append(f"memória: {mem}")
    except Exception:
        pass
    du = shutil.disk_usage("/tmp")
    linhas.append(f"disco livre em /tmp: {du.free/1e9:.1f} GB")
    for p in ["/mnt/user-data/uploads", "/mnt/user-data/outputs", "/mnt/data", os.getcwd()]:
        if os.path.isdir(p):
            linhas.append(f"pasta {p}: {', '.join(sorted(os.listdir(p))[:12]) or '(vazia)'}")
    for prog in ["ffmpeg", "ffprobe", "node", "npm", "git"]:
        linhas.append(f"{prog}: {shutil.which(prog) or 'não tem'}")
    rc, out = sh(["curl", "-sI", "--max-time", "8", "https://huggingface.co"], timeout=15)
    linhas.append("huggingface.co: " + ("acessível" if rc == 0 and "HTTP" in out else "bloqueado"))
    rc, out = sh(["curl", "-sI", "--max-time", "8", "https://pypi.org/simple/"], timeout=15)
    linhas.append("pypi.org: " + ("acessível" if rc == 0 and "HTTP" in out else "bloqueado"))
    return True, "\n".join(linhas)


def ffmpeg(e):
    exe = shutil.which("ffmpeg")
    origem = "já instalado"
    if not exe:
        rc, out = pip("imageio-ffmpeg")
        if rc:
            return False, "pip imageio-ffmpeg falhou:\n" + out[-800:]
        import importlib; import imageio_ffmpeg; importlib.reload(imageio_ffmpeg)
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        origem = "pacote imageio-ffmpeg (pypi)"
    e["ffmpeg"] = exe
    rc, filtros = sh([exe, "-hide_banner", "-filters"])
    rc, enc = sh([exe, "-hide_banner", "-encoders"])
    rc, ver = sh([exe, "-version"])
    quer = ["subtitles", "ass", "drawtext", "zoompan", "rgbashift", "xfade", "vignette", "loudnorm", "eq"]
    tem = {f: bool(re.search(rf"\s{f}\s", filtros)) for f in quer}
    e["filtros"] = tem
    lin = [f"ffmpeg: {exe} ({origem})", ver.split("\n")[0],
           "filtros: " + " · ".join(f"{k} {'sim' if v else 'NÃO'}" for k, v in tem.items()),
           "libx264: " + ("sim" if "libx264" in enc else "NÃO"),
           "libass: " + ("sim" if "--enable-libass" in ver else "NÃO")]
    return tem["subtitles"] or tem["ass"], "\n".join(lin)


def whisper(e):
    rc, out = pip("faster-whisper")
    if rc:
        return False, "pip faster-whisper falhou:\n" + out[-800:]
    from faster_whisper import WhisperModel
    lin = []
    modelo = None
    for nome in ["small", "base", "tiny"]:
        t0 = time.time()
        try:
            modelo = WhisperModel(nome, device="cpu", compute_type="int8")
            lin.append(f"modelo {nome}: baixou e carregou em {time.time()-t0:.0f}s")
            e["modelo"] = nome
            break
        except Exception as ex:
            lin.append(f"modelo {nome}: falhou ({type(ex).__name__}: {str(ex)[:200]})")
    if not modelo:
        return False, "\n".join(lin)
    if e.get("video"):
        # áudio já decodificado pelo ffmpeg: o leitor do PyAV muda de API entre versões e quebra o transcritor
        import numpy as np
        bruto = subprocess.run([e["ffmpeg"], "-v", "error", "-t", str(LIMITE), "-i", e["video"], "-vn", "-ac", "1",
                                "-ar", "16000", "-f", "f32le", "-"], capture_output=True, timeout=300).stdout
        audio = np.frombuffer(bruto, np.float32)
        t0 = time.time()
        segs, info = modelo.transcribe(audio, language="pt", word_timestamps=True, vad_filter=False)
        palavras = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
        e["palavras"] = palavras
        lin.append(f"transcreveu {len(audio)/16000:.1f} s em {time.time()-t0:.1f}s: {len(palavras)} palavras")
        lin.append("texto: " + " ".join(p["w"] for p in palavras)[:300])
    return True, "\n".join(lin)


def chromium(e):
    if not shutil.which("npm"):
        return False, "sem npm no ambiente"
    d = os.path.join(TMP, "chromium")
    os.makedirs(d, exist_ok=True)
    rc, out = sh(["npm", "install", "--silent", "--prefix", d, "@sparticuz/chromium", "puppeteer-core"], timeout=600)
    if rc:
        return False, "npm falhou:\n" + out[-800:]
    js = os.path.join(d, "teste.js")
    open(js, "w").write("""
const chromium = require('@sparticuz/chromium'); const p = require('puppeteer-core');
(async () => {
  const b = await p.launch({args: chromium.args, executablePath: await chromium.executablePath(), headless: true});
  const pg = await b.newPage(); await pg.setViewport({width: 1080, height: 1920});
  await pg.setContent('<body style="margin:0;background:#111;display:grid;place-items:center;height:100vh">'
    + '<h1 style="font:900 120px sans-serif;color:#FFE635">motion ok</h1></body>');
  await pg.screenshot({path: process.argv[2]}); await b.close(); console.log('ok');
})().catch(e => { console.error(e.message); process.exit(1); });
""")
    t0 = time.time()
    rc, out = sh(["node", js, os.path.join(TMP, "chromium.png")], timeout=180, cwd=d)
    return rc == 0, f"render HTML com Chromium: {'funcionou' if rc == 0 else 'falhou'} em {time.time()-t0:.1f}s\n{out[-600:]}"


# ---------------------------------------------------------------- legenda
FONTES = {
    # chave: (família no arquivo, nome para a pessoa, escala do tamanho, jeito)
    "manrope": ("Manrope ExtraBold", "Manrope", 1.00, "moderna e limpa"),
    "montserrat": ("Montserrat Black", "Montserrat", 0.95, "clássica de reels, bem pesada"),
    "anton": ("Anton", "Anton", 1.12, "condensada de impacto"),
    "bebas": ("Bebas Neue", "Bebas Neue", 1.30, "alta e estreita, só maiúsculas"),
    "poppins": ("Poppins ExtraBold", "Poppins", 1.06, "redonda e amigável"),
    "bricolage": ("Bricolage ExtraBold", "Bricolage", 1.00, "atual, com personalidade"),
    "instrument": ("Instrument Serif Italic", "Instrument Serif", 1.28, "elegante, com serifa e itálico"),
}
FONTES_DIR = os.path.join(ASSETS, "fontes")
TAMANHO_BASE = {"palavra": 138, "blocos": 100, "normal": 64}
MODOS = list(TAMANHO_BASE)

# Estilo padrão: sem traço, sombra suave, sem cor de destaque (a palavra da vez fica cheia, as outras apagadas).
# Uma referência da pessoa vira um JSON com estes mesmos campos (ver referencias/estilo.md).
ESTILO_PADRAO = {
    "modo": "blocos",          # palavra · blocos · normal
    "fonte": "manrope",        # chave de FONTES
    "caixa": "auto",           # auto (maiúsculas em palavra/blocos, normal na frase) · alta · normal
    "cor": "#FFFFFF",          # cor do texto
    "destaque": None,          # cor da palavra da vez; None = sem cor, as outras ficam apagadas
    "apagadas": 0.78,          # opacidade das outras palavras do bloco quando não há cor de destaque
    "contorno": 0,             # espessura do traço em px (0 = sem traço)
    "cor_contorno": "#000000",
    "sombra": "suave",         # suave · dura · nenhuma
    "fundo": None,             # cor da tarja atrás do texto; None = sem tarja
    "fundo_opacidade": 0.8,
    "altura": 0.73,            # linha de base do texto (0 = topo, 1 = pé do vídeo)
    "tamanho": 1.0,            # multiplica o tamanho da fonte
    "animacao": "pop",         # pop · fade · nenhuma
}


def cor_ass(hexcor, opac=1.0):
    h = hexcor.lstrip("#")
    return f"&H{int(round((1-opac)*255)):02X}{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def cor_tag(hexcor):
    h = hexcor.lstrip("#")
    return f"&H{h[4:6]}{h[2:4]}{h[0:2]}&".upper()


def alfa(opac):
    return f"&H{int(round((1-opac)*255)):02X}&"


def ass_tempo(t):
    h, r = divmod(max(t, 0), 3600); m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def blocos(palavras, maxp=3, pausa=0.35):
    out, atual = [], []
    for p in palavras:
        if atual and (len(atual) >= maxp or p["s"] - atual[-1]["e"] > pausa):
            out.append(atual); atual = []
        atual.append(p)
    if atual:
        out.append(atual)
    return out


def limpa(w):
    return re.sub(r"[{}\\]", "", w)


def caixa_alta(w):
    return re.sub(r"[,.;:!?…]+$", "", limpa(w)).upper()


def frases(palavras, maxc=34, pausa=0.5):
    """Legenda normal: corta na pausa, no fim de frase, na vírgula depois de meia linha ou quando passa de 2 linhas."""
    out, atual = [], []
    for p in palavras:
        if atual:
            txt = " ".join(q["w"] for q in atual + [p])
            ant = " ".join(q["w"] for q in atual)
            if (p["s"] - atual[-1]["e"] > pausa or re.search(r"[.?!]$", atual[-1]["w"])
                    or (atual[-1]["w"].endswith(",") and len(ant) >= 18) or len(txt) > 2 * maxc):
                out.append(atual); atual = []
        atual.append(p)
    if atual:
        out.append(atual)
    return out


def quebra(ws, maxc=34):
    l1, l2 = [], []
    for w in ws:
        (l1 if not l2 and len(" ".join(l1 + [w])) <= maxc else l2).append(w)
    return " ".join(l1) + ("\\N" + " ".join(l2) if l2 else "")


CABECALHO = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{estilos}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


class Legenda:
    """Gera o .ass de um estilo. A sombra suave é uma camada de baixo, preta e desfocada, um pouco deslocada."""

    def __init__(self, est):
        self.e = {**ESTILO_PADRAO, **{k: v for k, v in est.items() if v is not None or k in ("destaque", "fundo")}}
        e = self.e
        fam, _, esc, _ = FONTES[e["fonte"]]
        self.tam = round(TAMANHO_BASE[e["modo"]] * esc * e["tamanho"])
        self.y = round(e["altura"] * 1920)
        if e["fundo"]:   # tarja: BorderStyle 3, a "borda" vira a caixa
            borda, cor_borda, tipo = max(14, round(self.tam * 0.18)), cor_ass(e["fundo"], e["fundo_opacidade"]), 3
        else:
            borda, cor_borda, tipo = e["contorno"], cor_ass(e["cor_contorno"]), 1
        dura = 3 if e["sombra"] == "dura" and not e["fundo"] else 0
        self.sombra_suave = e["sombra"] == "suave" and not e["fundo"]
        self.estilos = [
            f"Leg,{fam},{self.tam},{cor_ass(e['cor'])},{cor_ass(e['cor'])},{cor_borda},&H80000000,"
            f"0,0,0,0,100,100,0,0,{tipo},{borda},{dura},2,60,60,0,1",
            f"Som,{fam},{self.tam},&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,60,60,0,1",
        ]
        th = round(96 * esc * e["tamanho"])        # headline: mesma fonte e acabamento da legenda, maior e no topo
        self.estilos += [
            f"Head,{fam},{th},{cor_ass(e['cor'])},{cor_ass(e['cor'])},{cor_borda},&H80000000,"
            f"0,0,0,0,100,100,0,0,{tipo},{borda if e['fundo'] else e['contorno']},{dura},8,60,60,0,1",
            f"HSom,{fam},{th},&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,8,60,60,0,1",
        ]
        self.ev = []

    def caixa(self, w):
        alta = self.e["caixa"] == "alta" or (self.e["caixa"] == "auto" and self.e["modo"] != "normal")
        return caixa_alta(w) if alta else limpa(w)

    def _linha(self, a, b, partes, entrada="", estilos=("Som", "Leg"), onde=None):
        """partes: lista de (palavra, ativa, forte). Escreve a camada da sombra (se houver) e a do texto."""
        e = self.e
        an, y = onde or (2, self.y)
        for camada in ([estilos[0]] if self.sombra_suave else []) + [estilos[1]]:
            som = camada == estilos[0]
            pos = f"\\an{an}\\pos({540 + (3 if som else 0)},{y + (8 if som else 0)})"
            base = "\\blur10\\1a&H48&" if som else "\\blur0.5"
            txt = []
            for w, ativa, forte in partes:
                tags = ""
                if ativa is False:                               # palavra que não é a da vez
                    if e["destaque"] is None:
                        op = e["apagadas"] * (0.53 if som else 1)
                        tags += f"\\1a{alfa(op)}"
                elif ativa:
                    if not som and e["destaque"]:
                        tags += f"\\1c{cor_tag(e['destaque'])}"
                    if som:
                        tags += "\\1a&H48&"
                    if e["animacao"] == "pop":
                        fim = 112 if forte else 108
                        tags += f"\\fscx100\\fscy100\\t(0,70,\\fscx120\\fscy120)\\t(70,170,\\fscx{fim}\\fscy{fim})"
                fecha = "\\1a&H48&" if som else "\\1a&H00&"
                fecha += "\\fscx100\\fscy100" + ("" if som or not e["destaque"] else f"\\1c{cor_tag(e['cor'])}")
                txt.append("{" + tags + "}" + w + "{" + fecha + "}" if tags else w)
            self.ev.append(f"Dialogue: {(0 if som else 1) + (2 if an == 8 else 0)},{ass_tempo(a)},{ass_tempo(b)},{camada},,0,0,0,,"
                           "{" + pos + base + entrada + "}" + " ".join(txt))

    def gerar(self, palavras, fortes=()):
        e = self.e
        if e["modo"] == "palavra":
            for i, p in enumerate(palavras):
                fim = min(palavras[i + 1]["s"], p["e"] + 0.6) if i + 1 < len(palavras) else p["e"] + 0.3
                forte = p["s"] in fortes
                ent = ""
                if e["animacao"] == "pop":
                    alvo = 112 if forte else 100
                    ent = f"\\fscx72\\fscy72\\t(0,80,\\fscx{alvo+12}\\fscy{alvo+12})\\t(80,160,\\fscx{alvo}\\fscy{alvo})"
                elif e["animacao"] == "fade":
                    ent = "\\fad(70,0)"
                cor = f"\\1c{cor_tag(e['destaque'])}" if forte and e["destaque"] else ""
                self._linha(p["s"], fim, [(self.caixa(p["w"]), None, forte)], ent + cor)
        elif e["modo"] == "normal":
            fs = frases(palavras)
            for k, f in enumerate(fs):
                fim = min(f[-1]["e"] + 0.25, fs[k + 1][0]["s"]) if k + 1 < len(fs) else f[-1]["e"] + 0.4
                ent = "\\fad(80,80)" if e["animacao"] != "nenhuma" else ""
                self._linha(f[0]["s"], fim, [(quebra([self.caixa(q["w"]) for q in f]), None, False)], ent)
        else:
            bs = blocos(palavras)
            for k, b in enumerate(bs):
                limite = bs[k + 1][0]["s"] if k + 1 < len(bs) else b[-1]["e"] + 0.5
                for i, p in enumerate(b):
                    fim = b[i + 1]["s"] if i + 1 < len(b) else min(b[-1]["e"] + 0.12, limite)
                    partes = [(self.caixa(q["w"]), j == i, q["s"] in fortes) for j, q in enumerate(b)]
                    ent = "\\fad(60,0)" if i == 0 and e["animacao"] != "nenhuma" else ""
                    self._linha(p["s"], fim, partes, ent)
        return self

    def headline(self, texto, a, b, modo="abertura"):
        """Título no topo: 'abertura' fica nos primeiros segundos; 'fixa' fica o vídeo todo."""
        linhas, atual = [], []
        for w in limpa(texto).split():
            if atual and len(" ".join(atual + [w])) > 20:
                linhas.append(" ".join(atual)); atual = []
            atual.append(w)
        linhas.append(" ".join(atual))
        ent = "\\fad(150,250)" if modo == "abertura" else "\\fad(150,0)"
        if self.e["animacao"] == "pop":
            ent += "\\fscx85\\fscy85\\t(0,120,\\fscx104\\fscy104)\\t(120,220,\\fscx100\\fscy100)"
        self._linha(a, b, [("\\N".join(linhas[:3]), None, False)], ent, estilos=("HSom", "Head"), onde=(8, 300))
        return self

    def salvar(self, caminho, extra_estilos=(), extra_eventos=()):
        open(caminho, "w", encoding="utf-8").write(
            CABECALHO.format(estilos="\n".join("Style: " + x for x in [*self.estilos, *extra_estilos]))
            + "\n".join([*self.ev, *extra_eventos]) + "\n")


# ---------------------------------------------------------------- cortes (só em pausa real, nunca em cima de palavra)
def envelope(ff, v):
    """Quanto o som está acima do limiar de fala, a cada 10 ms. Olha o volume E os agudos acima de 3 kHz:
    o "s" do fim de "perguntas" é baixo em volume e, olhando só o volume, o corte o tomava por silêncio."""
    import numpy as np
    def faixa(filtro):
        raw = subprocess.run([ff, "-v", "error", "-t", str(LIMITE), "-i", v, "-vn", "-ac", "1", "-ar", "16000", *filtro,
                              "-f", "s16le", "-"], capture_output=True, timeout=300).stdout
        x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
        n = len(x) // 160
        en = 20 * np.log10(np.sqrt((x[:n * 160].reshape(n, 160) ** 2).mean(1)) + 1e-9)
        piso, p90 = np.percentile(en, 15), np.percentile(en, 90)
        return en - (piso + min(9.0, max(3.0, 0.3 * (p90 - piso))))   # limiar se adapta ao ruído da gravação
    a, b = faixa([]), faixa(["-af", "highpass=f=3000,highpass=f=3000"])
    n = min(len(a), len(b))
    return np.maximum(a[:n], b[:n])


def em_som(env, t):
    """Há fala dos dois lados de t: cortar aqui come o fim de uma palavra ou o começo da outra."""
    q = lambda t0, t1: env[max(0, int(t0 * 100)):max(int(t0 * 100) + 1, int(t1 * 100))].max()
    return any(q(t + d - 0.03, t + d) > 4 and q(t + d, t + d + 0.03) > 4 for d in (-0.02, 0.0, 0.02))


def vale(env, t, direcao, alcance=0.6, minimo=8):
    """Primeira pausa real (>= 80 ms; menos que isso pode ser o fechamento de um "p" ou "t" dentro da palavra)."""
    i, fim, corrida = int(t * 100), int((t + direcao * alcance) * 100), 0
    while 0 <= i < len(env) and (i - fim) * direcao <= 0:
        corrida = corrida + 1 if env[i] <= 1 else 0
        if corrida >= minimo:
            return (i - direcao * (minimo // 2)) / 100
        i += direcao
    return None


def plano_de_cortes(env, palavras, dur, gapmax=0.35):
    """Pausas para tirar: silêncio medido no áudio >= gapmax, com respiro de 70 ms depois da fala e 50 ms antes."""
    pausas, ini = [], None
    for i in range(len(env) + 1):
        silencio = i < len(env) and env[i] <= 0
        if silencio and ini is None:
            ini = i
        elif not silencio and ini is not None:
            s0, s1 = ini / 100, i / 100
            ini = None
            if s1 - s0 < gapmax:
                continue
            c0 = 0.0 if s0 <= 0.01 else s0 + 0.07
            c1 = dur if s1 >= dur - 0.02 else s1 - 0.05
            # silêncio medido em cima de palavra de duração normal é fala baixa, não pausa: fica
            if any(w["e"] - w["s"] < 0.7 and min(c1, w["e"]) - max(c0, w["s"]) > 0.1 for w in palavras):
                continue
            # borda em cima de som anda para a pausa real, sempre para o lado que MANTÉM fala
            if c0 > 0 and em_som(env, c0):
                c0 = vale(env, c0, +1) or c1
            if c1 < dur and em_som(env, c1):
                c1 = vale(env, c1, -1) or c0
            if c1 - c0 >= 0.12:
                pausas.append((round(c0, 3), round(c1, 3)))
    # trecho longo sem nenhuma palavra (respiração, teclado, "hã") também sai; as bordas grudam no som real da
    # palavra de cada lado: o fim anda enquanto ainda há som (o "s" final), o começo recua até onde o som começa
    for w0, w1 in zip(palavras, palavras[1:]):
        if w1["s"] - w0["e"] <= 1.0:
            continue
        c0, lim = w0["e"], w0["e"] + 0.45
        while c0 < lim and max(env[min(len(env) - 1, int((c0 + d) * 100))] for d in (0, .01, .02, .03)) > 0:
            c0 += 0.01
        c1, lim = w1["s"], w1["s"] - 0.3
        while c1 > lim and max(env[max(0, int((c1 - d) * 100))] for d in (0, .01, .02)) > 0:
            c1 -= 0.01
        c0, c1 = c0 + 0.08, c1 - 0.06
        if c1 - c0 >= 0.3:
            pausas.append((round(c0, 3), round(c1, 3)))
    junta = []
    for c0, c1 in sorted(pausas):
        if junta and c0 <= junta[-1][1] + 0.05:
            junta[-1] = (junta[-1][0], max(junta[-1][1], c1))
        else:
            junta.append((c0, c1))
    pausas = junta
    trechos, t = [], 0.0
    for c0, c1 in pausas:
        if c0 - t > 0.05:
            trechos.append((t, c0))
        t = c1
    if dur - t > 0.05:
        trechos.append((t, dur))
    return pausas, trechos


def remapear(t, trechos):
    """Tempo do bruto -> tempo do vídeo cortado (None se caiu numa pausa tirada)."""
    acc = 0.0
    for a, b in trechos:
        if a - 0.02 <= t <= b + 0.02:
            return acc + min(max(t, a), b) - a
        acc += b - a
    return None


def conferir_cortes(env, palavras, pausas, dur):
    bordas = [x for c0, c1 in pausas for x in (c0, c1) if 0.01 < x < dur - 0.01]
    em_fala = [round(x, 2) for x in bordas if em_som(env, x)]
    comidas = [w["w"] for w in palavras for c0, c1 in pausas
               if w["e"] - w["s"] < 0.7 and min(c1, w["e"]) - max(c0, w["s"]) > 0.05]
    return em_fala, comidas


def estilo_da_sessao(e, **troca):
    est = {**ESTILO_PADRAO, **(e.get("estilo") or {}), **troca}
    if est["fonte"] not in FONTES:
        est["fonte"] = "manrope"
    return est


def demo(e):
    ff, v = e.get("ffmpeg"), e.get("video")
    if not (ff and v):
        return False, "precisa das etapas ffmpeg (e de um --video)"
    saida_dir = e.get("saida") or TMP
    os.makedirs(saida_dir, exist_ok=True)
    palavras = e.get("palavras") or []
    fonte_leg = "whisper"
    if not palavras:   # sem transcrição: legenda de exemplo, só para ver o estilo
        fonte_leg = "texto de exemplo (sem transcrição)"
        txt = "ESSA É A LEGENDA ANIMADA PALAVRA POR PALAVRA DO EDITOR NO CHAT".split()
        palavras = [{"w": w, "s": 0.4 + i * 0.38, "e": 0.4 + i * 0.38 + 0.34} for i, w in enumerate(txt)]
    rc, info = sh([ff, "-hide_banner", "-i", v])
    m = re.search(r"Duration: (\\d+):(\\d+):([\\d.]+)", info)
    dur_bruto = min(LIMITE, int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])) if m else max(p["e"] for p in palavras) + 0.8
    trechos, linha_cortes = [(0.0, dur_bruto)], "cortes: desligados"
    if fonte_leg == "whisper" and not e.get("sem_cortes"):
        env = envelope(ff, v)
        pausas, trechos = plano_de_cortes(env, palavras, dur_bruto, e.get("pausa", 0.35))
        em_fala, comidas = conferir_cortes(env, palavras, pausas, dur_bruto)
        tirado = sum(b - a for a, b in pausas)
        linha_cortes = (f"cortes: {len(pausas)} pausas tiradas ({tirado:.1f} s) · bordas em cima de fala: {len(em_fala)}"
                        f" {em_fala or ''} · palavras atingidas: {len(comidas)} {comidas or ''}")
        e["cortes"] = {"pausas": pausas, "em_fala": em_fala, "comidas": comidas}
        palavras = [{**w, "s": remapear(w["s"], trechos), "e": remapear(w["e"], trechos)} for w in palavras]
        palavras = [w for w in palavras if w["s"] is not None and w["e"] is not None]
    dur = sum(b - a for a, b in trechos)
    # palavras fortes: as 2 mais longas (≥ 6 letras) ganham punch-in, flash, glitch e som
    fortes = sorted([p for p in palavras if len(re.sub(r"\W", "", p["w"])) >= 6], key=lambda p: -len(p["w"]))[:2]
    ts = sorted(p["s"] for p in fortes) or [1.0]
    pedido = e.get("legenda") or estilo_da_sessao(e)["modo"]
    modos = MODOS if pedido == "todas" else [pedido]
    resumo = []
    for modo in modos:
        ok, txt = render_demo(e, ff, v, saida_dir, palavras, dur, fortes, ts, estilo_da_sessao(e, modo=modo), trechos)
        if not ok:
            return False, txt
        resumo.append(txt)
    head = f"headline ({e.get('headline_modo', 'abertura')}): {e['headline']}" if e.get("headline") else "headline: sem"
    return True, "\n".join(resumo) + f"\n{linha_cortes}\n{head}\nlegenda: {fonte_leg} · palavras fortes: {', '.join(p['w'] for p in fortes) or 'nenhuma (efeito em 1 s)'}"


def render_demo(e, ff, v, saida_dir, palavras, dur, fortes, ts, est, trechos):
    modo, fonte = est["modo"], est["fonte"]
    ass = os.path.join(TMP, f"leg-{modo}.ass")
    leg_ = Legenda(est).gerar(palavras, fortes={p["s"] for p in fortes})
    if e.get("headline"):
        fixa = e.get("headline_modo") == "fixa"
        leg_.headline(e["headline"], 0.0, dur if fixa else min(3.2, dur), "fixa" if fixa else "abertura")
    leg_.salvar(ass)
    # emenda dos trechos: cada pedaço com 8 ms de fade no áudio, para a emenda não estalar
    emenda = "".join(f"[0:v]trim={a:.3f}:{b:.3f},setpts=PTS-STARTPTS[v{k}];"
                     f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st={b-a-0.008:.3f}:d=0.008[a{k}];"
                     for k, (a, b) in enumerate(trechos))
    emenda += "".join(f"[v{k}][a{k}]" for k in range(len(trechos))) + f"concat=n={len(trechos)}:v=1:a=1[vc][ac];"
    zoom = "+".join(f"0.15*between(t,{t:.3f},{t+0.45:.3f})*(1-(t-{t:.3f})/0.45)" for t in ts)
    flash = "+".join(f"between(t,{t:.3f},{t+0.07:.3f})" for t in ts)
    glitch = "+".join(f"between(t,{t-0.05:.3f},{t+0.06:.3f})" for t in ts)
    fil = e.get("filtros", {})
    leg = f"subtitles={ass}:fontsdir={os.path.abspath(FONTES_DIR)}"
    cadeia = [
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30",
        "eq=contrast=1.06:saturation=1.12",
        f"scale=w='trunc(1080*(1+{zoom})/2)*2':h='trunc(1920*(1+{zoom})/2)*2':eval=frame,crop=1080:1920",
    ]
    if fil.get("rgbashift"):
        cadeia.append(f"rgbashift=rh=-14:bh=14:enable='{glitch}'")
    if fil.get("vignette"):
        cadeia.append("vignette=PI/5")
    # flash por baixo da legenda: a palavra continua legível no clarão
    vf = (f"{emenda}[vc]{','.join(cadeia)}[base];color=white:s=1080x1920:r=30,format=rgba,colorchannelmixer=aa=0.45[fl];"
          f"[base][fl]overlay=0:0:shortest=1:enable='{flash}',{leg},format=yuv420p[v]")
    sons = [os.path.join(ASSETS, "whoosh-short.mp3"), os.path.join(ASSETS, "impact-bass-1.mp3")]
    ins, mix = [], ["[ac]volume=1.0[a0]"]
    for k, t in enumerate(ts):
        ins += ["-i", sons[k % 2]]
        ms = int(max(t - 0.12, 0) * 1000)
        mix.append(f"[{k+1}:a]adelay={ms}|{ms},volume=0.55[s{k}]")
    rotulos = "[a0]" + "".join(f"[s{k}]" for k in range(len(ts)))
    mix.append(f"{rotulos}amix=inputs={len(ts)+1}:normalize=0,loudnorm=I=-14:TP=-1.5[a]")
    out = os.path.join(saida_dir, f"sonda-demo-{modo}-{fonte}.mp4")
    teto = min(9.0, 27 * 8 / max(dur, 1) - 0.2)          # Mbit/s para o arquivo caber nos 30 MB do chat
    cmd = [ff, "-y", "-v", "error", "-t", f"{min(LIMITE, trechos[-1][1]) + 0.1:.2f}", "-i", v, *ins,
           "-filter_complex", vf + ";" + ";".join(mix),
           "-map", "[v]", "-map", "[a]", "-t", f"{dur:.2f}", "-c:v", "libx264", "-preset", "medium", "-crf", "21",
           "-maxrate", f"{teto:.1f}M", "-bufsize", f"{2*teto:.1f}M", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]
    t0 = time.time()
    rc, log = sh(cmd, timeout=900)
    if rc:
        return False, "render falhou:\n" + log[-1500:]
    mb = os.path.getsize(out) / 1e6
    return True, f"demo {modo} · {FONTES[fonte][1]}: {out} · {dur:.1f}s · {mb:.1f} MB · render em {time.time()-t0:.0f}s"


def fontes(e):
    """Cartela: a mesma legenda em cada fonte, sobre um quadro do vídeo da pessoa, numerada para ela escolher."""
    ff, v = e.get("ffmpeg"), e.get("video")
    if not ff:
        return False, "precisa da etapa ffmpeg"
    saida_dir = e.get("saida") or TMP
    os.makedirs(saida_dir, exist_ok=True)
    quadro = os.path.join(TMP, "quadro.png")
    rc, log = sh([ff, "-y", "-v", "error", "-ss", "2", "-i", v, "-frames:v", "1", "-vf",
                  "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", quadro]) if v else (1, "")
    if rc:   # sem vídeo: fundo neutro
        sh([ff, "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x3a3a44:s=1080x1920", "-frames:v", "1", quadro])
    # amostra: o bloco de 3 palavras mais "cheio" da fala da pessoa (ou uma frase de exemplo)
    bs = [b for b in blocos(e.get("palavras") or []) if len(b) == 3]
    ws = [w["w"] for w in max(bs, key=lambda b: sum(len(w["w"]) for w in b))] if bs else ["ESSA", "É", "SUA LEGENDA"]
    t = [{"w": w, "s": 1.0 + i * 0.3, "e": 1.25 + i * 0.3} for i, w in enumerate(ws)]
    cartoes = []
    rot = "Rot,Manrope ExtraBold,58,&H00FFFFFF,&H00FFFFFF,&H00101010,&HA0000000,0,0,0,0,100,100,0,0,3,18,0,8,40,40,90,1"
    for n, (chave, (fam, nome, esc, jeito)) in enumerate(FONTES.items(), 1):
        ass = os.path.join(TMP, f"fonte-{chave}.ass")
        est = estilo_da_sessao(e, fonte=chave, modo="blocos", animacao="nenhuma")
        Legenda(est).gerar(t).salvar(ass, [rot], [f"Dialogue: 2,0:00:00.00,0:00:05.00,Rot,,0,0,0,,{n} · {nome}"])
        png = os.path.join(TMP, f"fonte-{chave}.png")
        # quadro no instante da palavra do meio (a "da vez")
        rc, log = sh([ff, "-y", "-v", "error", "-loop", "1", "-i", quadro, "-frames:v", "1", "-vf",
                      f"setpts=PTS-STARTPTS+1.35/TB,eq=brightness=-0.04,subtitles={ass}:fontsdir={os.path.abspath(FONTES_DIR)},scale=360:640", png])
        if rc:
            return False, f"cartão {nome} falhou:\n{log[-600:]}"
        cartoes.append(png)
    k = 0
    while len(cartoes) % 4:   # grade de 4 colunas: a sobra vira o cartão de instrução
        k += 1
        vazio, ass = os.path.join(TMP, f"vazio{k}.png"), os.path.join(TMP, f"vazio{k}.ass")
        txt = "Responda com\\No número\\Nda fonte" if k == 1 else ""
        aviso = "Avi,Manrope ExtraBold,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,70,70,0,1"
        open(ass, "w", encoding="utf-8").write(CABECALHO.format(estilos="Style: " + aviso)
                                             + f"Dialogue: 0,0:00:00.00,0:00:05.00,Avi,,0,0,0,,{txt}\n")
        sh([ff, "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x16161a:s=1080x1920", "-frames:v", "1", "-vf",
            f"subtitles={ass}:fontsdir={os.path.abspath(FONTES_DIR)},scale=360:640", vazio])
        cartoes.append(vazio)
    linhas = len(cartoes) // 4
    ent = sum([["-i", c] for c in cartoes], [])
    lay = "|".join(f"{(i%4)*360}_{(i//4)*640}" for i in range(len(cartoes)))
    out = os.path.join(saida_dir, "sonda-fontes.png")
    rc, log = sh([ff, "-y", "-v", "error", *ent, "-filter_complex", f"xstack=inputs={len(cartoes)}:layout={lay}", "-frames:v", "1", out])
    if rc:
        return False, "cartela falhou:\n" + log[-600:]
    lista = "\n".join(f"{n} · {nome}: {jeito}" for n, (_, nome, _, jeito) in enumerate(FONTES.values(), 1))
    return True, f"cartela: {out}\n{lista}"


def referencia(e):
    """Prepara a referência da pessoa para o Claude olhar: imagem vai como está; vídeo vira uma folha com 8 quadros."""
    ff, ref = e.get("ffmpeg"), e.get("ref")
    if not (ff and ref and os.path.exists(ref)):
        return False, "precisa da etapa ffmpeg e de --ref <imagem ou vídeo>"
    saida_dir = e.get("saida") or TMP
    out = os.path.join(saida_dir, "sonda-referencia.png")
    if ref.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".heic")):
        rc, log = sh([ff, "-y", "-v", "error", "-i", ref, "-vf", "scale=-2:1280", "-frames:v", "1", out])
    else:
        rc, log = sh([ff, "-y", "-v", "error", "-i", ref, "-vf",
                      "fps=8/max(1\\,10),scale=270:480:force_original_aspect_ratio=decrease,pad=270:480:(ow-iw)/2:(oh-ih)/2,tile=4x2",
                      "-frames:v", "1", out])
    if rc:
        return False, "não consegui ler a referência:\n" + log[-600:]
    return True, (f"referência pronta para olhar: {out}\n"
                  "Agora olhe a imagem e preencha o estilo (referencias/estilo.md); depois rode: "
                  "python3 sonda.py fontes --estilo <arquivo.json>  e  python3 sonda.py demo --estilo <arquivo.json>")


def conferir(e):
    """Prova independente do corte: transcreve de novo o vídeo editado e compara, palavra por palavra, com o bruto."""
    import difflib, unicodedata
    import numpy as np
    from faster_whisper import WhisperModel
    saida_dir = e.get("saida") or TMP
    feitos = sorted((os.path.join(saida_dir, f) for f in os.listdir(saida_dir) if f.startswith("sonda-demo-")),
                    key=os.path.getmtime)
    if not (feitos and e.get("palavras")):
        return False, "precisa de uma demo renderizada e da transcrição (etapas whisper e demo)"
    alvo = feitos[-1]
    modelo = WhisperModel(e.get("modelo", "small"), device="cpu", compute_type="int8")
    norm = lambda t: [unicodedata.normalize("NFKD", w).encode("ascii", "ignore").decode().lower()
                      for w in re.findall(r"[\wÀ-ÿ]+", t)]

    def ouvir(arq, extra=()):   # o bruto e o editado passam pelo MESMO transcritor, do mesmo jeito
        raw = subprocess.run([e["ffmpeg"], "-v", "error", *extra, "-i", arq, "-vn", "-ac", "1", "-ar", "16000",
                              "-f", "f32le", "-"], capture_output=True, timeout=300).stdout
        segs, _ = modelo.transcribe(np.frombuffer(raw, np.float32), language="pt", vad_filter=False,
                                    condition_on_previous_text=False, temperature=0, word_timestamps=True)
        return [(n, w.start) for x in segs for w in x.words for n in norm(w.word)]
    antes = ouvir(e["video"], ["-t", str(LIMITE)])
    depois = ouvir(alvo)
    sm = difflib.SequenceMatcher(None, [w for w, _ in antes], [w for w, _ in depois], autojunk=False)
    bordas = [x for c0, c1 in (e.get("cortes") or {}).get("pausas", []) for x in (c0, c1)]
    perto, longe = [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op in ("delete", "replace"):
            trecho = antes[i1:i2]
            dist = min([abs(t - b) for _, t in trecho for b in bordas] + [99])
            (perto if dist < 0.6 else longe).append(" ".join(w for w, _ in trecho) + f" ({trecho[0][1]:.1f}s)")
    cobre = sum(b.size for b in sm.get_matching_blocks()) / max(1, len(antes))
    txt = f"{os.path.basename(alvo)}: {cobre:.1%} das palavras do bruto reconhecidas no editado"
    txt += f"\nperto de uma emenda (ouça estes): {perto or 'nenhuma'}"
    txt += f"\nlonge de emenda (variação do transcritor, não é corte): {longe[:10] or 'nenhuma'}"
    return not perto, txt


def relatorio(e):
    linhas = ["# Sonda do editor de vídeo no chat", "", "| Etapa | Resultado | Tempo | Detalhe |", "|---|---|---|---|"]
    for nome in ["ambiente", "ffmpeg", "whisper", "referencia", "fontes", "chromium", "demo", "conferir"]:
        r = e["etapas"].get(nome)
        if not r:
            linhas.append(f"| {nome} | não rodou | | |"); continue
        det = r["detalhe"].replace("\n", "<br>").replace("|", "/")[:700]
        linhas.append(f"| {nome} | {'✅' if r['ok'] else '❌'} | {r['segundos']} s | {det} |")
    md = "\n".join(linhas) + "\n"
    destino = os.path.join(e.get("saida") or TMP, "sonda-relatorio.md")
    open(destino, "w", encoding="utf-8").write(md)
    return True, md + f"\nsalvo em {destino}"


ETAPAS = {"ambiente": ambiente, "ffmpeg": ffmpeg, "whisper": whisper, "referencia": referencia, "fontes": fontes,
          "chromium": chromium, "demo": demo, "conferir": conferir, "relatorio": relatorio}

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] not in ETAPAS:
        sys.exit(__doc__)
    e = carregar()
    if "--video" in args:
        e["video"] = os.path.abspath(args[args.index("--video") + 1])
    if "--sem-cortes" in args:
        e["sem_cortes"] = True
    if "--com-cortes" in args:
        e.pop("sem_cortes", None)
    if "--pausa" in args:
        e["pausa"] = float(args[args.index("--pausa") + 1])
    if "--headline" in args:
        h = args[args.index("--headline") + 1].strip()
        e["headline"] = None if h.lower() in ("", "nao", "não", "sem") else h
    if "--headline-modo" in args:
        e["headline_modo"] = args[args.index("--headline-modo") + 1]
    if "--ref" in args:
        e["ref"] = os.path.abspath(args[args.index("--ref") + 1])
    if "--estilo" in args:
        est = json.load(open(args[args.index("--estilo") + 1], encoding="utf-8"))
        desconhecidos = set(est) - set(ESTILO_PADRAO)
        if desconhecidos:
            sys.exit(f"campos que não existem no estilo: {', '.join(sorted(desconhecidos))}")
        e["estilo"] = est
        e.pop("legenda", None)
    if "--legenda" in args:
        e["legenda"] = args[args.index("--legenda") + 1]
        if e["legenda"] not in (*MODOS, "todas"):
            sys.exit("--legenda: palavra, blocos, normal ou todas")
    if "--fonte" in args:
        f = args[args.index("--fonte") + 1].lower()
        f = list(FONTES)[int(f) - 1] if f.isdigit() and 0 < int(f) <= len(FONTES) else f
        if f not in FONTES:
            sys.exit("--fonte: " + ", ".join(FONTES) + " (ou o número da cartela)")
        e["estilo"] = {**(e.get("estilo") or {}), "fonte": f}
    if "--saida" in args:
        e["saida"] = os.path.abspath(args[args.index("--saida") + 1])
    salvar(e)
    registrar(args[0], ETAPAS[args[0]])
