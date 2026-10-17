// EFEITOS NATIVOS · ACABAMENTO FÍSICO E 3D · criado do zero pela Nomics em 12/Out/2026.
// Utilidades que dão corpo às superfícies dos efeitos (frente 2): placa com chanfro e brilho especular, sombra dupla
// (ambiente + contato), plano 3D em perspectiva desenhado por malha de triângulos, ruído determinístico e o recorte
// da pessoa no enquadramento atual. Sem cor fixa: quem chama passa as cores do tema (K.*).
//   import * as FX from './fisico.js';

// ------------------------------------------------------------------ 3D: um plano no espaço, projetado na tela
// cam = { cx, cy, f } (centro óptico e distância focal em px). O plano é desenhado no espaço local (px, py) com
// origem no centro dele; rot = [rx, ry, rz] em radianos; pos = [tx, ty, tz] (tz > 0 afasta).
export function plano(cam, rot, pos) {
  const [rx, ry, rz] = rot, [tx, ty, tz] = pos;
  const cxr = Math.cos(rx), sxr = Math.sin(rx), cyr = Math.cos(ry), syr = Math.sin(ry), czr = Math.cos(rz), szr = Math.sin(rz);
  return (px, py) => {
    let x = px * czr - py * szr, y = px * szr + py * czr, z = 0;            // gira no próprio plano
    let y2 = y * cxr - z * sxr, z2 = y * sxr + z * cxr; y = y2; z = z2;    // inclina para trás (eixo X)
    let x2 = x * cyr + z * syr; z2 = -x * syr + z * cyr; x = x2; z = z2;   // vira de lado (eixo Y)
    x += tx; y += ty; z += tz;
    const k = cam.f / Math.max(1, cam.f + z);
    return [cam.cx + x * k, cam.cy + y * k, k];
  };
}

// desenha `src` (canvas/imagem de sw×sh) mapeado por `mapa(u, v)` → [x, y] (u, v de 0 a 1), em n×n quadriláteros,
// cada um em 2 triângulos afins. A malha fina dá a perspectiva certa; a sobra de 0,6 px some com as costuras.
export function malha(g, src, sw, sh, mapa, n = 12) {
  const P = [];
  for (let j = 0; j <= n; j++) { const r = []; for (let i = 0; i <= n; i++) r.push(mapa(i / n, j / n)); P.push(r); }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u0 = i / n * sw, u1 = (i + 1) / n * sw, v0 = j / n * sh, v1 = (j + 1) / n * sh;
    tri(g, src, P[j][i], P[j][i + 1], P[j + 1][i], [u0, v0], [u1, v0], [u0, v1]);
    tri(g, src, P[j][i + 1], P[j + 1][i + 1], P[j + 1][i], [u1, v0], [u1, v1], [u0, v1]);
  }
}
function tri(g, src, a, b, c, ta, tb, tc) {
  // aumenta o triângulo 0,6 px a partir do centro (esconde a costura entre vizinhos)
  const mx = (a[0] + b[0] + c[0]) / 3, my = (a[1] + b[1] + c[1]) / 3;
  const ex = p => { const dx = p[0] - mx, dy = p[1] - my, d = Math.hypot(dx, dy) || 1; return [p[0] + dx / d * 0.6, p[1] + dy / d * 0.6]; };
  const A = ex(a), Bp = ex(b), Cp = ex(c);
  const den = (tb[0] - ta[0]) * (tc[1] - ta[1]) - (tc[0] - ta[0]) * (tb[1] - ta[1]); if (Math.abs(den) < 1e-6) return;
  const m11 = ((b[0] - a[0]) * (tc[1] - ta[1]) - (c[0] - a[0]) * (tb[1] - ta[1])) / den;
  const m12 = ((b[1] - a[1]) * (tc[1] - ta[1]) - (c[1] - a[1]) * (tb[1] - ta[1])) / den;
  const m21 = ((c[0] - a[0]) * (tb[0] - ta[0]) - (b[0] - a[0]) * (tc[0] - ta[0])) / den;
  const m22 = ((c[1] - a[1]) * (tb[0] - ta[0]) - (b[1] - a[1]) * (tc[0] - ta[0])) / den;
  const dx = a[0] - m11 * ta[0] - m21 * ta[1], dy = a[1] - m12 * ta[0] - m22 * ta[1];
  g.save(); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(Bp[0], Bp[1]); g.lineTo(Cp[0], Cp[1]); g.closePath(); g.clip();
  g.transform(m11, m12, m21, m22, dx, dy); g.drawImage(src, 0, 0); g.restore();
}

