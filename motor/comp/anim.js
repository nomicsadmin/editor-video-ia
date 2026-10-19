// Camada de ANIMAÇÃO POR TEMPO do compositor · versão aberta da do editor da Nomics (12/Out/2026), com GSAP.
// O render é quadro a quadro: cada cena monta UMA timeline GSAP pausada no preparar e, a cada quadro, faz
// tl.seek(t − t0). Nada roda no relógio da página. O GSAP anima objetos JS (letra, traço) e quem desenha é o canvas.
// Tipos de cena (valem sobre qualquer layout):
//   cinetica · tipografia cinética letra a letra (efeitos: letras, montar, digitar)
//   traco    · logo ou SVG se desenhando pelo traço e depois preenchendo (logos de motor/logos/ ou um .svg do projeto)
// GSAP em ./vendor (versão fixa no nome), carregado só se o projeto tiver uma dessas cenas.
//   import anim from './anim.js';  const AN = anim(api);  await AN.preparar(cena);  Object.assign(DESENHA, AN.DESENHA)
export default function anim(api) {
  const { x, W, H, C, clamp, corDe, avisos } = api;
  const TIPOS = new Set(['cinetica', 'traco']);
  let gsap = null;
  const custo = {}; // ms gastos por tipo (window.__animCusto)

  async function usaGsap() {
    if (gsap) return gsap;
    // UMD clássico: em import() de módulo ele quebra (escreve self.window); por <script> publica window.gsap
    await new Promise((ok, ruim) => { const s = document.createElement('script'); s.src = new URL('./vendor/gsap-3.15.0.min.js', import.meta.url).href; s.onload = ok; s.onerror = () => ruim(new Error('gsap não carregou')); document.head.appendChild(s); });
    gsap = window.gsap; gsap.ticker.lagSmoothing(0); gsap.config({ nullTargetWarn: false });
    return gsap;
  }
  // timeline pausada, fora do relógio: só anda com seek
  const linha = () => { const tl = gsap.timeline({ paused: true, defaults: { immediateRender: true } }); return tl; };
  const dorme = () => gsap.ticker.sleep();
  const seek = (c, t) => c._tl.seek(Math.max(0, t - c.t0), false);
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, '');
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let q = Math.imul(a ^ (a >>> 15), 1 | a); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; };
  const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };
  // saída comum: some subindo de leve nos últimos `saida_s` (0,35 s); "saida": "nenhuma" fica inteira até o t1
  function saida(c, tl, unidade) {
    c._sai = { p: 0 }; if (c.saida === 'nenhuma') return;
    const d = c.saida_s ?? 0.35; tl.fromTo(c._sai, { p: 0 }, { p: 1, duration: d, ease: 'power2.in' }, Math.max(0, c.t1 - c.t0 - d));
    c._saiY = unidade;
  }

  // ------------------------------------------------------------ cinetica
  function montaTexto(c) {
    const tam = c.tamanho || 150, tamD = tam * (c.escala_destaque ?? 1.12);
    const fN = `${c.peso || 400} ${tam}px "${c.fonte || 'Hedvig Letters Sans'}"`;
    const fD = `${c.destaque_italico === false ? '' : 'italic '}400 ${tamD}px "${c.fonte_destaque || 'Instrument Serif'}"`;
    const dset = new Set([].concat(c.destaque || []).flatMap(d => String(d).split(/\s+/)).map(norm).filter(Boolean));
    const linhas = (c.linhas || [c.texto || '']).map(l => String(l).split(/\s+/).filter(Boolean));
    const lh = tam * (c.entrelinha ?? 1.08), L = [], palavras = [], caixas = [];
    const X0 = (c.x ?? 0.5) * W, Y0 = (c.y ?? 0.45) * H, alinhar = c.alinhar || 'center';
    x.save(); x.letterSpacing = `${tam * (c.tracking ?? -0.02)}px`;
    linhas.forEach((ws, li) => {
      x.font = fN; const sp = x.measureText(' ').width * (c.espaco ?? 1);
      const itens = ws.map(w => { const d = dset.has(norm(w)); const txt = c.caixa === 'maiusculas' && !d ? w.toUpperCase() : w; x.font = d ? fD : fN; return { txt, d, f: d ? fD : fN, wd: x.measureText(txt).width }; });
      const tot = itens.reduce((s, q) => s + q.wd, 0) + sp * Math.max(0, itens.length - 1);
      let cx = alinhar === 'center' ? X0 - tot / 2 : alinhar === 'right' ? X0 - tot : X0; const by = Y0 + li * lh;
      caixas.push([cx, by, tot]);
      for (const q of itens) {
        x.font = q.f; const chars = [...q.txt]; let pre = '';
        const pal = { d: q.d, X: cx, Y: by, wd: q.wd, letras: [] };
        for (const ch of chars) { // posição pela largura do prefixo: mantém o kerning da fonte
          const lx = cx + x.measureText(pre).width; pre += ch; const lw = x.measureText(ch).width;
          const l = { ch, X: lx, Y: by, w: lw, f: q.f, d: q.d, tam: q.d ? tamD : tam, y: 0, dx: 0, r: 0, s: 1, o: 1 };
          L.push(l); pal.letras.push(l);
        }
        palavras.push(pal); cx += q.wd + sp;
      }
    });
    x.restore();
    return { L, palavras, caixas, tam, lh };
  }
  function efeito(tl, c, letras, nome, pos, tam) {
    if (!letras.length) return pos;
    const passo = c.passo ?? (nome === 'digitar' ? 0.06 : nome === 'montar' ? 0.045 : 0.035);
    const dur = c.dur_letra ?? (nome === 'montar' ? 0.9 : 0.7);
    if (nome === 'digitar') {
      tl.fromTo(letras, { o: 0 }, { o: 1, duration: 0.001, ease: 'none', stagger: passo }, pos);
    } else if (nome === 'montar') { // letras espalhadas (semente = o próprio texto) se juntam na palavra
      const r = rng(hash(c.texto || (c.linhas || []).join(' ')) + letras.length);
      const sp = letras.map(() => ({ dx: (r() - 0.5) * tam * 2.2, y: (r() - 0.5) * tam * 2.4, r: (r() - 0.5) * 70 }));
      tl.fromTo(letras, { dx: i => sp[i].dx, y: i => sp[i].y, r: i => sp[i].r, s: 0.35, o: 0 },
        { dx: 0, y: 0, r: 0, s: 1, o: 1, duration: dur, ease: c.ease || 'expo.out', stagger: passo }, pos);
    } else { // letras: cada letra sobe de dentro da linha (máscara)
      tl.fromTo(letras, { y: tam * 0.95, o: 0 }, { y: 0, o: 1, duration: dur, ease: c.ease || 'expo.out', stagger: passo }, pos);
    }
    return pos + passo * (letras.length - 1) + dur * (nome === 'digitar' ? 0 : 0.55);
  }
  async function prepCinetica(c) {
    const g = c._g = montaTexto(c), tl = c._tl = linha();
    const nome = c.efeito || 'letras', nomeD = c.efeito_destaque || nome;
    const normais = g.L.filter(l => !l.d), dest = g.L.filter(l => l.d);
    let fim = efeito(tl, c, normais, nome, c.atraso_texto ?? 0.05, g.tam);
    if (dest.length) fim = efeito(tl, c, dest, nomeD, c.atraso_destaque ?? (normais.length ? fim - 0.15 : 0.05), g.tam);
    c._sub = { p: 0 };
    if (c.sublinhado && dest.length) tl.fromTo(c._sub, { p: 0 }, { p: 1, duration: 0.6, ease: 'power3.inOut' }, fim);
    saida(c, tl, g.tam * 0.25); dorme();
  }
  function desCinetica(c, t) {
    if (!c._tl) return;
    seek(c, t); const g = c._g, nome = c.efeito || 'letras', nomeD = c.efeito_destaque || nome;
    const cor = corDe(c.cor || 'branco'), corD = corDe(c.cor_destaque || 'destaque');
    const a = 1 - c._sai.p, dy = -c._sai.p * (c._saiY || 0);
    x.save(); x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.letterSpacing = '0px';
    for (const pal of g.palavras) {
      const mascara = (pal.d ? nomeD : nome) === 'letras';
      x.save();
      if (mascara) { x.beginPath(); x.rect(pal.X - g.tam * 0.3, pal.Y - g.tam * 1.25 + dy, pal.wd + g.tam * 0.6, g.tam * 1.6); x.clip(); }
      x.fillStyle = pal.d ? corD : cor;
      for (const l of pal.letras) {
        if (l.o <= 0.001) continue;
        x.save(); x.globalAlpha = a * clamp(l.o); x.font = l.f;
        x.translate(l.X + l.w / 2 + l.dx, l.Y - l.tam * 0.33 + l.y + dy);
        if (l.r) x.rotate(l.r * Math.PI / 180); if (l.s !== 1) x.scale(l.s, l.s);
        x.fillText(l.ch, -l.w / 2, l.tam * 0.33); x.restore();
      }
      if (pal.d && c._sub.p > 0) { // sublinhado da palavra de destaque, desenhando da esquerda
        x.globalAlpha = a; x.fillRect(pal.X, pal.Y + g.tam * 0.16 + dy, pal.wd * c._sub.p, Math.max(3, g.tam * 0.035));
      }
      x.restore();
    }
    if (nome === 'digitar' || nomeD === 'digitar') { // cursor depois da última letra visível, piscando no tempo do vídeo
      const vis = g.L.filter(l => l.o > 0.5), u = vis[vis.length - 1] || g.L[0];
      const pisca = vis.length === g.L.length ? Math.floor((t - c.t0) * 2.2) % 2 === 0 : true;
      if (u && pisca) { x.globalAlpha = a; x.fillStyle = corD; const ux = vis.length ? u.X + u.w + g.tam * 0.06 : u.X; x.fillRect(ux, u.Y - g.tam * 0.78 + dy, Math.max(4, g.tam * 0.055), g.tam * 0.9); }
    }
    x.restore();
  }

  // ------------------------------------------------------------ traco (SVG por traço)
  // Separa o "d" em subcaminhos com início ABSOLUTO (o "m" relativo depende do ponto atual), para medir e
  // desenhar cada contorno inteiro: o tracejado do canvas recomeça a cada subcaminho.
  function subcaminhos(d) {
    const s = d.trim(); let i = 0; const out = []; let cx = 0, cy = 0, sx = 0, sy = 0, ini = 0, cab = null;
    const ws = () => { while (i < s.length && /[\s,]/.test(s[i])) i++; };
    const num = () => { ws(); const m = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/.exec(s.slice(i)); if (!m) return null; i += m[0].length; return +m[0]; };
    const flag = () => { ws(); const f = s[i]; i++; return +f; };
    const temNum = () => { ws(); return i < s.length && /[-+.\d]/.test(s[i]); };
    const fecha = fim => { if (cab != null) out.push(cab + s.slice(ini, fim)); };
    while (i < s.length) {
      ws(); if (i >= s.length) break; const cmd = s[i]; const k0 = i; i++;
      const rel = cmd === cmd.toLowerCase(), U = cmd.toUpperCase();
      if (U === 'M') {
        fecha(k0); let px = num(), py = num(); if (rel) { px += cx; py += cy; } // depois de um z, cx/cy já é o início do subcaminho anterior
        cx = sx = px; cy = sy = py; cab = `M${+px.toFixed(4)} ${+py.toFixed(4)}`; let resto = '';
        while (temNum()) { let a = num(), b = num(); resto += ` ${a} ${b}`; if (rel) { cx += a; cy += b; } else { cx = a; cy = b; } }
        if (resto) cab += (rel ? ' l' : ' L') + resto;
        ini = i; continue;
      }
      if (U === 'Z') { cx = sx; cy = sy; continue; }
      do {
        if (U === 'H') { const v = num(); cx = rel ? cx + v : v; }
        else if (U === 'V') { const v = num(); cy = rel ? cy + v : v; }
        else if (U === 'L' || U === 'T') { const a = num(), b = num(); cx = rel ? cx + a : a; cy = rel ? cy + b : b; }
        else if (U === 'S' || U === 'Q') { num(); num(); const a = num(), b = num(); cx = rel ? cx + a : a; cy = rel ? cy + b : b; }
        else if (U === 'C') { num(); num(); num(); num(); const a = num(), b = num(); cx = rel ? cx + a : a; cy = rel ? cy + b : b; }
        else if (U === 'A') { num(); num(); num(); flag(); flag(); const a = num(), b = num(); cx = rel ? cx + a : a; cy = rel ? cy + b : b; }
        else { avisos.push(`traco: comando de caminho desconhecido "${cmd}"`); return [d]; }
      } while (temNum());
    }
    fecha(s.length);
    return out.length ? out : [d];
  }
  async function prepTraco(c) {
    // os logos de motor/logos/ já são um <path> só; um .svg do projeto com <circle>/<rect> avisa no QA
    const url = c.svg ? '/p/' + c.svg : `/logos/${c.logo}.svg`;
    const r = await fetch(url);
    if (!r.ok) { avisos.push('traco: svg não achado ' + url); c._ok = false; return; }
    const caixa = document.createElement('div'); caixa.style.cssText = `position:absolute;left:-99999px;top:0;color:${corDe(c.preenche || c.cor || 'destaque')}`;
    caixa.innerHTML = await r.text(); document.body.appendChild(caixa);
    const svg = caixa.querySelector('svg'); const vb = (svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width') || 24} ${svg.getAttribute('height') || 24}`).split(/[\s,]+/).map(Number);
    svg.setAttribute('width', vb[2]); svg.setAttribute('height', vb[3]);
    const P = [];
    for (const el of svg.querySelectorAll('path')) {
      if (el.closest('defs,clipPath,mask')) continue;
      const cs = getComputedStyle(el), m = el.getCTM(); const d = el.getAttribute('d'); if (!d) continue;
      let fill = cs.fill; if (fill.startsWith('url')) { avisos.push(`traco: ${c.logo || c.svg} tem gradiente; preenchimento vira a cor da cena`); fill = corDe(c.preenche || c.cor || 'destaque'); }
      const subs = subcaminhos(d).map(sd => { const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path'); tmp.setAttribute('d', sd); el.parentNode.appendChild(tmp); const len = tmp.getTotalLength(); tmp.remove(); return { p2: new Path2D(sd), len, p: 0 }; });
      P.push({ inteiro: new Path2D(d), subs, m: new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]), fill: fill === 'none' ? null : fill, regra: cs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero', esc: Math.hypot(m.a, m.b) });
    }
    for (const el of svg.querySelectorAll('circle,ellipse,rect,line,polyline,polygon')) if (!el.closest('defs')) { avisos.push(`traco: ${c.logo || c.svg} tem <${el.tagName}> fora de <path> e ele não entra no traço (converta a forma em <path> num editor de SVG)`); break; }
    caixa.remove();
    c._vb = vb; c._P = P; c._ok = P.length > 0;
    if (!c._ok) { avisos.push('traco: nenhum <path> em ' + url); return; }
    const tl = c._tl = linha(), subs = P.flatMap(p => p.subs);
    const dur = c.dur_traco ?? 1.3, passo = c.passo ?? 0.06;
    tl.fromTo(subs, { p: 0 }, { p: 1, duration: dur, ease: c.ease || 'power2.inOut', stagger: passo }, c.atraso_traco ?? 0.05);
    c._fill = { p: 0 };
    const fimTraco = (c.atraso_traco ?? 0.05) + dur + passo * (subs.length - 1);
    if (c.preenche !== false) tl.fromTo(c._fill, { p: 0 }, { p: 1, duration: c.dur_preenche ?? 0.55, ease: 'power2.out' }, c.preenche_em ?? Math.max(0, fimTraco - 0.2));
    saida(c, tl, 0); dorme();
  }
  function desTraco(c, t) {
    if (!c._ok) return; seek(c, t);
    const [vx, vy, vw, vh] = c._vb, larg = c.largura || 420, s = larg / vw, alt = vh * s;
    const ox = (c.x ?? 0.5) * W - larg / 2, oy = (c.y ?? 0.4) * H - alt / 2;
    const T0 = x.getTransform(), base = T0.translate(ox, oy).scale(s).translate(-vx, -vy);
    const a = 1 - c._sai.p, corT = corDe(c.cor || 'destaque'), fp = c._fill.p, esp = c.espessura || 3;
    const traco = c.traco_fica ? 1 : 1 - fp * 0.85;
    x.save();
    for (const p of c._P) {
      x.setTransform(base.multiply(p.m));
      if (fp > 0 && c.preenche !== false) { x.globalAlpha = a * fp; x.fillStyle = c.preenche ? corDe(c.preenche) : (p.fill || corT); x.fill(p.inteiro, p.regra); }
      x.globalAlpha = a * traco; x.strokeStyle = corT; x.lineWidth = esp / (s * p.esc); x.lineCap = 'round'; x.lineJoin = 'round';
      for (const q of p.subs) { if (q.p <= 0) continue; x.setLineDash([q.len * q.p, q.len + 1]); x.stroke(q.p2); }
    }
    x.setLineDash([]); x.restore();
  }

  // ------------------------------------------------------------ registro
  const medir = (k, f) => (c, t, s) => { const a = performance.now(); f(c, t, s); const m = custo[k] || (custo[k] = { ms: 0, n: 0 }); m.ms += performance.now() - a; m.n++; };
  window.__animCusto = () => Object.fromEntries(Object.entries(custo).map(([k, v]) => [k, { quadros: v.n, ms_por_desenho: +(v.ms / Math.max(1, v.n)).toFixed(3) }]));
  return {
    // 13/Out: GSAP para cena sob medida no extra.js (guia: skills gsap-core/gsap-timeline). `await api.gsap()` carrega a
    // versão vendorizada com o ticker dormindo; `api.linha()` = timeline pausada; no desenho, `tl.seek(t − c.t0, false)`.
    async gsap() { const g = await usaGsap(); dorme(); return g; },
    linha() { if (!gsap) throw new Error('chame await api.gsap() antes de api.linha()'); return linha(); },
    async preparar(c) {
      if (!TIPOS.has(c.tipo)) return;
      try { // cena de animação quebrada vira aviso no QA e some do vídeo; nunca trava o render
        await usaGsap();
        if (c.tipo === 'cinetica') await prepCinetica(c);
        else await prepTraco(c);
      } catch (e) { avisos.push(`${c.tipo} falhou no preparo: ${e.message}`); c._ok = false; c._tl = null; }
    },
    DESENHA: { cinetica: medir('cinetica', desCinetica), traco: medir('traco', desTraco) },
  };
}
