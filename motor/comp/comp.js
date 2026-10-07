// Compositor · canvas 2D, 30 fps, 1080×1920 por padrão (horizontal: "formato" no projeto.json).
// Entradas (servidas pelo render.mjs):
//   /b/timeline.json   base.py: pedaços (segs) e palavras já no tempo do vídeo final
//   /b/f/NNNNN.jpg     quadros do vídeo
//   /p/projeto.json    bloco `edicao`: receita, legenda, cor, zoom
//   /p/cenas.json      o que entra na tela, ancorado na fala (card, logo, imagem, frase, número…)
//   /p/extra.js        opcional: cena sob medida (export default (api) => ({ fundo, cena, frente }))
//   /marca/marca.json  opcional: cores, fontes e logo da pessoa (pasta minha-marca/)
//   /comp/legendas.json estilos de legenda
// Ordem de desenho: fundo do layout → vídeo → cenas → frente (extra) → LEGENDA POR ÚLTIMO.
const cv = document.getElementById('c'); const x = cv.getContext('2d');
const falha = m => { window.__erro = m; throw new Error(m); };
const getJ = async (u, opcional = false) => { const r = await fetch(u); if (!r.ok) { if (opcional) return null; falha('faltou ' + u); } return r.json(); };

const TL = await getJ('/b/timeline.json');
const W = TL.w || 1080, H = TL.h || 1920;
cv.width = W; cv.height = H;
const PJ = await getJ('/p/projeto.json');
const CN = (await getJ('/p/cenas.json', true)) || { cenas: [] };
const LEG = await getJ('/comp/legendas.json');
const MARCA = (await getJ('/marca/marca.json', true)) || {};
const ED = Object.assign({ legenda: 'palavra', cor: 'destaque', escurecer: 0.22, zoom: [1.0, 1.12], foco: [0.5, 0.40] }, PJ.edicao || {});
const FPS = TL.fps || 30;
// rosto medido no preparar.py: foco do zoom e altura segura da legenda
const ROSTO = {}; for (const b of PJ.brutos || []) if (b.rosto) ROSTO[b.id] = b.rosto;
const focoDe = s => s.foco || (PJ.edicao && PJ.edicao.foco) || (ROSTO[s.bruto] ? [ROSTO[s.bruto].cx, ROSTO[s.bruto].cy - 0.02] : ED.foco);

// ---------------------------------------------------------------- fontes
// padrão neutro (livres, OFL): Fraunces nos títulos, Manrope no texto e na legenda, JetBrains Mono nos rótulos.
// A marca da pessoa troca qualquer uma: "fontes": { "titulo": ["Nome", "arquivo.woff2", "700"] } (arquivo em minha-marca/)
const F = { titulo: 'Fraunces', texto: 'Manrope', rotulo: 'JetBrains Mono' };
const PESO = { titulo: '600', texto: '500', rotulo: '500' };
for (const [fam, arq, peso, estilo] of [
  ['Fraunces', 'fraunces-latin-600-normal.woff2', '600'], ['Fraunces', 'fraunces-latin-600-italic.woff2', '600', 'italic'],
  ['Manrope', 'manrope-latin-500-normal.woff2', '500'], ['Manrope', 'manrope-latin-700-normal.woff2', '700'], ['Manrope', 'manrope-latin-800-normal.woff2', '800'],
  ['JetBrains Mono', 'jetbrains-mono-latin-500-normal.woff2', '500']]) {
  const f = new FontFace(fam, `url(/fonts/${arq})`, { weight: peso, style: estilo || 'normal' }); await f.load(); document.fonts.add(f);
}
const FONTES_MARCA = Object.assign({}, MARCA.fontes || {}, ED.fontes || {});
for (const papel of ['titulo', 'texto', 'rotulo', 'legenda']) {
  const d = FONTES_MARCA[papel]; if (!d) continue; const [fam, arq, peso] = d;
  if (arq) { const f = new FontFace(fam, `url(${ED.fontes && ED.fontes[papel] ? '/p/' : '/marca/'}${arq})`, { weight: peso || '400' }); try { await f.load(); document.fonts.add(f); } catch (e) { falha(`fonte da marca não carregou: ${arq}`); } }
  if (papel !== 'legenda') { F[papel] = fam; PESO[papel] = peso || PESO[papel]; }
}

// ---------------------------------------------------------------- cores (neutras; a marca troca)
const C = {
  claro: '#F5F3EF', escuro: '#111214', branco: '#FFFFFF', tinta: '#16171A', suave: '#6E6F76', linha: 'rgba(17,18,20,0.08)',
  destaque: '#FF5A1F', cor2: '#2F6BFF', cor3: '#1BA97A', bom: '#12823B', ruim: '#D93025', creme: '#FFF6D6',
};
Object.assign(C, MARCA.cores || {}, ED.paleta || {});
const corDe = n => C[n] || n || C.destaque;
const rgba = (hex, a) => { const h = String(hex).replace('#', ''); if (h.length !== 6) return hex; const n = parseInt(h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

// ---------------------------------------------------------------- utilidades
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOut = v => 1 - Math.pow(1 - v, 3);
const eInOut = v => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const eBack = v => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2); };
const rr = (X, Y, w, h, r) => { x.beginPath(); x.roundRect(X, Y, w, h, r); };
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.(?!\d)/g, '').replace(/[^a-z0-9%$.*]+/g, '');
const words = TL.words;
const nw = words.map(w => norm(w.w));

// âncora na fala: número (segundos do vídeo final) ou "palavra#n" / "duas palavras#n" (n-ésima vez que é dita; 1 = primeira)
const avisos = [];
function ancora(q, fim = false) {
  if (q == null) return null;
  if (typeof q === 'number') return q;
  const [txt, n] = String(q).split('#'); const alvo = txt.split(/\s+/).map(norm).filter(Boolean); let k = +(n || 1);
  for (let i = 0; i + alvo.length <= nw.length; i++) {
    if (alvo.every((a, j) => a.endsWith('*') ? nw[i + j].startsWith(a.slice(0, -1)) : nw[i + j] === a)) {
      if (--k === 0) return fim ? words[i + alvo.length - 1].t1 : words[i].t0;
    } else if (alvo.length > 1 && !alvo.some(a => a.endsWith('*'))) { // palavras que a transcrição juntou ("Claude Code")
      const alvoJ = alvo.join(''); let acc = '', j = i;
      while (j < nw.length && acc.length < alvoJ.length && alvoJ.startsWith(acc + nw[j])) { acc += nw[j]; j++; }
      if (acc === alvoJ && j > i) { if (--k === 0) return fim ? words[j - 1].t1 : words[i].t0; }
    }
  }
  avisos.push(`âncora não achada na fala: "${q}"`); return null;
}

