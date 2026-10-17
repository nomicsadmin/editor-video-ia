// EFEITO NATIVO · timeline_chamas · criado do zero pela Nomics em 12/Out/2026.
// Uma timeline de edição (faixas V2, V1, T1, A1 com clipes, régua, agulha e timecode) se desdobra no ar acima da
// pessoa, em 3D leve, e se monta clipe a clipe. Na palavra, ela esquenta e pega fogo: a frente de queima avança de um
// canto pelo ruído, com a borda em brasa, a faixa carbonizada atrás, línguas de fogo subindo da borda, fagulhas e
// fumaça. O fogo ilumina a parede e o contorno da pessoa (que fica na frente de tudo).
// { "tipo": "timeline_chamas", "quando": "edição", "queima_em": "acaba", "titulo": "Edição · reels",
//   "queima_s": 1.15, "y": null, "largura": 0.86 }
// A cena termina sozinha ~2 s depois da queima (fagulhas e fumaça somem).
import * as FX from './fisico.js';
let B, T, K, F;
const usa = (b, c) => { B = b; ({ T, K, F } = b.usa(c)); };

const PW = 1000, PH = 430, NW = 480, NH = 206;   // 17/Out: grade da queima 2,4× mais fina (a de 200×86 aparecia em degraus)
// clipes por faixa: [início, fim] em fração da área de clipes (desenho nosso, não é dado)
const FAIXAS = [
  { nome: 'V2', cor: 'faixa_video2', clipes: [[0.02, 0.17], [0.26, 0.44], [0.62, 0.71], [0.83, 0.97]] },
  { nome: 'V1', cor: 'faixa_video', clipes: [[0.0, 0.22], [0.23, 0.41], [0.42, 0.66], [0.67, 0.84], [0.85, 1.0]] },
  { nome: 'T1', cor: 'faixa_texto', clipes: [[0.05, 0.16], [0.3, 0.38], [0.5, 0.62], [0.74, 0.8], [0.88, 0.95]] },
  { nome: 'A1', cor: 'faixa_audio', clipes: [[0.0, 1.0]] },
];

function preparar(c) {
  const nz = FX.ruido(31);
  // ordem de queima de cada célula: ruído + distância do ponto de ignição (canto de baixo, à direita)
  c._ordem = new Float32Array(NW * NH);
  for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
    const u = i / (NW - 1), v = j / (NH - 1), d = Math.hypot((u - 0.82) * 1.0, (v - 1.05) * 0.55);
    c._ordem[j * NW + i] = 0.55 * nz(u * 5.2, v * 2.6, 4) + 0.1 * nz(u * 26, v * 12, 3) + 0.62 * d;   // + detalhe fino: borda orgânica, não serrilhada
  }
  let mn = Infinity, mx = -Infinity; for (const o of c._ordem) { mn = Math.min(mn, o); mx = Math.max(mx, o); }
  for (let k = 0; k < c._ordem.length; k++) c._ordem[k] = (c._ordem[k] - mn) / (mx - mn);
  c._nz = FX.ruido(77);
  c._mask = new OffscreenCanvas(NW, NH); c._char = new OffscreenCanvas(NW, NH); c._glow = new OffscreenCanvas(NW, NH);
  c._pc = new OffscreenCanvas(PW, PH);
  // focos de fogo: células da grade com a hora em que pegam fogo (relativa à ignição). A queima é p = 1,12·u² com
  // u = (t − tq)/queima_s (power1.in), então a célula de ordem o acende em queima_s·√(o/1,12). Sem estado: cada
  // quadro sabe sozinho quais partículas estão vivas, e o seek pode ir para qualquer quadro.
  const qs = c.queima_s ?? 1.15, r = FX.ruido(53);
  c._focos = [];
  for (let j = 5; j < NH; j += 11) for (let i = 5; i < NW; i += 11) {
    const o = c._ordem[j * NW + i]; if (o > 1.12) continue;
    c._focos.push({ u: i / (NW - 1), v: j / (NH - 1), ti: qs * Math.sqrt(o / 1.12), h: r(i * 0.31, j * 0.47, 2), s: j * NW + i });
  }
  // sprites de fogo (bolha macia em 4 temperaturas: núcleo branco-amarelo → laranja → vermelho → brasa escura)
  c._spr = [];
}

