// EFEITO NATIVO · print (o "print vivo") · versão aberta do painel imersivo do editor da Nomics (17/Out/2026).
// O print do assunto vira uma janela de navegador viva no topo da tela dividida: entra em perspectiva 3D com sombra
// real (chicote com borrão), a página rola até o trecho dito, um cursor anda até ele e clica (anel na cor de destaque)
// e um marca-texto (ou uma caixa) se desenha na palavra. Sai em chicote. Fundo escuro com luz que deriva no tempo do
// vídeo (não pula de uma tela para a outra). Sem zoom: só rolagem, giro de perspectiva, deslocamento e cursor.
// Tudo desenhado aqui no canvas, a partir de um PNG/JPG seu (print, página salva, foto de tela). Mac e Windows.
// { "tipo": "print", "src": "assets/pagina.png", "quando": "aprende o estilo", "ate": "Funciona",
//   "url": "github.com/voce/projeto",
//   "marcas": [ { "area": [0.06, 0.41, 0.52, 0.03], "quando": "referências" },            ← marca-texto amarelo
//               { "area": [0.70, 0.12, 0.22, 0.05], "quando": "baixar", "tipo": "caixa" } ], ← caixa que se desenha
//   "rola": [0, 0.35], "rola_em": ["aprende", "referências"], "lado": "direita", "modo": "topo", "cursor": true }
// area = [x, y, largura, altura] em FRAÇÃO do print (0 a 1, origem no canto de cima à esquerda); várias linhas de um
// mesmo trecho: "area": [[...], [...]]. Para achar a área de um texto: motor/achar_texto.py <print> "trecho" (Mac).
// rola = topo da janela em fração da altura do print, no começo e no fim (sem ela: centra a primeira marca).
// modo "topo" (padrão): o painel de cima da tela dividida (o layout vira split enquanto dura). "flutua": a janela
// boia sobre o vídeo, sem fundo, com o topo em "y" (fração da tela).
import * as FX from './fisico.js';
let B, K;
const usa = (b, c) => { B = b; ({ K } = b.usa(c)); };

const E = v => 1 - Math.pow(1 - v, 3);
const EE = v => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const cl = v => Math.max(0, Math.min(1, v));
const AMARELO = '#FFD60A';

// geometria da janela (px do quadro). u = escala para 1080 de largura (o desenho de referência).
function geo(c) {
  const { W, H } = B, u = W / 1080, im = c.bmp;
  const topo = (c.modo || 'topo') !== 'flutua';
  const PH = topo ? Math.round(H * (B.ED.divisao || 0.48)) : H;
  const ww = Math.round((c.largura ?? 0.9) * W), BAR = Math.round(54 * u), k = ww / im.width, ih = im.height * k;
  const maxC = topo ? PH - (84 + 64) * u - BAR : (c.altura_max ?? 0.42) * H - BAR;
  const ch = Math.round(Math.min(ih, maxC)), wh = ch + BAR;
  const top = topo ? Math.max(60 * u, Math.round((PH - wh) / 2) - 6 * u) : (c.y ?? 0.1) * H;
  return { u, PH, ww, BAR, k, ih, ch, wh, top, topo, maxC };
}