// ---------------------------------------------------------------- imagens e logos
const IMG = new Map();
async function img(src) {
  if (IMG.has(src)) return IMG.get(src);
  const r = await fetch(src); if (!r.ok) { avisos.push('imagem não achada: ' + src); IMG.set(src, null); return null; }
  const b = await createImageBitmap(await r.blob()); IMG.set(src, b); return b;
}
async function logo(nome, cor = '#111111') {
  const k = `logo:${nome}:${cor}`; if (IMG.has(k)) return IMG.get(k);
  const r = await fetch(`/logos/${nome}.svg`); if (!r.ok) { avisos.push('logo não achado: ' + nome); IMG.set(k, null); return null; }
  let svg = await r.text();
  svg = svg.replace(/currentColor/g, cor).replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1').replace('<svg', '<svg width="512" height="512"');
  const im = new Image(); im.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); await im.decode();
  const b = await createImageBitmap(im); IMG.set(k, b); return b;
}

// ---------------------------------------------------------------- cenas: resolve tempos e pré-carrega
const CENAS = [];
for (const c of CN.cenas || []) {
  const t0 = ancora(c.quando); if (t0 == null) continue;
  // `ate` = sai quando essa palavra COMEÇA; `ate_fim` = quando ela termina; sem os dois, fica `dur` s (padrão 2,6)
  let t1 = c.ate != null ? ancora(c.ate) : c.ate_fim != null ? ancora(c.ate_fim, true) : null;
  if (t1 == null) t1 = t0 + (c.dur || 2.6);
  const cc = Object.assign({}, c, { t0: t0 + (c.atraso || 0), t1 });
  if (c.src) cc.bmp = await img(c.src.startsWith('marca:') ? '/marca/' + c.src.slice(6) : '/p/' + c.src);
  if (c.logo) cc.logoBmp = await logo(c.logo, c.logo_cor || '#111111');
  if (c.logos) cc.logosBmp = await Promise.all(c.logos.map(n => logo(n, '#111111')));
  if (c.tipo === 'comparativo') for (const lado of ['a', 'b']) if (c[lado] && c[lado].logo) c[lado].bmp = await logo(c[lado].logo, '#111111');
  if (c.avatar) cc.avBmp = await img('/p/' + c.avatar);
  if (c.fica_ate != null) cc.t2 = ancora(c.fica_ate);
  CENAS.push(cc);
}
// layouts ancorados na fala: [{ "quando": "Claude#1", "layout": "split" }, ...] vencem o layout do trecho do edl
const LAYS = (CN.layouts || []).map(l => ({ t0: ancora(l.quando), layout: l.layout })).filter(l => l.t0 != null).sort((a, b) => a.t0 - b.t0);
const layoutEm = (t, s) => { let r = null; for (const l of LAYS) { if (l.t0 <= t + 1e-6) r = l; else break; } return r ? r.layout : (s.layout || 'cheio'); };
const enfase = new Map(); // palavra de ênfase na legenda (maior e em outra cor)
for (const e of CN.enfase || []) { const t = ancora(e.quando || e); if (t != null) enfase.set(t, e.escala || 1.4); }

// ---------------------------------------------------------------- fundos (pré-renderizados uma vez)
function fundo(escuro) {
  const c = new OffscreenCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = escuro ? C.escuro : C.claro; g.fillRect(0, 0, W, H);
  // pontilhado leve: o fundo não fica chapado
  g.fillStyle = escuro ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)';
  for (let yy = 6; yy < H; yy += 14) for (let xx = (yy / 14) % 2 ? 6 : 13, n = 0; xx < W; xx += 14, n++) g.fillRect(xx, yy, 1.4, 1.4);
  return c;
}
const FUNDO = { claro: fundo(false), escuro: fundo(true) };

// ---------------------------------------------------------------- quadros do vídeo
let ultBmp = null, ultIdx = -1, VID = null;
async function quadro(idx) {
  if (idx === ultIdx) return ultBmp;
  const r = await fetch(`/b/f/${String(idx).padStart(5, '0')}.jpg`); const b = await createImageBitmap(await r.blob());
  if (ultBmp) ultBmp.close(); ultBmp = b; ultIdx = idx; return b;
}
const SEGS = TL.segs;
SEGS.forEach((s, i) => { s.n_ = i; });
const TRECHO = {}; for (const s of SEGS) { const r = TRECHO[s.i] || (TRECHO[s.i] = { o0: s.o0, o1: s.o1 }); r.o0 = Math.min(r.o0, s.o0); r.o1 = Math.max(r.o1, s.o1); }
function segEm(t) { let lo = 0, hi = SEGS.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SEGS[m].o0 <= t) lo = m; else hi = m - 1; } return SEGS[lo]; }

// zoom: alterna entre dois enquadramentos a cada frase (o corte vira "câmera nova"), aproxima devagar dentro da frase
function zoomDe(s, t) {
  const tr = TRECHO[s.i] || s; let lt = t - tr.o0; const dur = Math.max(tr.o1 - tr.o0, 0.5); const ltPedaco = t - s.o0;
  const ul = [...LAYS].reverse().find(l => l.t0 <= t && l.t0 > s.o0); if (ul) lt = t - ul.t0;
  let z;
  if (typeof s.zoom === 'number') z = s.zoom + 0.02 * (lt / dur);
  else if (s.zoom === 'fixo') z = 1;
  else z = (s.i % 2 ? ED.zoom[1] : ED.zoom[0]) + 0.025 * (lt / dur);
  const ant = SEGS[s.n_ - 1];
  if (ant && s.zoom !== 'fixo') { const novo = ant.i !== s.i; z *= 1 + (novo ? 0.03 : 0.012) * (1 - eOut(seg(ltPedaco, 0, novo ? 0.2 : 0.1))); }
  return z;
}
function desenhaVideo(bmp, s, t, alvo) {
  const [fx, fy] = focoDe(s); const z = zoomDe(s, t);
  const { X, Y, w, h } = alvo;
  const escala = Math.max(w / W, h / H) * z * (h < H * 0.75 && w >= W ? (ED.zoom_split || 1.08) : 1);
  const sw = w / escala, sh = h / escala;
  let sx = fx * W - sw / 2, sy = fy * H - sh / 2;
  sx = clamp(sx, 0, W - sw); sy = clamp(sy, 0, H - sh);
  x.drawImage(bmp, sx, sy, sw, sh, X, Y, w, h);
  VID = { sx, sy, k: escala, X, Y, w, h };
}

