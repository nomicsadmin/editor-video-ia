// EFEITO NATIVO · tela_assunto · versão aberta do efeito do editor da Nomics (12/Out/2026, rodada 4).
// No gancho, a pessoa desce para a parte de baixo da tela e a sala some: no lugar entra um fundo escuro com luz de
// estúdio e, em cima, uma janela de app com o assunto (o print rolando devagar, um cursor que clica). A pessoa fica
// recortada, com um contorno de luz na cor da tela e a sombra no fundo. No fim, ela sobe de volta e a sala volta.
// { "tipo": "tela_assunto", "quando": "simplesmente", "volta": "aprende", "src": "assets/pagina.png",
//   "rotulo": "github.com", "rola": [0, 0.3], "escala_pessoa": 0.8, "janela": { "largura": 0.76, "y": 0.035 } }
// Recorte da pessoa: a máscara do motor/mascaras.py (Mac, Vision). Sem máscara (Windows) a pessoa desce dentro de uma
// janela de câmera de cantos redondos, com a mesma luz e a mesma sombra: o efeito não quebra.
// Durante a cena a legenda sobe para `legenda_y` (padrão: o vão entre a janela e o alto da cabeça).
import { mix } from './acabamento.js';
let B, T, K, F;
const usa = (b, c) => { B = b; ({ T, K, F } = b.usa(c)); };

const BARRA = 46;   // altura da barra da janela (px a 1080 de largura)
const EE = v => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

function preparar(c, b) {
  usa(b, c);
  if (!c.bmp) B.avisos.push(`tela_assunto: imagem não achada (${c.src || 'falta "src"'})`);
}

function timeline(c, b) {
  usa(b, c);
  const tl = c._tl = B.linha(), dur = c.t1 - c.t0;
  const tv = c.volta ? Math.min(Math.max(dur, 2.2), (B.tempo(c.volta, true) ?? c.t1) - c.t0) : dur; c._tv = Math.max(2.2, tv);
  const asp = c.janela?.aspecto ?? (960 / 1080);
  if (c.legenda_y === undefined) {   // a legenda sobe para o vão entre a janela e a cabeça (o rosto fica livre)
    const larg = c.janela?.largura ?? 0.76;
    const baseJan = (c.janela?.y ?? 0.035) + (larg * B.W * asp + BARRA * (B.W / 1080)) / B.H;
    const topo = 1 - (c.escala_pessoa ?? 0.8) * (1 - (c._cab?.topo ?? 0.38));
    c.legenda_y = Math.round(((baseJan + topo) / 2 + 0.016) * 1000) / 1000;
  }
  c._enc = { p: 0 }; c._jan = { p: 0 }; c._brilho = { p: -1 };
  tl.fromTo(c._enc, { p: 0 }, { p: 1, duration: 0.75, ease: 'expo.inOut' }, 0);
  tl.fromTo(c._jan, { p: 0 }, { p: 1, duration: 0.9, ease: 'expo.out' }, 0.22);
  tl.fromTo(c._brilho, { p: -0.2 }, { p: 1.2, duration: 1.1, ease: 'power2.inOut' }, 0.95);
  const ts = c._ts = Math.max(1.4, c._tv - 0.6);
  tl.to(c._jan, { p: 0, duration: 0.45, ease: 'power3.in' }, ts);
  tl.to(c._enc, { p: 0, duration: 0.6, ease: 'expo.inOut' }, ts + 0.12);
  c.t1 = c.t0 + Math.max(c._tv, ts + 0.72);
  c.legenda_t0 = c.t0 + 0.4; c.legenda_t1 = c.t0 + ts + 0.12;   // a legenda só sobe enquanto a pessoa está embaixo
  c._clique = c.clique_em != null ? (B.tempo(c.clique_em) ?? c.t0 + 1.45) - c.t0 : 1.45;
  return tl;
}

const sons = c => [{ t: c.t0 - 0.05, som: 'whoosh-cinematic', ganho: 0.4 }, { t: c.t0 + c._clique, som: 'click-soft', ganho: 0.6 },
  { t: c.t0 + c._ts, som: 'whoosh', ganho: 0.5 }];

// cor média do print (a luz que a tela joga no estúdio), normalizada: só a cor, não o escuro
function corMedia(c, im) {
  if (c._cor) return c._cor;
  const g = new OffscreenCanvas(4, 4).getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0, 4, 4); const d = g.getImageData(0, 0, 4, 4).data; let r = 0, gg = 0, bb = 0;
  for (let q = 0; q < d.length; q += 4) { r += d[q]; gg += d[q + 1]; bb += d[q + 2]; }
  const n = d.length / 4, mx = Math.max(r, gg, bb) / n || 1, f = Math.min(2.4, 225 / mx);
  c._cor = `#${[r, gg, bb].map(v => Math.round(Math.min(255, v / n * f)).toString(16).padStart(2, '0')).join('')}`;
  return c._cor;
}