function preparar(c, b) {
  usa(b, c);
  if (!c.bmp) { B.avisos.push(`print: imagem não achada (${c.src})`); c._ok = false; return; }
  c._ok = true;
  if ((c.modo || 'topo') !== 'flutua') c.layout = c.layout || 'split';   // o compositor troca para a tela dividida
  const G = c._g = geo(c), { u, k, ih, ch, maxC } = G, D = c._D = c.t1 - c.t0;
  const IW = c.bmp.width, IH = c.bmp.height;
  // marcas: grupos com retângulos em px do conteúdo; cada grupo varre na sua palavra
  const grupos = (c.marcas || []).map(m => {
    const areas = Array.isArray(m.area && m.area[0]) ? m.area : [m.area || [0, 0, 0, 0]];
    const rs = areas.map(a => [a[0] * IW * k, a[1] * IH * k, a[2] * IW * k, a[3] * IH * k]);
    const tq = B.tempo(m.quando); if (tq == null) return null;
    const t0 = Math.max(0.42, tq - c.t0 - 0.05), tot = rs.reduce((s, r) => s + r[2], 0) / u;
    return { rs, t0, dur: Math.min(1.0, 0.25 + tot / 900), caixa: m.tipo === 'caixa', cor: m.cor };
  }).filter(Boolean);
  c._grupos = grupos;
  // rolagem: do topo y0 ao y1 (px do conteúdo), entre a e b (s desde o começo)
  let y0, y1;
  if (ih > maxC) {
    if (c.rola) { y0 = c.rola[0] * ih; y1 = Math.min(ih - ch, c.rola[1] * ih); }
    else if (grupos.length) { const ys = grupos.flatMap(g => g.rs.map(r => r[1] + r[3] / 2)); const mid = (Math.min(...ys) + Math.max(...ys)) / 2 + 10 * u; y1 = Math.max(0, Math.min(ih - ch, mid - ch * 0.5)); y0 = Math.max(0, y1 - 160 * u); }
    else { y0 = 0; y1 = Math.min(ih - ch, 160 * u); }
  } else { y0 = -60 * u; y1 = 0; }
  const ra = c.rola_em ? (B.tempo(c.rola_em[0]) ?? c.t0) - c.t0 : 0.05, rb = c.rola_em ? (B.tempo(c.rola_em[1]) ?? c.t0 + 1.4) - c.t0 : Math.min(D - 0.2, 1.4);
  c._rola = { y0, y1, a: ra, b: Math.max(ra + 0.2, rb), max: ih > maxC ? ih - ch : 0 };
  // cursor: entra do canto de baixo, vai ao começo de cada marca, clica e acompanha a varredura
  const { BAR, ww, wh } = G, lado = c.lado === 'esquerda';
  const K0 = [[0.18, lado ? -80 * u : ww + 70 * u, wh + 140 * u, 0]];
  for (const g of grupos) {
    const r0 = g.rs[0], rl = g.rs[g.rs.length - 1], yy = r0[1] + r0[3] * 0.7 + BAR - rolaY(c, g.t0);
    K0.push([Math.max(0.3, g.t0 - 0.32), r0[0] + 6 * u - 18 * u, yy + 4 * u, 0], [g.t0, r0[0], yy, 1],
      [g.t0 + g.dur, rl[0] + rl[2] - 8 * u, rl[1] + rl[3] * 0.7 + BAR - rolaY(c, g.t0 + g.dur), 0]);
  }
  if (!grupos.length) K0.push([Math.min(D * 0.5, 1.1), ww * 0.62, wh * 0.55, 0]);
  const ul = K0[K0.length - 1]; K0.push([Math.max(D, ul[0] + 0.3), ul[1] + 40 * u, ul[2] + 30 * u, 0]);
  c._K = c.cursor === false ? [] : K0;
}

function rolaY(c, t) {
  const R = c._rola; let y = R.y0 + (R.y1 - R.y0) * (t <= R.a ? 0 : t >= R.b ? 1 : EE((t - R.a) / (R.b - R.a)));
  if (t > R.b) y += (t - R.b) * 9 * (B.W / 1080);   // deriva lenta: a página nunca fica parada
  return R.max > 0 ? Math.min(R.max, y) : y;
}

// sons: whoosh na entrada, clique em cada clique do cursor, whoosh na saída (se não emenda em outro print)
const sons = c => !c._ok ? [] : [{ t: c.t0 - 0.02, som: 'whoosh', ganho: 0.75 },
  ...c._K.filter(k => k[3]).map(k => ({ t: c.t0 + k[0], som: 'click-soft', ganho: 0.6 })),
  ...(c._emenda ? [] : [{ t: c.t1 - 0.04, som: 'whoosh', ganho: 0.5 }])];