// ---------------------------------------------------------------- texto
function linhas(txt, fonte, maxW) {
  x.font = fonte; const ws = txt.split(/\s+/); const out = [[]]; let lw = 0;
  for (const w of ws) { const ww = x.measureText(w).width; const sp = x.measureText(' ').width; if (lw && lw + sp + ww > maxW) { out.push([]); lw = 0; } out[out.length - 1].push(w); lw += (lw ? sp : 0) + ww; }
  return out.map(l => l.join(' '));
}
function rotulo(txt, X, Y, cor = C.suave, tam = 24) {
  x.save(); x.font = `${PESO.rotulo} ${tam}px "${F.rotulo}"`; x.fillStyle = cor; x.textBaseline = 'alphabetic'; x.letterSpacing = `${tam * 0.12}px`;
  x.fillText(txt.toUpperCase(), X, Y); x.restore();
}
// título com palavra(s) em destaque; cada palavra entra no seu tempo da fala (ts) ou em cascata
function titulo(texto, destaque, X, Y, { tam = 88, cor = C.tinta, cdest = C.destaque, maxW = 900, alinhar = 'left', ts = null, t = 0, t0 = 0, fam = F.titulo, peso = PESO.titulo } = {}) {
  const fonte = `${peso} ${tam}px "${fam}"`;
  const ls = linhas(texto, fonte, maxW); x.save(); x.font = fonte; x.textBaseline = 'alphabetic'; x.letterSpacing = `${-tam * 0.02}px`;
  const dset = new Set((destaque || '').split(/\s+/).map(norm).filter(Boolean)); let k = 0;
  ls.forEach((ln, li) => {
    const tot = x.measureText(ln).width; let cx = alinhar === 'center' ? X - tot / 2 : X; const cy = Y + li * tam * 1.06;
    for (const w of ln.split(' ')) {
      const quando = ts ? ts[k] : t0 + k * 0.09; const p = eOut(seg(t, quando, quando + 0.32)); k++;
      const ww = x.measureText(w + ' ').width;
      if (p > 0) { x.globalAlpha *= p; x.fillStyle = dset.has(norm(w)) ? cdest : cor; x.fillText(w, cx, cy + (1 - p) * 24); x.globalAlpha /= p; }
      cx += ww;
    }
  });
  x.restore(); return ls.length * tam * 1.06;
}
function sombraCard() { x.shadowColor = 'rgba(17,18,20,0.22)'; x.shadowBlur = 40; x.shadowOffsetY = 18; }
function semSombra() { x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0; }

// ---------------------------------------------------------------- cenas
function vis(c, t) { const ent = eOut(seg(t, c.t0, c.t0 + 0.4)); const sai = 1 - seg(t, c.t1 - 0.25, c.t1); return { a: ent * sai, ent, sai }; }
const tsDaFala = (c, n) => { const ws = words.filter(w => w.t0 >= c.t0 - 0.05 && w.t0 < c.t1); return ws.length >= n ? ws.slice(0, n).map(w => w.t0) : null; };