// o conteúdo da janela: o print rolando de rola[0] a rola[1] (fração da altura) e um cursor que clica uma vez
const telas = {};
function rasc(nome, w, h) {
  const k = `${nome}:${w}x${h}`, c = telas[k] || (telas[k] = new OffscreenCanvas(w, h).getContext('2d'));
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.globalAlpha = 1; c.shadowColor = 'transparent'; c.clearRect(0, 0, w, h); return c;
}
function conteudo(c, t, w, h) {
  const g = rasc('conteudo', Math.round(w), Math.round(h)), im = c.bmp, ih = im.height * w / im.width;
  const [r0, r1] = c.rola || [0, 0.35], max = Math.max(0, ih - h);
  const a = 0.6, bq = Math.max(a + 0.5, c._ts - 0.2), q = t <= a ? 0 : t >= bq ? 1 : EE((t - a) / (bq - a));
  const y = Math.min(max, (r0 + (r1 - r0) * q) * ih);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, -y, w, ih);
  // cursor: entra pelo canto, para no meio da tela e clica (anel na cor de destaque)
  const u = w / 820, tc = c._clique, pa = EE(B.clamp((t - (tc - 0.9)) / 0.85));
  const X = w * (1.08 - 0.62 * pa) + Math.sin(t * 1.3) * 5 * u, Y = h * (1.1 - 0.62 * pa) + Math.cos(t * 1.1) * 4 * u;
  const d = t - tc; if (d >= 0 && d < 0.45) { g.save(); g.globalAlpha = 1 - d / 0.45; g.strokeStyle = K.destaque; g.lineWidth = 4 * u; g.beginPath(); g.arc(X + 4 * u, Y + 4 * u, 35 * u * (0.4 + d / 0.45 * 1.4), 0, Math.PI * 2); g.stroke(); g.restore(); }
  const sc = d >= 0 && d < 0.12 ? 0.84 : 1;
  g.save(); g.translate(X, Y); g.scale(2 * u * sc, 2 * u * sc); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.beginPath(); g.moveTo(1.5, 1.5); g.lineTo(1.5, 23); g.lineTo(7, 17.6); g.lineTo(10.6, 26.4); g.lineTo(14.4, 24.8); g.lineTo(10.9, 16.2); g.lineTo(18.6, 16.2); g.closePath();
  g.fillStyle = '#111111'; g.fill(); g.shadowColor = 'transparent'; g.lineWidth = 1.7; g.lineJoin = 'round'; g.strokeStyle = '#FFFFFF'; g.stroke(); g.restore();
  return g.canvas;
}

// janela fina de app: barra com os três pontos e o endereço (`rotulo`), quinas grandes, fio de luz no topo, borda de
// 1 px, reflexo diagonal fraco e sombra longa e macia
function janela(x, c, im, X, Y, w, h, k) {
  const { rgba } = B, bar = BARRA * k, r = 22 * k, H2 = h + bar;
  x.save(); x.shadowColor = rgba(K.sombra_funda, 0.6); x.shadowBlur = 70 * k; x.shadowOffsetY = 30 * k;
  B.rr(x, X, Y, w, H2, r); x.fillStyle = K.fundo_app || K.superficie_funda; x.fill(); x.restore();
  x.save(); B.rr(x, X, Y, w, H2, r); x.clip();
  const bg = x.createLinearGradient(0, Y, 0, Y + bar); bg.addColorStop(0, K.fundo_app2 || K.superficie); bg.addColorStop(1, K.fundo_app || K.superficie_funda);
  x.fillStyle = bg; x.fillRect(X, Y, w, bar);
  ['destaque', 'destaque_claro', 'linha'].forEach((cor, q) => { x.fillStyle = rgba(K[cor], q === 2 ? 0.3 : 0.85); x.beginPath(); x.arc(X + 26 * k + q * 22 * k, Y + bar / 2, 6.5 * k, 0, Math.PI * 2); x.fill(); });
  if (c.rotulo) {
    B.fMono(x, 19 * k, 0.04); const u = String(c.rotulo), uw = x.measureText(u).width + 56 * k;
    B.rr(x, X + w / 2 - uw / 2, Y + 9 * k, uw, bar - 18 * k, 14 * k); x.fillStyle = rgba(K.linha, 0.08); x.fill();
    x.fillStyle = rgba(K.texto, 0.72); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(u, X + w / 2, Y + bar / 2 + 1);
  }
  x.imageSmoothingQuality = 'high'; x.drawImage(im, X, Y + bar, w, h);
  const rf = x.createLinearGradient(X + w * 0.5, Y, X + w * 0.85, Y + H2); rf.addColorStop(0, rgba(K.realce, 0)); rf.addColorStop(0.5, rgba(K.realce, 0.06)); rf.addColorStop(1, rgba(K.realce, 0));
  x.fillStyle = rf; x.fillRect(X, Y, w, H2);
  x.fillStyle = rgba(K.realce, 0.14); x.fillRect(X, Y, w, 1.5 * k);
  x.restore();
  x.save(); B.rr(x, X + 0.5, Y + 0.5, w - 1, H2 - 1, r); x.lineWidth = 1; x.strokeStyle = rgba(K.borda, 0.2); x.stroke(); x.restore();
  return H2;
}