// ------------------------------------------------------------------ peças
function fundo(g, Y0, PH, ta) {
  const { W, rgba } = B, u = W / 1080;
  g.fillStyle = K.superficie_funda || '#0F1221'; g.fillRect(0, Y0, W, PH);
  const luz = (cx, cy, rx, ry, cor, a) => {
    g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, rx); r.addColorStop(0, rgba(cor, a)); r.addColorStop(0.7, rgba(cor, 0)); r.addColorStop(1, rgba(cor, 0));
    g.fillStyle = r; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  };
  const a = 12 + 8 * Math.sin(ta * 0.21), b = 10 + 6 * Math.cos(ta * 0.17), cc = 88 + 6 * Math.sin(ta * 0.13), d = 92 + 5 * Math.cos(ta * 0.19);
  g.save(); g.beginPath(); g.rect(0, Y0, W, PH); g.clip();
  luz(W * a / 100, Y0 + PH * b / 100, 560 * u, 420 * u, K.destaque2 || '#6448E0', 0.30);
  luz(W * cc / 100, Y0 + PH * d / 100, 600 * u, 460 * u, K.destaque, 0.22);
  luz(W * 0.5, Y0 + PH * 1.2, 900 * u, 500 * u, '#C6FF00', 0.05);
  const pat = g.createPattern(B.grao(), 'repeat'); g.globalAlpha = 0.07; g.globalCompositeOperation = 'overlay'; g.fillStyle = pat; g.fillRect(0, Y0, W, PH);
  g.restore();
}

function cursor(g, t, Kc, u) {
  if (!Kc.length) return;
  let k = 0; while (k < Kc.length - 1 && t >= Kc[k + 1][0]) k++;
  let X, Y;
  if (t <= Kc[0][0]) { X = Kc[0][1]; Y = Kc[0][2]; }
  else if (k >= Kc.length - 1) { const q = Kc[Kc.length - 1]; X = q[1] + Math.sin(t * 1.3) * 6 * u; Y = q[2] + Math.cos(t * 1.1) * 4 * u; }
  else { const a = Kc[k], b = Kc[k + 1], q = EE(cl((t - a[0]) / (b[0] - a[0]))); X = a[1] + (b[1] - a[1]) * q; Y = a[2] + (b[2] - a[2]) * q; }
  let sc = 1, ao = 0, as = 0;
  for (const q of Kc) if (q[3]) { const d = t - q[0]; if (d >= 0 && d < 0.12) sc = 0.84; if (d >= 0 && d < 0.45) { ao = 1 - d / 0.45; as = 0.4 + d / 0.45 * 1.4; } }
  if (ao > 0) { g.save(); g.globalAlpha = ao; g.strokeStyle = K.destaque; g.lineWidth = 4 * u; g.beginPath(); g.arc(X + 4 * u, Y + 4 * u, 35 * u * as, 0, Math.PI * 2); g.stroke(); g.restore(); }
  // a seta (22×29 desenhada a 2×): preta com contorno branco e sombra macia
  g.save(); g.translate(X, Y); g.scale(2 * u * sc, 2 * u * sc);
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.beginPath(); g.moveTo(1.5, 1.5); g.lineTo(1.5, 23); g.lineTo(7, 17.6); g.lineTo(10.6, 26.4); g.lineTo(14.4, 24.8); g.lineTo(10.9, 16.2); g.lineTo(18.6, 16.2); g.closePath();
  g.fillStyle = '#111111'; g.fill(); g.shadowColor = 'transparent'; g.lineWidth = 1.7; g.lineJoin = 'round'; g.strokeStyle = '#FFFFFF'; g.stroke();
  g.restore();
}