// bolha macia de uma cor (sprite reaproveitado pelas partículas; 'lighter' soma as camadas como luz)
function sprite(cor, rgba) {
  const n = 64, cv = new OffscreenCanvas(n, n), g = cv.getContext('2d');
  const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, rgba(cor, 1)); gr.addColorStop(0.35, rgba(cor, 0.55)); gr.addColorStop(0.7, rgba(cor, 0.14)); gr.addColorStop(1, rgba(cor, 0));
  g.fillStyle = gr; g.fillRect(0, 0, n, n); return cv;
}

function timeline(c, b) {
  usa(b, c);
  const tl = c._tl = B.linha();
  const tq = B.tempo(c.queima_em) ?? c.t0 + 2.6, r = v => Math.max(0, v - c.t0);
  c._ent = { p: 0 }; c._agulha = { x: 0 }; c._calor = { p: 0 }; c._queima = { p: 0 }; c._fim = { p: 0 };
  c._clipes = FAIXAS.map(f => f.clipes.map(() => ({ p: 0 })));
  tl.fromTo(c._ent, { p: 0 }, { p: 1, duration: 0.9, ease: 'expo.out' }, 0);
  let k = 0; const montaFim = Math.min(r(tq) - 0.6, 1.5);
  FAIXAS.forEach((f, fi) => f.clipes.forEach((_, ci) => {
    const at = 0.25 + (k++ / 18) * Math.max(0.5, montaFim - 0.3);
    tl.fromTo(c._clipes[fi][ci], { p: 0 }, { p: 1, duration: 0.42, ease: 'back.out(1.6)' }, at);
  }));
  tl.fromTo(c._agulha, { x: 0 }, { x: 0.86, duration: Math.max(0.6, r(tq) - 0.3), ease: 'none' }, 0.3);
  tl.fromTo(c._calor, { p: 0 }, { p: 1, duration: 0.45, ease: 'power2.in' }, Math.max(0.3, r(tq) - 0.38));
  const qs = c.queima_s ?? 1.15;
  tl.fromTo(c._queima, { p: 0 }, { p: 1.12, duration: qs, ease: 'power1.in' }, r(tq) - 0.04);
  tl.fromTo(c._fim, { p: 0 }, { p: 1, duration: 1.9, ease: 'none' }, r(tq) - 0.04);
  c._tq = tq; c._qs = qs;
  c.t1 = Math.max(c.t1, tq + 2.0);
  return tl;
}

// whoosh no desdobrar, tique nos primeiros clipes, riser esquentando, impacto + whoosh de cinema na ignição
const sons = c => [{ t: c.t0 - 0.1, som: 'whoosh', ganho: 0.6 },
  { t: c.t0 + 0.3, som: 'tique', ganho: 0.6 }, { t: c.t0 + 0.55, som: 'tique', ganho: 0.5 },
  { t: c._tq - 0.02, som: 'riser', ganho: 0.5 },
  { t: c._tq - 0.03, som: 'impacto', ganho: 0.8 }, { t: c._tq + 0.02, som: 'whoosh-cinematic', ganho: 0.55 }];