// borda sem a parede: o pixel de borda é mistura da pessoa com a parede antiga; a cor da borda passa a ser a do miolo
// vizinho e o alfa fica o da máscara (contorno liso, sem fio claro em volta da camiseta e do cabelo)
function descontamina(P) {
  const { W, H } = B, C = rasc('dc-c', W, H), E = rasc('dc-e', W, H);
  C.drawImage(P.canvas, 0, 0); C.globalCompositeOperation = 'destination-in';
  for (let k = 0; k < 3; k++) C.drawImage(C.canvas, 0, 0);
  C.globalCompositeOperation = 'source-over';
  E.filter = 'blur(3px)'; E.drawImage(C.canvas, 0, 0); E.filter = 'none';
  for (let k = 0; k < 4; k++) E.drawImage(E.canvas, 0, 0);
  E.globalCompositeOperation = 'destination-in'; E.drawImage(P.canvas, 0, 0); E.globalCompositeOperation = 'source-over';
  E.drawImage(C.canvas, 0, 0);
  P.globalCompositeOperation = 'copy'; P.drawImage(E.canvas, 0, 0); P.globalCompositeOperation = 'source-over';
}

async function desenhar({ g: x, c, t, V, mask }, b) {
  usa(b, c);
  const { W, H, clamp, rgba } = B;
  B.seek(c, t); const p = c._enc.p; if (p <= 0 || t > c.t1 + 0.001 || !c.bmp) return;
  const k = (c.escala ?? 1) * (W / 1080), tt = t - c.t0;
  const A = B.gp(); B.reset(A); A.drawImage(x.canvas, 0, 0);                         // o quadro como está
  const jp = c._jan.p, asp = c.janela?.aspecto ?? (960 / 1080);
  const w = (c.janela?.largura ?? 0.76) * W, h = w * asp;
  const im = conteudo(c, tt, w, h), cor = corMedia(c, c.bmp);
  // 1 · a sala desfoca e escurece enquanto o fundo entra por cima
  x.save(); x.filter = `blur(${p * 24}px) brightness(${1 - 0.5 * p})`; x.drawImage(A.canvas, 0, 0); x.restore();
  x.save(); x.globalAlpha = clamp(p * 1.15);
  const fg = x.createLinearGradient(0, 0, 0, H); fg.addColorStop(0, mix(K.superficie, K.realce, 0.03)); fg.addColorStop(0.55, K.superficie_funda); fg.addColorStop(1, K.noite || K.superficie_funda);
  x.fillStyle = fg; x.fillRect(0, 0, W, H);
  const l1 = x.createRadialGradient(W * 0.5, H * 0.26, 0, W * 0.5, H * 0.26, W * 0.9); l1.addColorStop(0, rgba(cor, 0.2 * clamp(jp))); l1.addColorStop(1, rgba(cor, 0));
  x.fillStyle = l1; x.fillRect(0, 0, W, H);
  const l2 = x.createRadialGradient(W * 0.5, H * 0.8, 0, W * 0.5, H * 0.8, W * 0.7); l2.addColorStop(0, rgba(K.destaque, 0.10)); l2.addColorStop(1, rgba(K.destaque, 0));
  x.fillStyle = l2; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.8); vg.addColorStop(0, rgba(K.vinheta, 0)); vg.addColorStop(1, rgba(K.vinheta, 0.5));
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  x.restore();
  // 2 · a janela do assunto descendo do alto
  if (jp > 0) {
    const X = (W - w) / 2, Y = (c.janela?.y ?? 0.035) * H, hb = h + BARRA * k;
    x.save(); x.globalAlpha = clamp(jp * 1.4); x.translate(0, (1 - jp) * -0.3 * H);
    const sc = 0.92 + 0.08 * jp; x.translate(W / 2, Y + hb / 2); x.scale(sc, sc); x.rotate((1 - jp) * 0.04); x.translate(-W / 2, -(Y + hb / 2));
    if (jp < 0.96) x.filter = `blur(${(1 - jp) * 14}px)`;
    janela(x, c, im, X, Y, w, h, k);
    const bp = c._brilho.p;   // a luz passa uma vez pelo vidro na chegada
    if (bp > -0.2 && bp < 1.2) {
      x.save(); B.rr(x, X, Y, w, hb, 22 * k); x.clip(); const bx = X + bp * w * 1.4 - w * 0.2;
      const sp = x.createLinearGradient(bx - w * 0.18, Y, bx + w * 0.18, Y + hb); sp.addColorStop(0, rgba(K.realce, 0)); sp.addColorStop(0.5, rgba(K.realce, 0.09)); sp.addColorStop(1, rgba(K.realce, 0));
      x.fillStyle = sp; x.fillRect(X, Y, w, hb); x.restore();
    }
    x.restore();
  }
  // 3 · a pessoa desce: o alto da cabeça cai até onde cairia com `escala_pessoa`, sem encolher
  const s = 1 - (1 - (c.escala_pessoa ?? 0.8)) * B.eOut(p);
  const yTopo = V.Y + ((c._cab?.topo ?? 0.38) * H - V.sy) * V.k, dy = (1 - s) * (H - yTopo);
  if (!mask) {
    // sem recorte (Windows): a pessoa desce dentro de uma janela de câmera, com sombra e contorno de luz na cor da tela.
    // A legenda desce para baixo do queixo, dentro da janela da câmera: o vão entre as janelas é estreito demais.
    c.legenda_y = 0.86;
    const cw = W * 0.8, cx = V.X + ((c._cab?.cx ?? 0.5) * W - V.sx) * V.k, X = Math.max(0, Math.min(W - cw, cx - cw / 2));
    const Y = yTopo + dy - 0.07 * H, r = 40 * k;
    x.save(); x.globalAlpha = clamp(p * 1.4);
    x.shadowColor = rgba(K.sombra_funda, 0.6); x.shadowBlur = 60 * k; x.shadowOffsetY = 24 * k;
    B.rr(x, X, Y, cw, H - Y + r, r); x.fillStyle = K.superficie_funda; x.fill(); x.shadowColor = 'transparent';
    x.save(); B.rr(x, X, Y, cw, H - Y + r, r); x.clip(); x.drawImage(A.canvas, 0, dy); x.restore();
    B.rr(x, X + 0.5, Y + 0.5, cw - 1, H - Y + r, r); x.lineWidth = 2 * k; x.strokeStyle = rgba(cor, 0.45); x.stroke();
    x.restore();
    return;
  }
  const P = rasc('P', W, H); B.naParede(P, V); P.filter = 'blur(0.8px)'; P.drawImage(mask, 0, 0, W, H); P.filter = 'none'; P.setTransform(1, 0, 0, 1, 0, 0);
  P.globalCompositeOperation = 'source-in'; P.drawImage(A.canvas, 0, 0); P.globalCompositeOperation = 'source-over';  // a pessoa recortada
  descontamina(P);
  const D = rasc('O', W, H); D.drawImage(P.canvas, 0, dy); const O = D.canvas;
  // sombra: larga, fraca e caindo para baixo
  x.save(); x.filter = `blur(${48 * p}px) brightness(0)`; x.globalAlpha = 0.2 * p; x.drawImage(O, 0, 28 * p); x.restore();
  x.drawImage(O, 0, 0);
  // contorno: luz fina na cor da tela, só por dentro da borda de cima e só na cabeça
  const tg = rasc('L', W, H); tg.drawImage(O, 0, 0);
  tg.globalCompositeOperation = 'destination-out'; tg.filter = 'blur(5px)'; tg.drawImage(O, 0, 7); tg.filter = 'none';
  const yQ = V.Y + (((c._cab?.topo ?? 0.38) + 0.32) * H - V.sy) * V.k + dy;
  const fq = tg.createLinearGradient(0, yQ - 0.06 * H, 0, yQ); fq.addColorStop(0, 'rgba(0,0,0,0)'); fq.addColorStop(1, 'rgba(0,0,0,1)');
  tg.fillStyle = fq; tg.fillRect(0, yQ - 0.06 * H, W, H);
  tg.globalCompositeOperation = 'source-in'; tg.fillStyle = cor; tg.fillRect(0, 0, W, H);
  x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.35 * p * clamp(jp); x.drawImage(tg.canvas, 0, 0); x.restore();
}

export default { tipo: 'tela_assunto', camada: 'luz', mascara: true, quadro: false, preparar, timeline, sons, desenhar };