// a janela inteira, de frente, num canvas próprio (depois vira plano 3D)
function janela(c, t, G) {
  const { u, ww, wh, BAR, ch } = G, g = FX.tela('print-jan', ww, wh), im = c.bmp, r = 24 * u;
  g.save(); g.beginPath(); g.roundRect(0, 0, ww, wh, r); g.clip();
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, ww, wh);
  // conteúdo rolando
  const y = rolaY(c, t);
  g.save(); g.beginPath(); g.rect(0, BAR, ww, ch); g.clip(); g.translate(0, BAR - y);
  g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, ww, G.ih);
  for (const gr0 of c._grupos) {
    const gr = !gr0.caixa || gr0.rs.length < 2 ? gr0 : { ...gr0, rs: [(() => { const x0 = Math.min(...gr0.rs.map(q => q[0])), y0 = Math.min(...gr0.rs.map(q => q[1])), x1 = Math.max(...gr0.rs.map(q => q[0] + q[2])), y1 = Math.max(...gr0.rs.map(q => q[1] + q[3])); return [x0, y0, x1 - x0, y1 - y0]; })()] };
    let acc = 0; const tot = gr.rs.reduce((s, q) => s + q[2], 0) || 1;
    for (const q of gr.rs) {
      const a = gr.t0 + gr.dur * acc / tot; acc += q[2]; const b = gr.t0 + gr.dur * acc / tot; const p = E(cl((t - a) / Math.max(0.05, b - a)));
      if (p <= 0) continue;
      if (gr.caixa) {   // contorno que se desenha em volta do trecho, com brilho e um véu leve por dentro
        const pad = 8 * u, X = q[0] - pad, Y = q[1] - pad, w = q[2] + 2 * pad, h = q[3] + 2 * pad, per = 2 * (w + h), cor = gr.cor || K.destaque;
        g.save(); g.fillStyle = B.rgba(cor, 0.10 * p); g.beginPath(); g.roundRect(X, Y, w, h, 12 * u); g.fill();
        g.lineWidth = 5 * u; g.strokeStyle = cor; g.shadowColor = B.rgba(cor, 0.55); g.shadowBlur = 16 * u; g.lineCap = 'round';
        g.setLineDash([per * p, per]); g.beginPath(); g.roundRect(X, Y, w, h, 12 * u); g.stroke(); g.restore();
      } else {         // marca-texto: varre da esquerda, multiplicando (o texto continua preto por cima)
        g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.62; g.fillStyle = gr.cor || AMARELO;
        g.beginPath(); g.roundRect(q[0] - 3 * u, q[1] - 2 * u, (q[2] + 6 * u) * p, q[3] + 4 * u, 5 * u); g.fill(); g.restore();
      }
    }
  }
  g.restore();
  // barra do navegador: três pontos e o endereço
  g.fillStyle = '#EEECE9'; g.fillRect(0, 0, ww, BAR); g.fillStyle = '#DCD9D4'; g.fillRect(0, BAR - 1, ww, 1);
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((cor, i) => { g.fillStyle = cor; g.beginPath(); g.arc(22 * u + 7.5 * u + i * 25 * u, BAR / 2, 7.5 * u, 0, Math.PI * 2); g.fill(); });
  const ux = 22 * u + 3 * 25 * u + 18 * u, uw = ww - ux - 22 * u, uh = 32 * u;
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(ux, (BAR - uh) / 2, uw, uh, 9 * u); g.fill();
  if (c.url) { B.fMono(g, 17 * u, 0.01); g.fillStyle = '#5B5B5B'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(String(c.url), ux + 14 * u, BAR / 2 + 1); g.letterSpacing = '0px'; }
  // luz que varre o vidro na chegada
  const lo = cl((t - 0.12) / 0.2) * (1 - cl((t - 0.75) / 0.3));
  if (lo > 0) {
    const lx = -500 * u + 1400 * u * cl((t - 0.1) / 0.8);
    const lg = g.createLinearGradient(lx, 0, lx + ww * 0.6, wh * 0.9);
    lg.addColorStop(0.3, 'rgba(255,255,255,0)'); lg.addColorStop(0.45, 'rgba(255,255,255,0.55)'); lg.addColorStop(0.6, 'rgba(255,255,255,0)');
    g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = lo; g.fillStyle = lg; g.fillRect(0, 0, ww, wh); g.restore();
  }
  cursor(g, t, c._K, u);
  g.restore();
  // fio de luz na quina de cima e contorno fino
  g.save(); g.beginPath(); g.roundRect(0.5, 0.5, ww - 1, wh - 1, r); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.stroke(); g.restore();
  return g.canvas;
}