// ---------------------------------------------------------------- o painel (desenhado plano, depois projetado)
function painel(c, t) {
  const g = c._pc.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, PW, PH);
  const { rgba } = B; const rr = B.rr;
  FX.placa(g, rr, 0, 0, PW, PH, 30, K, rgba, { brilho: (t - c.t0) * 0.35 % 1.6 });
  // cabeçalho: ponto, nome do projeto, timecode correndo
  const pad = 30;
  g.fillStyle = K.destaque; g.beginPath(); g.arc(pad + 7, 40, 7, 0, Math.PI * 2); g.fill();
  B.fMono(g, 25, 0.14); g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = rgba(K.texto, 0.78);
  g.fillText(String(c.titulo || 'Edição · reels').toUpperCase(), pad + 26, 41);
  const seg = Math.max(0, t - c.t0), qd = Math.floor(seg * 30) % 30, s = Math.floor(seg) + 14;
  B.fMono(g, 27, 0.04); g.textAlign = 'right'; g.fillStyle = rgba(K.texto_forte, 0.92);
  g.fillText(`00:00:${String(s).padStart(2, '0')}:${String(qd).padStart(2, '0')}`, PW - pad, 41);
  // régua
  const X0 = 96, X1 = PW - pad, Yr = 74;
  g.strokeStyle = rgba(K.linha, 0.16); g.lineWidth = 1.5; g.beginPath(); g.moveTo(X0, Yr + 26); g.lineTo(X1, Yr + 26); g.stroke();
  B.fMono(g, 15, 0.04); g.textAlign = 'left'; g.fillStyle = rgba(K.texto, 0.4);
  for (let i = 0; i <= 40; i++) { const x = X0 + (X1 - X0) * i / 40, alto = i % 5 === 0; g.strokeStyle = rgba(K.linha, alto ? 0.3 : 0.14); g.beginPath(); g.moveTo(x, Yr + 26); g.lineTo(x, Yr + (alto ? 10 : 18)); g.stroke(); if (alto && i < 40) g.fillText(`00:${String(i / 5 * 2).padStart(2, '0')}`, x + 4, Yr + 8); }
  // faixas
  const rowH = 64, gap = 9, Yf = Yr + 40;
  FAIXAS.forEach((f, fi) => {
    const y = Yf + fi * (rowH + gap);
    rr(g, pad, y, X1 - pad, rowH, 12); g.fillStyle = rgba(K.linha, 0.035); g.fill();
    B.fMono(g, 19, 0.06); g.textAlign = 'center'; g.fillStyle = rgba(K.texto, 0.55); g.fillText(f.nome, pad + 30, y + rowH / 2 + 1);
    f.clipes.forEach(([a, b], ci) => {
      const p = c._clipes[fi][ci].p; if (p <= 0) return;
      const xa = X0 + (X1 - X0) * a + 2, xb = X0 + (X1 - X0) * b - 2, w = (xb - xa) * Math.min(1, p), h = rowH - 12;
      const cor = K[f.cor];
      g.save(); g.globalAlpha = Math.min(1, p * 1.5);
      const gr = g.createLinearGradient(0, y + 6, 0, y + 6 + h); gr.addColorStop(0, rgba(cor, 0.95)); gr.addColorStop(1, rgba(cor, 0.72));
      rr(g, xa, y + 6, w, h, 9); g.fillStyle = gr; g.fill();
      g.strokeStyle = rgba(K.realce, 0.28); g.lineWidth = 1.2; rr(g, xa + 0.6, y + 6.6, w - 1.2, h - 1.2, 9); g.stroke();
      if (f.nome === 'A1') {   // forma de onda (desenho: seno com ruído fixo, não é áudio real)
        g.fillStyle = rgba(K.fundo_app, 0.55);
        for (let xx = xa + 6; xx < xa + w - 6; xx += 5) { const a2 = 0.25 + 0.7 * Math.abs(Math.sin(xx * 0.043) * c._nz(xx * 0.02, 3.1, 2)); g.fillRect(xx, y + 6 + h / 2 - a2 * h * 0.4, 3, a2 * h * 0.8); }
      } else if (w > 60) { g.fillStyle = rgba(K.fundo_app, 0.35); g.fillRect(xa + 10, y + 16, Math.min(w - 20, 70), 6); }
      g.restore();
    });
  });
  // agulha (playhead)
  const ax = X0 + (X1 - X0) * c._agulha.x;
  g.strokeStyle = rgba(K.destaque, 0.95); g.lineWidth = 3; g.beginPath(); g.moveTo(ax, Yr + 18); g.lineTo(ax, PH - 18); g.stroke();
  g.fillStyle = K.destaque; g.beginPath(); g.moveTo(ax - 10, Yr + 4); g.lineTo(ax + 10, Yr + 4); g.lineTo(ax, Yr + 20); g.closePath(); g.fill();
  // calor: o painel avermelha de baixo para cima antes de pegar fogo
  const ca = c._calor.p; if (ca > 0) {
    g.save(); g.globalCompositeOperation = 'source-atop';
    const hg = g.createLinearGradient(0, PH, 0, 0); hg.addColorStop(0, rgba(K.fogo, 0.55 * ca)); hg.addColorStop(0.6, rgba(K.fogo_borda, 0.18 * ca)); hg.addColorStop(1, rgba(K.fogo_borda, 0));
    g.fillStyle = hg; g.fillRect(0, 0, PW, PH); g.restore();
  }
  return g;
}