// pedaço de fita segurando a imagem no topo (receita "conversa crua")
function fita(cx, cy, giro) {
  x.save(); x.translate(cx, cy); x.rotate(giro * Math.PI / 180);
  x.fillStyle = 'rgba(236,226,200,0.86)'; x.shadowColor = 'rgba(0,0,0,0.12)'; x.shadowBlur = 6; x.shadowOffsetY = 2;
  x.beginPath(); x.moveTo(-95, -26); for (let k = -95; k <= 95; k += 10) x.lineTo(k, -26 + (k / 10 % 2 ? 3 : 0)); x.lineTo(95, 26); for (let k = 95; k >= -95; k -= 10) x.lineTo(k, 26 - (k / 10 % 2 ? 3 : 0)); x.closePath(); x.fill();
  x.restore();
}
const DESENHA = {
  // cabeçalho sem caixa (topo da tela dividida ou do fundo claro/escuro): rótulo + título com palavra em destaque
  titulo(c, t) {
    const { a, ent } = vis(c, t); if (a <= 0) return; const escuro = c.escuro ?? false;
    x.save(); x.globalAlpha = a; const X = W * 0.08, Y = H * (c.y ?? 0.1) + (1 - ent) * 30;
    if (c.rotulo) rotulo(c.rotulo, X, Y, escuro ? 'rgba(255,255,255,0.6)' : C.suave, 26);
    titulo(c.texto || '', c.destaque, X, Y + (c.rotulo ? 40 : 0) + (c.tamanho || 84) * 0.9, { tam: c.tamanho || 84, maxW: W * 0.84, t, t0: c.t0 + 0.1, cor: escuro ? C.branco : C.tinta, cdest: corDe(c.cor || ED.cor) });
    x.restore();
  },
  card(c, t) {
    const { a, ent } = vis(c, t); if (a <= 0) return;
    const cw = W * (c.largura || 0.84), X = (W - cw) / 2, Y = H * (c.y ?? 0.13) + (1 - ent) * 40, pad = 52, tam = c.tamanho || 66;
    const maxW = cw - pad * 2 - 12 - (c.logoBmp ? 120 : 0);
    const ls = linhas(c.titulo || '', `${PESO.titulo} ${tam}px "${F.titulo}"`, maxW);
    const ch = pad * 2 + (c.rotulo ? 46 : 0) + ls.length * tam * 1.06 + (c.sub ? 56 : 0);
    x.save(); x.globalAlpha = a;
    sombraCard(); rr(X, Y, cw, ch, 30); x.fillStyle = C.branco; x.fill(); semSombra();
    x.strokeStyle = C.linha; x.lineWidth = 2; x.stroke();
    x.save(); rr(X, Y, cw, ch, 30); x.clip(); x.fillStyle = corDe(c.cor || ED.cor); x.fillRect(X, Y, 12, ch); x.restore();
    let cy = Y + pad;
    if (c.rotulo) { rotulo(c.rotulo, X + pad + 12, cy + 22); cy += 46; }
    titulo(c.titulo || '', c.destaque, X + pad + 12, cy + tam * 0.82, { tam, maxW, t, t0: c.t0 + 0.12, cdest: corDe(c.cor || ED.cor) });
    if (c.sub) { x.font = `${PESO.texto} 34px "${F.texto}"`; x.fillStyle = C.suave; x.fillText(c.sub, X + pad + 12, Y + ch - pad + 4); }
    if (c.logoBmp) x.drawImage(c.logoBmp, X + cw - pad - 96, Y + pad - 6, 96, 96);
    x.restore();
  },
  logo(c, t) {
    const { a } = vis(c, t); if (a <= 0 || !c.logoBmp) return;
    const p = eBack(seg(t, c.t0, c.t0 + 0.45)); const s = (c.tamanho || 240) * p; const cx = W * (c.x ?? 0.5), cy = H * (c.y ?? 0.26);
    x.save(); x.globalAlpha = a; sombraCard(); rr(cx - s / 2, cy - s / 2, s, s, s * 0.22); x.fillStyle = C.branco; x.fill(); semSombra();
    x.drawImage(c.logoBmp, cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.6); x.restore();
  },
  logos(c, t) {
    if (!c.logosBmp) return; const n = c.logosBmp.length; const s = c.tamanho || 170, gap = 36; const tot = n * s + (n - 1) * gap;
    c.logosBmp.forEach((b, i) => {
      if (!b) return; const ti = c.t0 + i * 0.12; const p = eBack(seg(t, ti, ti + 0.4)); const a = seg(t, ti, ti + 0.2) * (1 - seg(t, c.t1 - 0.25, c.t1)); if (a <= 0) return;
      const cx = (W - tot) / 2 + i * (s + gap) + s / 2, cy = H * (c.y ?? 0.26); const ss = s * p;
      x.save(); x.globalAlpha = a; sombraCard(); rr(cx - ss / 2, cy - ss / 2, ss, ss, ss * 0.22); x.fillStyle = C.branco; x.fill(); semSombra();
      x.drawImage(b, cx - ss * 0.3, cy - ss * 0.3, ss * 0.6, ss * 0.6); x.restore();
    });
  },
  imagem(c, t) {
    const { a, ent } = vis(c, t); if (a <= 0 || !c.bmp) return; const b = c.bmp;
    x.save(); x.globalAlpha = a;
    if (c.modo === 'solto') { // PNG recortado (pessoa, produto): sem moldura, sombra no próprio contorno
      const lw = W * (c.largura || 0.42); const lh = lw * b.height / b.width; const p = eBack(seg(t, c.t0, c.t0 + 0.45));
      const cx = W * (c.x ?? 0.5), cy = H * (c.y ?? 0.32) + lh / 2;
      x.shadowColor = 'rgba(0,0,0,0.28)'; x.shadowBlur = 36; x.shadowOffsetY = 16;
      x.translate(cx, cy); x.scale(p, p); x.drawImage(b, -lw / 2, -lh / 2, lw, lh); semSombra();
    } else if (c.modo === 'cheia') { // foto ocupando a tela, aproximando devagar
      const z = 1 + 0.08 * seg(t, c.t0, c.t1); const e = Math.max(W / b.width, H / b.height) * z;
      x.drawImage(b, (W - b.width * e) / 2, (H - b.height * e) / 2, b.width * e, b.height * e);
    } else {
      const cw = W * (c.largura || 0.88); const chh = Math.min(cw * b.height / b.width, H * (c.altura_max || 0.42)); const cwr = chh * b.width / b.height;
      let X = W * (c.x ?? 0.5) - cwr / 2, Y = H * (c.y ?? 0.12) + (1 - ent) * 50; const m = c.moldura ? 18 : 0;
      if (c.entrada === 'direita' || c.entrada === 'esquerda') { const d = c.entrada === 'direita' ? 1 : -1; X += d * (1 - eOut(seg(t, c.t0, c.t0 + 0.42))) * W; Y = H * (c.y ?? 0.12); X -= d * eInOut(seg(t, c.t1 - 0.3, c.t1)) * W; x.globalAlpha = 1; }
      if (c.giro || c.inclinacao) { const cxr = X + cwr / 2, cyr = Y + chh / 2; x.translate(cxr, cyr); x.rotate(((c.giro || 0) * (1 - eOut(seg(t, c.t0, c.t0 + 0.5))) + (c.inclinacao || 0)) * Math.PI / 180); x.translate(-cxr, -cyr); }
      sombraCard(); rr(X - m, Y - m, cwr + m * 2, chh + m * 2, c.raio ?? 28); x.fillStyle = C.branco; x.fill(); semSombra();
      x.save(); rr(X, Y, cwr, chh, c.raio_img ?? (m ? 14 : 28)); x.clip(); x.drawImage(b, X, Y, cwr, chh); x.restore();
      if (c.fita) fita(X + cwr / 2, Y - m, c.giro_fita || -3);
    }
    x.restore();
  },
  frase(c, t) {
    const { a } = vis(c, t); if (a <= 0) return;
    const fundoF = c.fundo || 'video';
    x.save(); x.globalAlpha = a;
    if (fundoF === 'video') { const g = x.createLinearGradient(0, H * (c.y ?? 0.2) - 200, 0, H * (c.y ?? 0.2) + 420); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.4, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    const nPal = (c.texto || '').split(/\s+/).length; const ts = c.na_fala === false ? null : tsDaFala(c, nPal);
    const cor = fundoF === 'claro' ? C.tinta : C.branco; const cdest = corDe(c.cor || ED.cor);
    titulo(c.texto, c.destaque, W / 2, H * (c.y ?? 0.2), { tam: c.tamanho || 104, cor, cdest, maxW: W * 0.84, alinhar: 'center', ts, t, t0: c.t0 });
    x.restore();
  },
  numero(c, t) {
    const { a } = vis(c, t); if (a <= 0) return; const p = eBack(seg(t, c.t0, c.t0 + 0.5)); const tam = c.tamanho || 300;
    x.save(); x.globalAlpha = a; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = `${PESO.titulo} ${tam * (0.85 + 0.15 * p)}px "${F.titulo}"`; x.letterSpacing = `${-tam * 0.04}px`;
    x.fillStyle = corDe(c.cor || ED.cor); x.fillText(c.valor, W / 2, H * (c.y ?? 0.3));
    if (c.legenda) { x.letterSpacing = '0px'; x.font = `${PESO.texto} 46px "${F.texto}"`; x.fillStyle = c.claro ? C.tinta : C.branco; x.fillText(c.legenda, W / 2, H * (c.y ?? 0.3) + 80); }
    x.restore();
  },
  selo(c, t) {
    const { a, ent } = vis(c, t); if (a <= 0) return; x.save(); x.font = `${PESO.rotulo} 30px "${F.rotulo}"`; x.letterSpacing = '3px';
    const txt = c.texto.toUpperCase(); const tw = x.measureText(txt).width; const pw = tw + 96, ph = 76; const X = (W - pw) / 2, Y = H * (c.y ?? 0.1) - (1 - ent) * 30;
    x.globalAlpha = a; sombraCard(); rr(X, Y, pw, ph, ph / 2); x.fillStyle = C.branco; x.fill(); semSombra();
    x.beginPath(); x.arc(X + 40, Y + ph / 2, 9, 0, 7); x.fillStyle = corDe(c.cor || ED.cor); x.fill();
    x.fillStyle = C.tinta; x.textBaseline = 'middle'; x.fillText(txt, X + 62, Y + ph / 2 + 1); x.restore();
  },
  comparativo(c, t) {
    [c.a, c.b].forEach((l, i) => {
      if (!l) return; const ti = c.t0 + i * 0.35; const p = eOut(seg(t, ti, ti + 0.4)); const a = p * (1 - seg(t, c.t1 - 0.25, c.t1)); if (a <= 0) return;
      const cw = W * 0.92, chh = c.altura_item || 220, X = (W - cw) / 2, Y = H * (c.y ?? 0.16) + i * (chh + 34) + (1 - p) * 40;
      x.save(); x.globalAlpha = a; sombraCard(); rr(X, Y, cw, chh, 28); x.fillStyle = C.branco; x.fill(); semSombra();
      if (l.bmp) x.drawImage(l.bmp, X + 44, Y + (chh - 84) / 2, 84, 84);
      x.font = `700 60px "${F.texto}"`; x.fillStyle = C.tinta; x.textBaseline = 'middle'; x.fillText(l.nome, X + (l.bmp ? 156 : 48), Y + chh / 2);
      x.font = `${PESO.titulo} 92px "${F.titulo}"`; x.textAlign = 'right'; x.fillStyle = l.bom ? C.bom : C.ruim; x.fillText(l.valor, X + cw - 48, Y + chh / 2 + 4); x.restore();
    });
  },
  lista(c, t) {
    const { a } = vis(c, t); if (a <= 0) return; const cw = W * (c.largura || 0.88), X = (W - cw) / 2, Y = H * (c.y ?? 0.12), lh = c.altura_item || 112;
    const ch = 60 + (c.titulo ? 76 : 0) + c.itens.length * lh;
    x.save(); x.globalAlpha = a; sombraCard(); rr(X, Y, cw, ch, 30); x.fillStyle = C.branco; x.fill(); semSombra();
    if (c.titulo) rotulo(c.titulo, X + 52, Y + 76, C.suave, 28);
    c.itens.forEach((it, i) => {
      const ti = c.t0 + 0.15 + i * (c.passo || 0.25); const p = eOut(seg(t, ti, ti + 0.3)); if (p <= 0) return;
      const iy = Y + 40 + (c.titulo ? 76 : 0) + i * lh + lh / 2; const on = c.destaque === i || (c.destaque === 'fala' && t >= ti && (i === c.itens.length - 1 || t < c.t0 + 0.15 + (i + 1) * (c.passo || 0.25)));
      if (on) { rr(X + 24, iy - lh / 2 + 8, cw - 48, lh - 16, 18); x.fillStyle = rgba(corDe(c.cor || ED.cor), 0.1); x.fill(); }
      x.globalAlpha = a * p; x.beginPath(); x.arc(X + 66, iy, 11, 0, 7); x.fillStyle = on ? corDe(c.cor || ED.cor) : '#C9CAD0'; x.fill();
      x.font = `${on ? 700 : 500} ${on ? 54 : 50}px "${F.texto}"`; x.fillStyle = C.tinta; x.textBaseline = 'middle'; x.fillText(it, X + 100 + (1 - p) * 20, iy + 2); x.globalAlpha = a;
    });
    x.restore();
  },
  // post (X, Instagram, site) recriado e TRADUZIDO quando está em outra língua; o print original fica em assets/ como prova
  citacao(c, t) {
    let { a } = vis(c, t);
    let recuo = 0;
    if (c.t2 != null && t >= c.t1 - 0.25) { a = 1; recuo = eOut(seg(t, c.t1 - 0.25, c.t1 + 0.2)); if (t > c.t2) a = 1 - seg(t, c.t2, c.t2 + 0.25); }
    if (a <= 0) return;
    const cw = W * (c.largura || 0.9), X0 = (W - cw) / 2, pad = 46;
    const fsMax = c.tamanho || 56, maxH = H * (c.altura_max || 0.36);
    let fs = fsMax, ls;
    for (; fs >= 30; fs -= 2) { ls = linhas(c.texto, `500 ${fs}px "${F.texto}"`, cw - pad * 2); if (ls.length * fs * 1.28 + 230 <= maxH) break; }
    const ch = pad * 2 + 104 + ls.length * fs * 1.28 + (c.data || c.metrica || c.traduzido ? 64 : 10);
    const dir = c.entrada === 'esquerda' ? -1 : c.entrada === 'baixo' ? 0 : 1;
    const pe = eBack(seg(t, c.t0, c.t0 + 0.5));
    const dx = dir * (1 - eOut(seg(t, c.t0, c.t0 + 0.6))) * W * 0.9, dy = dir === 0 ? (1 - pe) * 220 : 0;
    const rot = ((c.giro || 0) * (1 - recuo) + dir * 9 * (1 - eOut(seg(t, c.t0, c.t0 + 0.42)))) * Math.PI / 180;
    const cy0 = H * (c.y ?? 0.08);
    x.save(); x.globalAlpha = a * (1 - 0.55 * recuo);
    x.translate(W / 2 + dx, cy0 + ch / 2 + dy - recuo * 70); x.rotate(rot); x.scale(1 - 0.12 * recuo, 1 - 0.12 * recuo); x.translate(-W / 2, -ch / 2);
    sombraCard(); rr(X0, 0, cw, ch, 34); x.fillStyle = C.branco; x.fill(); semSombra(); x.strokeStyle = C.linha; x.lineWidth = 2; x.stroke();
    const ax = X0 + pad, ay = pad;
    if (c.avBmp) { x.save(); x.beginPath(); x.arc(ax + 46, ay + 46, 46, 0, 7); x.clip(); x.drawImage(c.avBmp, ax, ay, 92, 92); x.restore(); }
    else if (c.logoBmp) { rr(ax, ay, 92, 92, 22); x.fillStyle = '#F2F2F0'; x.fill(); x.drawImage(c.logoBmp, ax + 16, ay + 16, 60, 60); }
    x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = '#0F1419';
    x.font = `700 40px "${F.texto}"`; x.fillText(c.nome || '', ax + 116, ay + 40);
    const nwd = x.measureText(c.nome || '').width;
    if (c.verificado) { const bx = ax + 116 + nwd + 26, by = ay + 26; x.beginPath(); x.arc(bx, by, 17, 0, 7); x.fillStyle = '#1D9BF0'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 4.5; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(bx - 7.5, by + 0.5); x.lineTo(bx - 2, by + 6); x.lineTo(bx + 8, by - 6); x.stroke(); }
    x.font = `500 33px "${F.texto}"`; x.fillStyle = '#536471'; x.fillText(c.handle || '', ax + 116, ay + 84);
    if ((c.origem || 'x') === 'x') { const xx = X0 + cw - pad - 34, xy = ay + 10; x.strokeStyle = '#0F1419'; x.lineWidth = 6; x.lineCap = 'butt'; x.beginPath(); x.moveTo(xx, xy); x.lineTo(xx + 34, xy + 40); x.moveTo(xx + 34, xy); x.lineTo(xx, xy + 40); x.stroke(); }
    else { x.font = `${PESO.rotulo} 24px "${F.rotulo}"`; x.fillStyle = C.suave; x.textAlign = 'right'; x.fillText(c.origem.toUpperCase(), X0 + cw - pad, ay + 34); x.textAlign = 'left'; }
    const marcas = new Set((c.destaque || '').split(/\s+/).map(norm).filter(Boolean));
    x.font = `500 ${fs}px "${F.texto}"`; x.fillStyle = '#0F1419';
    let yy = ay + 104 + fs * 1.05; const sp = x.measureText(' ').width;
    ls.forEach((ln, li) => {
      let xx = ax;
      for (const w of ln.split(' ')) {
        const ww = x.measureText(w).width;
        if (marcas.has(norm(w))) { const pm = eOut(seg(t, c.t0 + 0.5 + li * 0.08, c.t0 + 0.9 + li * 0.08)); x.fillStyle = rgba(corDe(c.cor || ED.cor), 0.22); x.fillRect(xx - 4, yy - fs * 0.78, (ww + 8) * pm, fs * 1.02); x.fillStyle = '#0F1419'; }
        x.fillText(w, xx, yy); xx += ww + sp;
      }
      yy += fs * 1.28;
    });
    if (c.data || c.metrica) { x.font = `500 30px "${F.texto}"`; x.fillStyle = '#536471'; x.fillText([c.data, c.metrica].filter(Boolean).join('  ·  '), ax, ch - pad + 2); }
    if (c.traduzido) { x.font = `${PESO.rotulo} 22px "${F.rotulo}"`; x.letterSpacing = '2px'; const tt = 'TRADUZIDO'; const tw = x.measureText(tt).width; rr(X0 + cw - pad - tw - 28, ch - pad - 30, tw + 28, 42, 21); x.fillStyle = '#F2F2F0'; x.fill(); x.fillStyle = C.suave; x.fillText(tt, X0 + cw - pad - tw - 14, ch - pad - 2); x.letterSpacing = '0px'; }
    x.restore();
  },
};

// ---------------------------------------------------------------- layouts
// cheio = rosto na tela toda · split = assunto em cima, rosto grande embaixo · claro/escuro = só fundo (respiro, frase grande)
async function fundoELayout(t, s) {
  const lay = layoutEm(t, s); const bmp = (lay === 'claro' || lay === 'escuro') ? null : await quadro(s.f0 + Math.min(s.n - 1, Math.floor((t - s.o0) * FPS + 1e-6)));
  if (lay === 'split') {
    const D = ED.divisao || 0.48; const Y0 = Math.round(H * D);
    x.drawImage(FUNDO[ED.fundo_split || 'claro'], 0, 0);
    const [fx1, fy1] = focoDe(s); desenhaVideo(bmp, Object.assign({}, s, { foco: [fx1, fy1 + (ED.subir_rosto ?? 0.05)] }), t, { X: 0, Y: Y0, w: W, h: H - Y0 });
    const g = x.createLinearGradient(0, Y0, 0, Y0 + 26); g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, Y0, W, 26);
    if (ED.escurecer > 0) { const g2 = x.createLinearGradient(0, H * 0.8, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, `rgba(0,0,0,${ED.escurecer + 0.1})`); x.fillStyle = g2; x.fillRect(0, H * 0.8, W, H * 0.2); }
  } else if (lay === 'claro' || lay === 'escuro') {
    x.drawImage(FUNDO[lay], 0, 0);
  } else {
    desenhaVideo(bmp, s, t, { X: 0, Y: 0, w: W, h: H });
    if (ED.escurecer > 0) { const g = x.createLinearGradient(0, H * 0.5, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${ED.escurecer})`); x.fillStyle = g; x.fillRect(0, H * 0.5, W, H * 0.5); }
  }
  return lay;
}

// ---------------------------------------------------------------- legenda (sempre por último)
const P = Object.assign({}, LEG[ED.legenda] || LEG.palavra, ED.legenda_ajuste || {});
if (FONTES_MARCA.legenda) { P.familia = FONTES_MARCA.legenda[0]; P.peso = FONTES_MARCA.legenda[2] || P.peso; }
if (P.marca === 'destaque') P.marca = rgba(C.destaque, 0.95);
const SEM_LEGENDA = ED.legenda === 'nenhuma';
// altura: a do estilo, ou logo abaixo do queixo quando o rosto está mais baixo (nunca em cima da boca)
let Y_LEG = P.y, Y_MOTIVO = 'estilo';
if (P.modo === 'palavra' && P.y_auto !== false && !(ED.legenda_ajuste && ED.legenda_ajuste.y)) {
  const zmax = Math.max(...ED.zoom);
  for (const id in ROSTO) {
    const r = ROSTO[id]; const fy = r.cy - 0.02; const q = Math.min(1, fy + (r.queixo - fy) * zmax);
    const alvo = Math.min(0.86, q + 0.085);
    if (alvo > Y_LEG) { Y_LEG = +alvo.toFixed(3); Y_MOTIVO = `queixo a ${(q * 100).toFixed(0)}% com zoom ${zmax}`; }
  }
}
// na tela dividida o rosto ocupa a metade de baixo: a legenda vai logo abaixo do queixo, acima da interface do app
let Y_SPLIT = 0.84;
{
  const D = ED.divisao || 0.48, h = H * (1 - D), zmax = Math.max(...ED.zoom) * (ED.zoom_split || 1.08);
  for (const id in ROSTO) {
    const r = ROSTO[id]; const fy = r.cy - 0.02 + (ED.subir_rosto ?? 0.05); const sh = h / zmax; const sy = clamp(fy * H - sh / 2, 0, H - sh);
    const q = (D * H + (r.queixo * H - sy) * zmax) / H;
    Y_SPLIT = clamp(q + (ED.legenda_split_dy ?? 0.035), 0.7, 0.86);
  }
}
const caixa = s => P.caixa === 'minusculas' ? s.toLowerCase() : P.caixa === 'maiusculas' ? s.toUpperCase() : s;
const pont = s => P.pontuacao === 'mantem-virgula-tira-ponto' ? s.replace(/\.+$/, '').replace(/…$/, '') : s;
const paginas = [];
if (P.modo === 'pagina') {
  let cur = null;
  for (const w of words) {
    if (!cur || cur.w.length >= (P.max_palavras || 5) || w.t0 - cur.w[cur.w.length - 1].t1 > P.pausa_limpa) { cur = { w: [] }; paginas.push(cur); }
    cur.w.push(w);
  }
} else for (const w of words) paginas.push({ w: [w] });
paginas.forEach((p, i) => {
  const nx = paginas[i + 1]; const fim = p.w[p.w.length - 1].t1;
  p.t0 = p.w[0].t0;
  p.t1 = nx && nx.t0 - fim < P.pausa_limpa ? nx.t0 : fim + (P.folga_fim || 0.1);
  if (p.t1 - p.t0 < (P.min_tela || 0)) p.t1 = p.t0 + P.min_tela;
});
function textoComSombra(txt, X, Y) {
  const sh = P.sombra;
  if (sh) { x.shadowColor = sh.cor; x.shadowBlur = sh.blur; x.shadowOffsetY = sh.dy || 0; }
  if (P.contorno) { x.lineWidth = P.contorno * 2; x.strokeStyle = P.cor_contorno || 'rgba(0,0,0,0.8)'; x.lineJoin = 'round'; x.strokeText(txt, X, Y); }
  x.fillText(txt, X, Y); semSombra();
}
function legenda(t, lay) {
  if (SEM_LEGENDA) return;
  const p = paginas.find(q => t >= q.t0 && t < q.t1); if (!p) return;
  const noFundo = lay === 'claro'; // sobre fundo claro a legenda vira tinta escura, sem sombra
  const yBase = lay === 'split' ? Y_SPLIT : Y_LEG;
  x.save(); x.textBaseline = 'alphabetic';
  if (P.modo === 'palavra') {
    const w = p.w[0]; if (w.bip) { x.restore(); return; }
    const esc = enfase.get(w.t0) || 1; const tam = P.tamanho * esc;
    x.font = `${P.peso} ${tam}px "${P.familia}"`; x.letterSpacing = `${(P.tracking || 0) * tam}px`;
    const txt = caixa(pont(w.w)); const larg = x.measureText(txt).width;
    const s = larg > P.largura_max ? P.largura_max / larg : 1;
    x.globalAlpha = P.pop_ms ? clamp((t - p.t0) / (P.pop_ms / 1000)) : 1;
    x.fillStyle = noFundo ? C.tinta : esc > 1 ? corDe(P.cor_enfase || 'creme') : P.cor;
    x.translate(W / 2, H * yBase); x.scale(s, s); x.textAlign = 'center';
    if (noFundo) x.fillText(txt, 0, 0); else textoComSombra(txt, 0, 0);
  } else {
    // página: até 2 linhas centralizadas, marca-texto varrendo cada palavra no tempo da fala
    x.font = `${P.peso} ${P.tamanho}px "${P.familia}"`; const sp = x.measureText(' ').width; const LH = P.tamanho * 1.3;
    const itens = p.w.map(w => ({ w, txt: caixa(pont(w.w)), wd: x.measureText(caixa(pont(w.w))).width }));
    const ls = [[]]; let lw = 0; for (const it of itens) { if (lw && lw + sp + it.wd > P.largura_max) { ls.push([]); lw = 0; } ls[ls.length - 1].push(it); lw += (lw ? sp : 0) + it.wd; }
    const larg = Math.max(...ls.map(l => l.reduce((a, i) => a + i.wd, 0) + sp * (l.length - 1)));
    const X0 = (W - larg) / 2, Y0 = H * yBase - (ls.length - 1) * LH / 2;
    ls.forEach((l, li) => {
      let cx = X0; const cy = Y0 + li * LH;
      for (const it of l) {
        if (it.w.bip) { cx += it.wd + sp; continue; }
        const prog = clamp((t - it.w.t0) / Math.max(0.05, it.w.t1 - it.w.t0));
        if (prog > 0 && P.marca) { x.save(); x.fillStyle = P.marca; x.beginPath(); const mw = (it.wd + 16) * prog; x.moveTo(cx - 2, cy - P.tamanho * 0.78); x.lineTo(cx - 8 + mw + 6, cy - P.tamanho * 0.78); x.lineTo(cx - 8 + mw - 2, cy + P.tamanho * 0.22); x.lineTo(cx - 10, cy + P.tamanho * 0.22); x.closePath(); x.fill(); x.restore(); }
        x.fillStyle = noFundo ? C.tinta : P.cor; if (noFundo) x.fillText(it.txt, cx, cy); else textoComSombra(it.txt, cx, cy); cx += it.wd + sp;
      }
    });
  }
  x.restore();
}

// ---------------------------------------------------------------- cena sob medida do projeto (extra.js)
let EXTRA = {};
try { if (window.__temExtra) { const m = await import('/p/extra.js'); EXTRA = (m.default || (() => ({})))({ x, W, H, C, F, PESO, TL, words, ancora, seg, eOut, eBack, eInOut, clamp, rr, img, logo, titulo, rotulo, DESENHA }) || {}; for (const c of CENAS) if (EXTRA.preparar) await EXTRA.preparar(c); } } catch (e) { avisos.push('extra.js falhou: ' + e.message); }

// ---------------------------------------------------------------- acabamento "cru": grão de filme, vinheta e tom levemente quente
const GRAO = [];
function cru(n) {
  if (!GRAO.length) {
    let a = 977; const r = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    for (let k = 0; k < 6; k++) { const g = new OffscreenCanvas(540, 960), gx = g.getContext('2d'), im = gx.createImageData(540, 960);
      for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      gx.putImageData(im, 0, 0); GRAO.push(g); }
  }
  x.save();
  x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,170,100,0.16)'; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.07; x.imageSmoothingEnabled = false; x.drawImage(GRAO[n % GRAO.length], 0, 0, W, H);
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  const v = x.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  x.restore();
}

// ---------------------------------------------------------------- quadro
async function desenha(n) {
  const t = n / FPS; const s = segEm(t);
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  VID = null; const lay = await fundoELayout(t, s);
  if (ED.acabamento === 'cru') cru(n);
  if (EXTRA.fundo) EXTRA.fundo(t, s, lay);
  for (const c of CENAS) {
    if (t < c.t0 - 0.01 || t > (c.t2 != null ? c.t2 + 0.3 : c.t1) + 0.01) continue;
    if (EXTRA.cena && EXTRA.cena(c, t, s) === true) continue;
    const f = DESENHA[c.tipo]; if (f) { x.save(); f(c, t, s); x.restore(); }
  }
  if (EXTRA.frente) EXTRA.frente(t, s, lay);
  legenda(t, lay);
}

window.__meta = { FPS, FRAMES: TL.frames };
window.__frame = async (n, q = 0.93) => { await desenha(n); return cv.toDataURL('image/jpeg', q); };
window.__qa = () => {
  const estouro = [];
  if (P.modo === 'palavra') { x.font = `${P.peso} ${P.tamanho}px "${P.familia}"`; for (const p of paginas) { const wd = x.measureText(p.w[0].w).width; if (wd > P.largura_max) estouro.push(`${p.w[0].w} (${Math.round(wd)} px, reduzida)`); } }
  const sobrepostas = []; const cs = [...CENAS].sort((a, b) => a.t0 - b.t0);
  for (let i = 1; i < cs.length; i++) if (cs[i].t0 < cs[i - 1].t1 - 0.3 && (cs[i].y ?? 0.15) === (cs[i - 1].y ?? 0.15)) sobrepostas.push(`${cs[i - 1].tipo}@${cs[i - 1].t0.toFixed(1)} × ${cs[i].tipo}@${cs[i].t0.toFixed(1)}`);
  const naLegenda = CENAS.filter(c => ['numero', 'frase', 'card', 'selo', 'logo', 'logos'].includes(c.tipo) && c.y != null && Math.abs(c.y - Y_LEG) < 0.07).map(c => `${c.tipo}@${c.t0.toFixed(1)} (y ${c.y}) encosta na legenda (y ${Y_LEG})`);
  const desconhecidas = CENAS.filter(c => !DESENHA[c.tipo]).map(c => `${c.tipo}@${c.t0.toFixed(1)} (tipo que o motor não desenha: só aparece se o extra.js desenhar)`);
  return { cenas_na_altura_da_legenda: naLegenda, legenda: { estilo: ED.legenda, y: Y_LEG, y_split: +Y_SPLIT.toFixed(3), motivo: Y_MOTIVO }, duracao_s: +(TL.frames / FPS).toFixed(2), pedacos: SEGS.length, palavras: words.length, paginas_legenda: paginas.length, cenas: CENAS.map(c => `${c.tipo} ${c.t0.toFixed(2)}–${c.t1.toFixed(2)}`), legenda_reduzida: estouro, cenas_sobrepostas: sobrepostas, tipos_desconhecidos: desconhecidas, avisos };
};
window.__cenas = () => CENAS.map(c => ({ tipo: c.tipo, t0: +c.t0.toFixed(3), t1: +c.t1.toFixed(3), n: (c.logos || c.itens || [1]).length, passo: c.passo || 0.25, fundo: c.fundo || null })).concat(LAYS.map((l, i) => ({ tipo: 'layout', t0: +l.t0.toFixed(3), t1: +l.t0.toFixed(3), de: i ? LAYS[i - 1].layout : null, para: l.layout })));
window.__ready = true;