// ------------------------------------------------------------------ superfícies
// placa com corpo de metal/vidro escuro: degradê vertical, chanfro (luz no alto, sombra embaixo), borda fina e um
// brilho especular diagonal que passa (`brilho` de 0 a 1 = posição da faixa; null = sem faixa).
export function placa(g, rr, X, Y, w, h, r, K, rgba, { topo = K.superficie, base = K.superficie_funda, alfa = 1, chanfro = 1, brilho = null, borda = 0.22 } = {}) {
  g.save();
  rr(g, X, Y, w, h, r); g.clip();
  const corpo = g.createLinearGradient(X, Y, X, Y + h); corpo.addColorStop(0, rgba(topo, alfa)); corpo.addColorStop(1, rgba(base, alfa));
  g.fillStyle = corpo; g.fillRect(X, Y, w, h);
  // reflexo amplo do ambiente: o terço de cima recebe a luz da sala
  const amb = g.createLinearGradient(X, Y, X, Y + h * 0.5); amb.addColorStop(0, rgba(K.realce, 0.10 * chanfro)); amb.addColorStop(1, rgba(K.realce, 0));
  g.fillStyle = amb; g.fillRect(X, Y, w, h * 0.5);
  if (brilho != null) {   // faixa especular atravessando na diagonal
    const p = -0.4 + 1.8 * brilho, bx = X + p * w;
    const sp = g.createLinearGradient(bx - w * 0.22, Y, bx + w * 0.22, Y + h);
    sp.addColorStop(0, rgba(K.realce, 0)); sp.addColorStop(0.5, rgba(K.realce, 0.13)); sp.addColorStop(1, rgba(K.realce, 0));
    g.fillStyle = sp; g.fillRect(X, Y, w, h);
  }
  g.restore();
  // chanfro: fio de luz na quina de cima e sombra na de baixo, por dentro da borda
  const e = Math.max(1, 1.6 * chanfro);
  g.save(); rr(g, X + e / 2, Y + e / 2, w - e, h - e, Math.max(0, r - e / 2)); g.lineWidth = e;
  const bv = g.createLinearGradient(X, Y, X, Y + h);
  bv.addColorStop(0, rgba(K.realce, 0.42 * chanfro)); bv.addColorStop(0.18, rgba(K.realce, 0.08 * chanfro)); bv.addColorStop(0.82, rgba(K.sombra_funda, 0.0)); bv.addColorStop(1, rgba(K.sombra_funda, 0.5 * chanfro));
  g.strokeStyle = bv; g.stroke(); g.restore();
  if (borda > 0) { g.save(); rr(g, X, Y, w, h, r); g.lineWidth = 1; g.strokeStyle = rgba(K.borda, borda * 0.5); g.stroke(); g.restore(); }
}

// sombra dupla de objeto sobre parede: ambiente larga e suave + contato curta e escura. `luz` = direção de onde vem a
// luz (a sombra cai para o lado oposto), em fração do tamanho do objeto.
export function sombra(g, rr, X, Y, w, h, r, cor, rgba, { forca = 1, luz = [0.35, -0.6], k = 1 } = {}) {
  const ox = -luz[0], oy = -luz[1];
  g.save();
  g.shadowColor = rgba(cor, 0.34 * forca); g.shadowBlur = 70 * k; g.shadowOffsetX = ox * 40 * k; g.shadowOffsetY = oy * 40 * k;
  rr(g, X, Y, w, h, r); g.fillStyle = rgba(cor, 0.01); g.fill();
  g.shadowColor = rgba(cor, 0.45 * forca); g.shadowBlur = 14 * k; g.shadowOffsetX = ox * 6 * k; g.shadowOffsetY = oy * 8 * k;
  rr(g, X, Y, w, h, r); g.fill();
  g.restore();
}

// ------------------------------------------------------------------ ruído determinístico (valor, suavizado)
export function ruido(seed = 7) {
  const P = new Uint8Array(512); let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let q = Math.imul(a ^ (a >>> 15), 1 | a); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; };
  const base = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  for (let i = 0; i < 512; i++) P[i] = base[i & 255];
  const V = Float32Array.from({ length: 256 }, () => rnd());
  const sm = t => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const v00 = V[P[X + P[Y]]], v10 = V[P[X + 1 + P[Y]]], v01 = V[P[X + P[Y + 1]]], v11 = V[P[X + 1 + P[Y + 1]]];
    const u = sm(xf), v = sm(yf); return (v00 * (1 - u) + v10 * u) * (1 - v) + (v01 * (1 - u) + v11 * u) * v;
  };
  return (x, y, oit = 4) => { let s = 0, amp = 0.5, fr = 1, tot = 0; for (let o = 0; o < oit; o++) { s += amp * n2(x * fr, y * fr); tot += amp; amp *= 0.5; fr *= 2.03; } return s / tot; };
}

// ------------------------------------------------------------------ a pessoa no enquadramento atual
// máscara (quadro-fonte) → canvas `P` na tela do quadro atual; `cor` opcional pinta a silhueta
export function silhueta(B, P, V, mask, cor = null) {
  B.reset(P); B.naParede(P, V); P.drawImage(mask, 0, 0, B.W, B.H); P.setTransform(1, 0, 0, 1, 0, 0);
  if (cor) { P.globalCompositeOperation = 'source-in'; P.fillStyle = cor; P.fillRect(0, 0, B.W, B.H); P.globalCompositeOperation = 'source-over'; }
  return P;
}
// a pessoa recortada do quadro já enquadrado (`fonte` = canvas do quadro como está)
export function pessoa(B, P, V, mask, fonte) {
  silhueta(B, P, V, mask);
  P.globalCompositeOperation = 'source-in'; P.drawImage(fonte, 0, 0); P.globalCompositeOperation = 'source-over';
  return P;
}

// telas extras de rascunho (cada efeito pede pelo nome; reaproveitadas entre quadros)
const TELAS = new Map();
export function tela(nome, W, H) {
  const k = `${nome}:${W}x${H}`; let c = TELAS.get(k);
  if (!c) { c = new OffscreenCanvas(W, H).getContext('2d'); TELAS.set(k, c); }
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.shadowColor = 'transparent'; c.clearRect(0, 0, W, H);
  return c;
}

// imagem servida pelo motor (/p/ = pasta do projeto, /b/ = _build), com cache
const IMGS = new Map();
export async function imagem(src) {
  if (IMGS.has(src)) return IMGS.get(src);
  const r = await fetch(src); const b = r.ok ? await createImageBitmap(await r.blob()) : null; IMGS.set(src, b); return b;
}