// máscara de queima, faixa carbonizada e borda em brasa (baixa resolução, ampliada com suavização = borda orgânica)
function queima(c, p) {
  const { rgba } = B;
  const mk = c._mask.getContext('2d'), ch = c._char.getContext('2d'), gl = c._glow.getContext('2d');
  const im = mk.createImageData(NW, NH), ic = ch.createImageData(NW, NH), ig = gl.createImageData(NW, NH);
  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [cr, cg, cb] = hex(K.carvao), [fr, fg, fb] = hex(K.fogo), [nr, ng, nb] = hex(K.fogo_nucleo);
  for (let k = 0; k < NW * NH; k++) {
    const o = c._ordem[k], d = o - p, q = k * 4;
    im.data[q + 3] = d > 0 ? 255 : 0;
    if (d > 0 && d < 0.09) { const a = 1 - d / 0.09; ic.data[q] = cr; ic.data[q + 1] = cg; ic.data[q + 2] = cb; ic.data[q + 3] = 235 * a; }
    if (d > -0.035 && d < 0.02) { const a = 1 - Math.abs(d + 0.008) / 0.028, quente = d > -0.012; ig.data[q] = quente ? nr : fr; ig.data[q + 1] = quente ? ng : fg; ig.data[q + 2] = quente ? nb : fb; ig.data[q + 3] = 255 * Math.max(0, a); }
  }
  mk.putImageData(im, 0, 0); ch.putImageData(ic, 0, 0); gl.putImageData(ig, 0, 0);
  void rgba;
}