function desenhar({ g: x, c, t: ta }, b) {
  usa(b, c);
  if (!c._ok) return;
  const { W, H } = B, G = c._g, { u, PH, ww, wh, top, topo } = G, D = c._D, t = ta - c.t0;
  if (t < -0.01 || t > D + 0.01) return;
  const Y0 = 0;
  if (topo) fundo(x, Y0, PH, ta);
  // chicote de entrada (0,30 s), deriva, chicote de saída (0,17 s)
  const i = E(cl(t / 0.30)), o = EE(cl((t - (D - 0.17)) / 0.17)), p = cl(t / Math.max(0.5, D));
  const s = c.lado === 'esquerda' ? -1 : 1, rad = Math.PI / 180;
  const tx = (1 - i) * s * 720 * u - o * s * 760 * u, ty = (1 - i) * 40 * u;
  const rx = -((1 - i) * 16 + 5 - 3 * p) * rad, ry = (s * ((1 - i) * -24 - 5 + 8 * p) + o * s * 18) * rad;
  const bl = (1 - i) * 9 + o * 10;
  const src = janela(c, t, G);
  const cam = { cx: W / 2, cy: Y0 + (topo ? PH : H) * 0.4, f: 1700 * u };
  const P = FX.plano(cam, [rx, ry, 0], [W / 2 + tx - cam.cx, Y0 + top + wh / 2 + ty - cam.cy, 0]);
  const mapa = (a, v) => P((a - 0.5) * ww, (v - 0.5) * wh);
  const L = FX.tela('print-camada', W, H);
  // sombra de chão (elipse escura sob a janela) e sombra projetada da própria janela
  const cs = [mapa(0, 0), mapa(1, 0), mapa(1, 1), mapa(0, 1)];
  const base = Math.max(cs[2][1], cs[3][1]), esq = Math.min(cs[0][0], cs[3][0]), dir = Math.max(cs[1][0], cs[2][0]);
  L.save(); L.globalAlpha = (1 - o) * i * 0.9; L.filter = `blur(${8 * u}px)`;
  const sw = Math.max(10, dir - esq - 120 * u), sx = esq + 60 * u;
  L.translate(sx + sw / 2, base + 25 * u); L.scale(1, 35 / Math.max(1, sw / 2));
  const sg = L.createRadialGradient(0, 0, 0, 0, 0, sw / 2); sg.addColorStop(0, 'rgba(0,0,0,0.62)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  L.fillStyle = sg; L.beginPath(); L.arc(0, 0, sw / 2, 0, Math.PI * 2); L.fill(); L.restore();
  // só a sombra: o polígono é desenhado fora da tela e a sombra cai no lugar (sem quina escura atrás da janela)
  const LONGE = 4 * W;
  for (const [a, bl2, dy] of [[0.6, 90, 40], [0.35, 28, 12]]) {
    L.save(); L.shadowColor = `rgba(0,0,0,${a})`; L.shadowBlur = bl2 * u; L.shadowOffsetX = LONGE; L.shadowOffsetY = dy * u;
    L.beginPath(); cs.forEach((q, j) => (j ? L.lineTo(q[0] - LONGE, q[1]) : L.moveTo(q[0] - LONGE, q[1]))); L.closePath(); L.fillStyle = '#000'; L.fill(); L.restore();
  }
  FX.malha(L, src, ww, wh, mapa, 14);
  x.save();
  if (topo) { x.beginPath(); x.rect(0, Y0, W, PH); x.clip(); }
  if (bl > 0.3) x.filter = `blur(${bl.toFixed(1)}px)`;
  x.drawImage(L.canvas, 0, 0); x.restore();
  if (topo) { x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(0, Y0 + PH - 1, W, 2); }
}

export default { tipo: 'print', camada: 'frente', mascara: false, quadro: false, preparar, sons, desenhar };