async function desenhar({ g: x, c, t, V, mask }, b) {
  usa(b, c);
  const { W, H, rgba, clamp } = B;
  B.seek(c, t); const e = c._ent.p; if (e <= 0) return;
  const p = c._queima.p, fim = c._fim.p; if (fim >= 1) return;
  const pc = painel(c, t);
  if (p > 0) {
    queima(c, p);
    pc.imageSmoothingEnabled = true; pc.imageSmoothingQuality = 'high';
    pc.globalCompositeOperation = 'source-atop'; pc.filter = 'blur(2.5px)'; pc.drawImage(c._char, 0, 0, PW, PH);
    pc.globalCompositeOperation = 'destination-in'; pc.filter = 'blur(1.2px)'; pc.drawImage(c._mask, 0, 0, PW, PH); pc.filter = 'none';
    pc.globalCompositeOperation = 'lighter'; pc.filter = 'blur(6px)'; pc.drawImage(c._glow, 0, 0, PW, PH); pc.drawImage(c._glow, 0, 0, PW, PH); pc.filter = 'blur(1.5px)'; pc.drawImage(c._glow, 0, 0, PW, PH); pc.filter = 'none';
    pc.globalCompositeOperation = 'source-over';
  }
  // posição no quadro-fonte (cola na parede e acompanha zoom/punch), convertida para a tela atual
  const cab = c._cab, larg = (c.largura ?? 0.86) * W, esc = larg / PW;
  const sx = (c.x ?? 0.5) * W, sy = c.y != null ? c.y * H : (cab.topo + 0.025) * H - PH * esc * 0.5;   // a base do painel passa atrás do cabelo
  const cx = V.X + (sx - V.sx) * V.k, cy = V.Y + (sy - V.sy) * V.k, k = esc * V.k;
  // desdobra deitado e levanta; flutua de leve
  const bob = Math.sin((t - c.t0) * 1.7) * 6;
  const rx = -1.25 * (1 - e) - 0.16, ry = 0.1 * Math.sin((t - c.t0) * 0.6) - 0.05, rz = -0.012;
  const proj = FX.plano({ cx, cy: cy + bob * V.k + (1 - e) * 60 * V.k, f: 2100 }, [rx, ry, rz], [0, 0, 0]);
  const map = (u, v) => proj((u - 0.5) * PW * k, (v - 0.5) * PH * k);
  const G = FX.tela('tc-g', W, H);
  // sombra do painel na parede (cai para baixo e para longe da janela)
  G.save(); G.globalAlpha = 0.5 * e * (1 - clamp(p * 1.4)); G.filter = 'blur(30px)';
  const s0 = map(0.04, 0.12), s1 = map(0.96, 0.12), s2 = map(0.96, 1.08), s3 = map(0.04, 1.08);
  G.fillStyle = rgba(K.sombra_funda, 0.8); G.beginPath(); G.moveTo(s0[0] - 20, s0[1] + 34); G.lineTo(s1[0] - 20, s1[1] + 34); G.lineTo(s2[0] - 20, s2[1] + 44); G.lineTo(s3[0] - 20, s3[1] + 44); G.closePath(); G.fill(); G.restore();
  G.save(); G.globalAlpha = clamp(e * 1.4); FX.malha(G, c._pc, PW, PH, map, 10); G.restore();

  // fogo: línguas na frente de queima, fagulhas e fumaça
  let forca = 0;
  if (p > 0 && fim < 1) {
    const vivo = clamp(1.12 - p) / 1.12;          // quanto ainda há para queimar
    const resto = 1 - clamp((t - c._tq - c._qs) / 0.9);   // as últimas chamas morrem depois que o painel acaba
    forca = clamp(Math.min(1, p * 4)) * Math.max(vivo, 0.25 * resto) * (p >= 1.1 ? resto : 1);
    const nz = c._nz, tt = t - c.t0;
    // fumaça (atrás das chamas)
    G.save();
    for (let i = 0; i < 14; i++) {
      const nasce = c._tq + i * 0.09, a = t - nasce; if (a <= 0 || a > 2.2) continue;
      const u = 0.15 + 0.7 * nz(i * 3.1, 0.5, 2), o = map(u, 0.55), up = a * 230 * V.k, rad = (80 + a * 170) * V.k;
      const sg = G.createRadialGradient(o[0] + Math.sin(a * 2 + i) * 30, o[1] - up, 0, o[0], o[1] - up, rad);
      sg.addColorStop(0, rgba(K.fumaca, 0.075 * Math.sin(Math.PI * Math.min(1, a / 2.2)))); sg.addColorStop(0.6, rgba(K.fumaca, 0.03 * Math.sin(Math.PI * Math.min(1, a / 2.2)))); sg.addColorStop(1, rgba(K.fumaca, 0));
      G.fillStyle = sg; G.fillRect(o[0] - rad * 1.2, o[1] - up - rad * 1.2, rad * 2.4, rad * 2.4);
    }
    G.restore();
    // línguas de fogo na frente de queima (as do efeito aprovado), na grade fina e com a posição sorteada pelo ruído:
    // sem fileiras alinhadas. Cada uma tremula no tempo.
    const pts = [];
    if (p < 1.1) for (let j = 4; j < NH; j += 13) for (let i = 4; i < NW; i += 13) {
      const s = j * NW + i, ii = Math.min(NW - 1, Math.max(0, i + Math.round((nz(s * 0.17, 1.1, 1) - 0.5) * 12))), jj = Math.min(NH - 1, Math.max(0, j + Math.round((nz(s * 0.29, 2.3, 1) - 0.5) * 12)));
      const d = c._ordem[jj * NW + ii] - p; if (d > -0.05 && d < 0.012) pts.push([ii / (NW - 1), jj / (NH - 1), (ii >> 1) * 7 + (jj >> 1)]);
    }
    G.save(); G.globalCompositeOperation = 'lighter';
    const chama = (bx, by, w, h, sway, alfa) => {
      const gr = G.createLinearGradient(0, by, 0, by - h);
      gr.addColorStop(0, rgba(K.fogo_nucleo, 0.95 * alfa)); gr.addColorStop(0.28, rgba(K.fogo, 0.85 * alfa)); gr.addColorStop(0.7, rgba(K.fogo_borda, 0.45 * alfa)); gr.addColorStop(1, rgba(K.fogo_borda, 0));
      G.fillStyle = gr; G.beginPath(); G.moveTo(bx - w / 2, by);
      G.bezierCurveTo(bx - w * 0.7, by - h * 0.35, bx + sway * 0.4 - w * 0.25, by - h * 0.7, bx + sway, by - h);
      G.bezierCurveTo(bx + sway * 0.4 + w * 0.25, by - h * 0.7, bx + w * 0.7, by - h * 0.35, bx + w / 2, by); G.closePath(); G.fill();
    };
    pts.forEach(([u, v, s]) => {
      const o = map(u, v), fl = nz(s * 0.37, tt * 3.2, 3), alt = (95 + 200 * fl) * V.k * (0.4 + 0.6 * forca), larg = (30 + 30 * nz(s, 1.3, 2)) * V.k;
      const sway = (nz(s * 0.11, tt * 2.1, 2) - 0.5) * 60 * V.k;
      G.filter = 'blur(10px)'; chama(o[0], o[1] + 6, larg * 2.2, alt * 1.25, sway, 0.32 * forca);
      G.filter = 'blur(1.5px)'; chama(o[0], o[1] + 4, larg, alt, sway, 0.62 * forca);
    });
    G.filter = 'none';
    G.globalAlpha = 1;
    // fagulhas: nascem da frente de queima e sobem rodopiando
    for (let i = 0; i < 90; i++) {
      const nasce = c._tq + 0.05 + (i / 90) * (c._qs + 0.4), a = t - nasce, vida = 0.7 + 0.9 * nz(i, 9.1, 1); if (a <= 0 || a > vida) continue;
      const u = clamp(0.1 + 0.85 * nz(i * 1.7, 2.2, 2) + (i % 7) * 0.01), o = map(u, 0.35 + 0.6 * nz(i, 4.4, 1));
      const vx = (nz(i, 7.7, 1) - 0.5) * 140, vy = 180 + 260 * nz(i, 5.5, 1);
      const px = o[0] + (vx * a + Math.sin(a * 6 + i) * 18) * V.k, py = o[1] - (vy * a - 60 * a * a) * V.k, al = (1 - a / vida) * (0.6 + 0.4 * Math.sin(a * 30 + i));
      G.strokeStyle = rgba(K.brasa, al); G.lineWidth = 2.4 * V.k; G.beginPath(); G.moveTo(px, py); G.lineTo(px - vx * 0.02 * V.k, py + vy * 0.025 * V.k); G.stroke();
      G.fillStyle = rgba(K.fogo_nucleo, al); G.beginPath(); G.arc(px, py, 2 * V.k, 0, Math.PI * 2); G.fill();
    }
    G.restore();
  }
  // a pessoa fica na frente de tudo
  let P = null;
  if (mask) { P = FX.silhueta(B, FX.tela('tc-p', W, H), V, mask); G.globalCompositeOperation = 'destination-out'; G.drawImage(P.canvas, 0, 0); G.globalCompositeOperation = 'source-over'; }
  // luz do fogo: na parede (screen) e no contorno de cima da pessoa, tremulando
  if (forca > 0) {
    const fl = 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7.3), o = map(0.6, 0.6);
    x.save(); x.globalCompositeOperation = 'screen';
    const lg = x.createRadialGradient(o[0], o[1], 0, o[0], o[1], W * 0.95); lg.addColorStop(0, rgba(K.fogo, 0.5 * forca * fl)); lg.addColorStop(0.5, rgba(K.fogo_borda, 0.12 * forca * fl)); lg.addColorStop(1, rgba(K.fogo_borda, 0));
    x.fillStyle = lg; x.fillRect(0, 0, W, H); x.restore();
  }
  x.drawImage(G.canvas, 0, 0);
  if (forca > 0 && P) {
    const R = FX.tela('tc-r', W, H); R.drawImage(P.canvas, 0, 0);
    R.globalCompositeOperation = 'destination-out'; R.drawImage(P.canvas, 0, 24); R.globalCompositeOperation = 'source-in'; R.fillStyle = rgba(K.fogo, 1); R.fillRect(0, 0, W, H);
    // a luz do fogo cai com a distância: forte no cabelo, nada nos ombros
    const yb = map(0.5, 1.0)[1]; R.globalCompositeOperation = 'destination-in'; const qr = R.createLinearGradient(0, yb, 0, yb + 0.2 * H); qr.addColorStop(0, 'rgba(0,0,0,1)'); qr.addColorStop(1, 'rgba(0,0,0,0)'); R.fillStyle = qr; R.fillRect(0, 0, W, H); R.globalCompositeOperation = 'source-over';
    x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = Math.min(1, 1.1 * forca); x.filter = 'blur(8px)'; x.drawImage(R.canvas, 0, 0); x.restore();
  }
}

export default { tipo: 'timeline_chamas', camada: 'objeto', mascara: true, quadro: false, preparar, timeline, sons, desenhar };
