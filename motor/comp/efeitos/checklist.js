// EFEITO NATIVO · checklist · criado do zero pela Nomics em 12/Out/2026 (refino v2 no mesmo dia: placa metálica 3D).
// Placa de metal escovado presa na parede que tica cada item quando ele é falado.
// v2 ("o dele tem UI e UX melhor, em formato meio 3D metálico", Vinicius 12/Out):
//   · placa com espessura visível, chanfro com luz especular no topo e aresta escura embaixo, escovado fino;
//   · leve perspectiva (a placa gira na parede ao entrar e assenta com um resto de inclinação), sombra de contato;
//   · linha ativa numa faixa iluminada com filete na cor de ação; texto ativo na cor de ação;
//   · ícone que acende com brilho pulsando na hora do tique, raios e o visto se desenhando;
//   · trilho de progresso gravado na placa, que acende com brilho.
// "material": "vidro" volta ao painel de vidro fosco da v1. Cores, fontes e cantos vêm da marca (base.js).
// { "tipo": "checklist", "quando": "auto zoom#1", "ate": "...", "titulo": "O Recordly faz sozinho",
//   "itens": [{ "texto": "Auto zoom", "quando": "auto zoom#1" }, ...], "largura": 0.8, "x": null, "y": null,
//   "perspectiva": 0.07, "material": "metal" }
let B, T, K, F;
const usa = (b, c) => { B = b; ({ T, K, F } = b.usa(c)); };

function timeline(c, b) {
  usa(b, c);
  const tl = c._tl = B.linha();
  c._ent = { p: 0, giro: 1 }; c._sai = { p: 0 }; c._faixa = { y: -1, o: 0 }; c._fim = { p: 0 }; c._brilho = { p: 0 }; c._brilho2 = { p: 0 };
  c._its = (c.itens || []).map(it => ({ texto: it.texto, t: B.tempo(it.quando ?? it.t), rev: 0, chk: 0, anel: 0, raio: 0, barra: 0, apaga: 0, pulso: 0 }));
  tl.fromTo(c._ent, { p: 0 }, { p: 1, duration: 0.8, ease: 'expo.out' }, 0);
  tl.fromTo(c._ent, { giro: 1 }, { giro: 0, duration: 1.1, ease: 'power3.out' }, 0);   // a placa gira na parede e assenta
  tl.fromTo(c._brilho, { p: 0 }, { p: 1, duration: 1.0, ease: 'power1.inOut' }, 0.25);  // luz especular varre o chanfro
  c._its.forEach((it, i) => {
    if (it.t == null) { B.avisos.push(`checklist: item "${it.texto}" sem âncora na fala`); return; }
    const r = Math.max(0.25, it.t - c.t0);
    tl.to(c._faixa, { y: i, o: 1, duration: 0.5, ease: 'expo.out' }, r - 0.12);
    tl.fromTo(it, { rev: 0 }, { rev: 1, duration: 0.55, ease: 'power3.out' }, r - 0.08);
    tl.fromTo(it, { anel: 0 }, { anel: 1, duration: 0.45, ease: 'back.out(2.2)' }, r + 0.08);
    tl.fromTo(it, { chk: 0 }, { chk: 1, duration: 0.32, ease: 'power2.out' }, r + 0.16);
    tl.fromTo(it, { raio: 0 }, { raio: 1, duration: 0.5, ease: 'power2.out' }, r + 0.12);
    tl.fromTo(it, { pulso: 0 }, { pulso: 1, duration: 0.18, ease: 'power2.out' }, r + 0.1);
    tl.to(it, { pulso: 0.35, duration: 0.7, ease: 'power2.inOut' }, r + 0.28);
    tl.fromTo(it, { barra: 0 }, { barra: 1, duration: 0.6, ease: 'power2.inOut' }, r + 0.05);
    if (i > 0) { tl.to(c._its[i - 1], { apaga: 1, duration: 0.4, ease: 'power2.out' }, r); tl.to(c._its[i - 1], { pulso: 0, duration: 0.4 }, r); }
  });
  const ult = c._ult = Math.max(0, ...c._its.filter(i => i.t != null).map(i => i.t - c.t0));
  tl.fromTo(c._fim, { p: 0 }, { p: 1, duration: 0.8, ease: 'power2.out' }, ult + 0.55);
  tl.fromTo(c._brilho2, { p: 0 }, { p: 1, duration: 0.9, ease: 'power1.inOut' }, ult + 0.6);
  if (c._its.length) { const u = c._its[c._its.length - 1]; tl.to(u, { apaga: 1, pulso: 0, duration: 0.4 }, ult + 0.7); tl.to(c._faixa, { o: 0, duration: 0.4 }, ult + 0.7); }
  const d = c.saida_s ?? 0.45; tl.fromTo(c._sai, { p: 0 }, { p: 1, duration: d, ease: 'power2.in' }, Math.max(ult + 1.2, c.t1 - c.t0 - d));
  return tl;
}

// whoosh na entrada, tique a cada item falado, pop no fechamento
const sons = c => [{ t: c.t0 - 0.12, som: 'whoosh', ganho: 0.7 },
  ...c._its.filter(it => it.t != null).map(it => ({ t: it.t + 0.12, som: 'tique', ganho: 0.9 })),
  ...(c._its.length ? [{ t: c.t0 + c._ult + 0.55, som: 'pop', ganho: 0.6 }] : [])];

// faixa de luz especular diagonal que atravessa um retângulo (p de 0 a 1)
function varre(g, X, Y, w, h, p, forca) {
  if (p <= 0 || p >= 1) return;
  const sx = X - w * 0.4 + (w * 1.8) * p, lg = g.createLinearGradient(sx - w * 0.22, Y, sx + w * 0.22, Y + h);
  lg.addColorStop(0, B.rgba(K.realce, 0)); lg.addColorStop(0.5, B.rgba(K.realce, forca)); lg.addColorStop(1, B.rgba(K.realce, 0));
  g.fillStyle = lg; g.fillRect(X, Y, w, h);
}

// a placa de metal: espessura, face escovada, chanfro com luz no topo e aresta escura embaixo
function placa(g, X, Y, w, h, r, k, esp, c) {
  const { rgba, rr } = B;
  // espessura vista por baixo (a placa sai da parede)
  rr(g, X, Y + esp, w, h, r); const lado = g.createLinearGradient(0, Y + h - r, 0, Y + h + esp);
  lado.addColorStop(0, K.metal_fundo); lado.addColorStop(1, K.metal_aresta); g.fillStyle = lado; g.fill();
  // face
  g.save(); rr(g, X, Y, w, h, r); g.clip();
  const face = g.createLinearGradient(0, Y, 0, Y + h); face.addColorStop(0, K.metal); face.addColorStop(1, K.metal_fundo);
  g.fillStyle = face; g.fillRect(X, Y, w, h);
  // reflexo largo e suave (o metal pega a luz da sala na diagonal)
  const sh = g.createLinearGradient(X, Y, X + w, Y + h);
  sh.addColorStop(0, rgba(K.realce, 0.07)); sh.addColorStop(0.35, rgba(K.realce, 0.015)); sh.addColorStop(0.6, rgba(K.realce, 0.05)); sh.addColorStop(1, rgba(K.realce, 0));
  g.fillStyle = sh; g.fillRect(X, Y, w, h);
  // escovado: riscos horizontais finos (semente fixa)
  const rn = B.rng(19); g.globalAlpha = 1;
  for (let yy = Y; yy < Y + h; yy += 2.2 * k) { const a = 0.012 + rn() * 0.03; g.fillStyle = rgba(rn() > 0.5 ? K.realce : K.metal_aresta, a); g.fillRect(X, yy, w, 1); }
  varre(g, X, Y, w, h, c._brilho.p, 0.16); varre(g, X, Y, w, h, c._brilho2.p, 0.12);
  g.restore();
  // chanfro: luz especular no topo, que morre até a metade, e sombra na base
  g.save(); rr(g, X + 1.2 * k, Y + 1.2 * k, w - 2.4 * k, h - 2.4 * k, r - 1.2 * k); g.lineWidth = 2.4 * k;
  const ch = g.createLinearGradient(0, Y, 0, Y + h);
  ch.addColorStop(0, rgba(K.realce, 0.55)); ch.addColorStop(0.12, rgba(K.realce, 0.16)); ch.addColorStop(0.55, rgba(K.realce, 0.03)); ch.addColorStop(1, rgba(K.metal_aresta, 0.6));
  g.strokeStyle = ch; g.stroke(); g.restore();
  g.save(); rr(g, X + 0.5, Y + 0.5, w - 1, h - 1, r); g.lineWidth = 1; g.strokeStyle = rgba(K.metal_aresta, 0.9); g.stroke(); g.restore();
}

// sulco gravado na placa (trilho, placar, faixa): fundo mais escuro com sombra interna em cima e luz embaixo
function gravado(g, X, Y, w, h, r, k, alfa = 1) {
  const { rgba, rr } = B;
  g.save(); g.globalAlpha *= alfa; rr(g, X, Y, w, h, r); g.fillStyle = rgba(K.gravado, 0.55); g.fill(); g.clip();
  const s = g.createLinearGradient(0, Y, 0, Y + h); s.addColorStop(0, rgba(K.metal_aresta, 0.7)); s.addColorStop(0.4, rgba(K.metal_aresta, 0)); g.fillStyle = s; g.fillRect(X, Y, w, h);
  g.restore();
  g.save(); g.globalAlpha *= alfa; rr(g, X + 0.5, Y + 0.5, w - 1, h - 1, r); g.lineWidth = 1.2 * k;
  const b = g.createLinearGradient(0, Y, 0, Y + h); b.addColorStop(0, rgba(K.metal_aresta, 0.5)); b.addColorStop(1, rgba(K.realce, 0.12)); g.strokeStyle = b; g.stroke(); g.restore();
}

// v1: painel de vidro fosco ("material": "vidro")
function painelVidro(g, X, Y, w, h, r, k, frameLocal) {
  const { rgba, rr } = B;
  g.save(); g.shadowColor = rgba(K.sombra, 0.32); g.shadowBlur = 50 * k; g.shadowOffsetX = -14 * k; g.shadowOffsetY = 24 * k; rr(g, X, Y, w, h, r); g.fillStyle = rgba(K.vidro, 0.01); g.fill(); g.restore();
  B.vidro(g, frameLocal, X, Y, w, h, r, { tinta: K.vidro, alfa: 0.6, brilho: 0.6 });
}

function desenhar({ g, c, t, frame }, b) {
  usa(b, c);
  const { W, H, clamp, rgba, rr } = B;
  B.seek(c, t); const e = c._ent.p, sai = c._sai.p; if (e <= 0 || sai >= 1) return;
  const metal = (c.material || 'metal') !== 'vidro';
  const n = c._its.length, k = c.escala ?? 1.08;
  const w = (c.largura ?? 0.8) * W, rowH = 106 * k, head = 92 * k, pad = 30 * k, h = pad + head + n * rowH + pad * 0.6, r = 38 * k;
  const esp = metal ? 9 * k : 0, m = Math.round(90 * k);
  const cx = (c.x ?? c._cab.cx) * W, base = c.y != null ? c.y * H : c._cab.topo * H + 0.014 * H;
  const X0 = cx - w / 2, Y0 = base - h;
  // tudo é desenhado numa tela local (a placa + margem para sombra e brilho) e depois entortado em perspectiva na parede
  const CW = Math.ceil(w + 2 * m), CH = Math.ceil(h + 2 * m + esp);
  if (!c._cv || c._cv.width !== CW || c._cv.height !== CH) c._cv = new OffscreenCanvas(CW, CH);
  const L = c._cv.getContext('2d'); L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.filter = 'none'; L.clearRect(0, 0, CW, CH);
  const X = m, Y = m;
  // o vidro precisa do quadro-fonte no lugar certo da tela local
  let fr = null;
  if (!metal && frame) { const f = c._fr || (c._fr = new OffscreenCanvas(W, H)), fg = f.getContext('2d'); fg.clearRect(0, 0, W, H); fg.drawImage(frame, -(X0 - m), -(Y0 - m), W, H); fr = f; }
  if (metal) placa(L, X, Y, w, h, r, k, esp, c); else painelVidro(L, X, Y, w, h, r, k, fr);
  const fim = c._fim.p;
  if (fim > 0) { L.save(); rr(L, X + 1, Y + 1, w - 2, h - 2, r); L.lineWidth = 3 * k; L.strokeStyle = K.destaque; L.globalAlpha *= fim * (0.55 + 0.45 * Math.cos((t - c.t0) * 5) ** 2); L.shadowColor = K.destaque; L.shadowBlur = 26 * k; L.stroke(); L.restore(); }
  // cabeçalho: ponto aceso, título em mono e o placar "1 de 3" num sulco
  const feitos = c._its.filter(i => i.chk > 0.5).length;
  B.fMono(L, 25 * k, 0.16); L.textBaseline = 'middle'; L.textAlign = 'left';
  L.save(); L.fillStyle = K.destaque; L.shadowColor = K.destaque; L.shadowBlur = 12 * k; L.beginPath(); L.arc(X + pad + 6 * k, Y + pad + 22 * k, 6 * k, 0, Math.PI * 2); L.fill(); L.restore();
  L.fillStyle = rgba(K.texto, 0.78); L.fillText(String(c.titulo || '').toUpperCase(), X + pad + 24 * k, Y + pad + 23 * k);
  const pl = `${feitos} de ${n}`; B.fMono(L, 25 * k, 0.06); const pw = L.measureText(pl).width + 30 * k, px = X + w - pad - pw, py = Y + pad + 4 * k;
  if (fim > 0.5) { L.save(); rr(L, px, py, pw, 38 * k, 19 * k); L.fillStyle = K.destaque; L.shadowColor = K.destaque; L.shadowBlur = 16 * k; L.fill(); L.restore(); }
  else if (metal) gravado(L, px, py, pw, 38 * k, 19 * k, k); else { rr(L, px, py, pw, 38 * k, 19 * k); L.fillStyle = rgba(K.linha, 0.10); L.fill(); }
  L.fillStyle = fim > 0.5 ? K.sobre_destaque : rgba(K.texto, 0.9); L.textAlign = 'center'; L.fillText(pl, px + pw / 2, Y + pad + 24 * k);
  // trilho de progresso: n gomos gravados que acendem com brilho
  const ty = Y + pad + 60 * k, th = 8 * k, tw = (w - pad * 2 - (n - 1) * 8 * k) / n;
  c._its.forEach((it, i) => {
    const tx = X + pad + i * (tw + 8 * k);
    if (metal) gravado(L, tx, ty, tw, th, th / 2, k); else { rr(L, tx, ty, tw, th, th / 2); L.fillStyle = rgba(K.linha, 0.12); L.fill(); }
    if (it.barra > 0) {
      L.save(); rr(L, tx + 1, ty + 1, (tw - 2) * it.barra, th - 2, (th - 2) / 2); L.fillStyle = K.destaque; L.shadowColor = K.destaque; L.shadowBlur = 14 * k; L.fill(); L.restore();
      L.save(); rr(L, tx + 3 * k, ty + 2 * k, Math.max(0, (tw - 6 * k) * it.barra), 1.6 * k, 1 * k); L.fillStyle = rgba(K.realce, 0.55); L.fill(); L.restore();
    }
  });
  // faixa iluminada que desliza até a linha ativa, com filete na cor de ação à esquerda
  const f0 = Y + pad + head;
  if (c._faixa.o > 0 && c._faixa.y >= 0) {
    const fx = X + pad * 0.55, fy = f0 + c._faixa.y * rowH + 8 * k, fw = w - pad * 1.1, fh = rowH - 16 * k;
    L.save(); L.globalAlpha *= c._faixa.o;
    rr(L, fx, fy, fw, fh, 24 * k); const fg = L.createLinearGradient(fx, 0, fx + fw, 0);
    fg.addColorStop(0, rgba(K.destaque, 0.16)); fg.addColorStop(0.35, rgba(K.realce, metal ? 0.07 : 0.075)); fg.addColorStop(1, rgba(K.realce, 0.03));
    L.fillStyle = fg; L.fill();
    L.save(); rr(L, fx + 0.5, fy + 0.5, fw - 1, fh - 1, 24 * k); L.lineWidth = 1.2 * k; const fb = L.createLinearGradient(0, fy, 0, fy + fh); fb.addColorStop(0, rgba(K.realce, 0.22)); fb.addColorStop(1, rgba(K.realce, 0.02)); L.strokeStyle = fb; L.stroke(); L.restore();
    L.save(); rr(L, fx + 8 * k, fy + fh * 0.22, 5 * k, fh * 0.56, 3 * k); L.fillStyle = K.destaque; L.shadowColor = K.destaque; L.shadowBlur = 14 * k; L.fill(); L.restore();
    L.restore();
  }
  const ativo = Math.round(c._faixa.y);
  c._its.forEach((it, i) => {
    const cy = f0 + i * rowH + rowH / 2, ox = X + pad + 34 * k, R = 22 * k;
    const marcaItem = (r0, gg = L) => { if (T.visto === 'quadrado') { gg.beginPath(); gg.roundRect(ox - r0, cy - r0, r0 * 2, r0 * 2, r0 * 0.28 * T.raio); } else { gg.beginPath(); gg.arc(ox, cy, r0, 0, Math.PI * 2); } };
    // marca vazia: anel gravado na placa
    L.save();
    if (metal) { marcaItem(R); L.fillStyle = rgba(K.gravado, 0.45); L.fill(); L.lineWidth = 2.2 * k; const ag = L.createLinearGradient(0, cy - R, 0, cy + R); ag.addColorStop(0, rgba(K.metal_aresta, 0.9)); ag.addColorStop(1, rgba(K.realce, 0.28)); L.strokeStyle = ag; L.stroke(); }
    else { L.lineWidth = 2.5 * k; L.strokeStyle = rgba(K.texto, 0.32); marcaItem(R); L.stroke(); }
    if (it.anel > 0) {
      const s = it.anel;
      // brilho que pulsa na hora do tique (halo na cor de ação)
      if (it.pulso > 0) { L.save(); const hr = R * (1.4 + 0.9 * it.pulso), hg = L.createRadialGradient(ox, cy, R * 0.6, ox, cy, hr); hg.addColorStop(0, rgba(K.destaque, 0.55 * it.pulso)); hg.addColorStop(1, rgba(K.destaque, 0)); L.fillStyle = hg; L.beginPath(); L.arc(ox, cy, hr, 0, Math.PI * 2); L.fill(); L.restore(); }
      const dg = L.createRadialGradient(ox - R * 0.35, cy - R * 0.45, R * 0.1, ox, cy, R * 1.05);
      dg.addColorStop(0, K.destaque_claro); dg.addColorStop(0.55, K.destaque); dg.addColorStop(1, K.destaque);
      L.save(); L.shadowColor = rgba(K.destaque, 0.8); L.shadowBlur = (8 + 18 * it.pulso) * k; L.fillStyle = dg; marcaItem(R * s); L.fill(); L.restore();
      // ponto especular no ícone
      L.save(); L.globalAlpha *= 0.55 * s; marcaItem(R * s); L.clip(); const sp = L.createRadialGradient(ox - R * 0.4, cy - R * 0.55, 0, ox - R * 0.4, cy - R * 0.55, R * 0.7); sp.addColorStop(0, rgba(K.realce, 0.9)); sp.addColorStop(1, rgba(K.realce, 0)); L.fillStyle = sp; L.fillRect(ox - R, cy - R, R * 2, R * 2); L.restore();
      if (it.raio > 0 && it.raio < 1) { L.strokeStyle = K.destaque; L.lineWidth = 3 * k; L.lineCap = 'round'; L.globalAlpha *= 1 - it.raio; for (let q = 0; q < 10; q++) { const a = q * Math.PI / 5 + 0.3, r0 = R * (1.3 + it.raio * 0.6), r1 = R * (1.5 + it.raio * 1.2); L.beginPath(); L.moveTo(ox + Math.cos(a) * r0, cy + Math.sin(a) * r0); L.lineTo(ox + Math.cos(a) * r1, cy + Math.sin(a) * r1); L.stroke(); } L.globalAlpha = 1; }
      if (it.chk > 0) {   // visto como traço: comprimento proporcional ao progresso
        const pts = [[-0.42, 0.02], [-0.12, 0.32], [0.45, -0.3]].map(([a, bq]) => [ox + a * R * 1.05, cy + bq * R * 1.05]);
        const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]), Lt = (l1 + l2) * it.chk;
        L.strokeStyle = K.sobre_destaque; L.lineWidth = 4.8 * k * T.traco; L.lineCap = 'round'; L.lineJoin = 'round'; L.beginPath(); L.moveTo(...pts[0]);
        if (Lt <= l1) L.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * Lt / l1, pts[0][1] + (pts[1][1] - pts[0][1]) * Lt / l1);
        else { L.lineTo(...pts[1]); const q = (Lt - l1) / l2; L.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * q, pts[1][1] + (pts[2][1] - pts[1][1]) * q); }
        L.stroke();
      }
    }
    L.restore();
    // texto: sulco-esqueleto até ser falado; depois revela da esquerda. Linha ativa na cor de ação, as anteriores assentam.
    const tx = ox + R + 30 * k;
    if (it.rev < 1) { const sw = (w - pad * 2) * (0.42 - 0.08 * (i % 2)); if (metal) gravado(L, tx, cy - 7 * k, sw, 14 * k, 7 * k, k, 1 - it.rev); else { L.save(); L.globalAlpha *= 1 - it.rev; rr(L, tx, cy - 7 * k, sw, 14 * k, 7 * k); L.fillStyle = rgba(K.linha, 0.10); L.fill(); L.restore(); } }
    if (it.rev > 0) {
      B.fCorpo(L, 46 * k, true, -0.01); L.textAlign = 'left'; L.textBaseline = 'middle';
      const tw2 = L.measureText(it.texto).width, eAtivo = i === ativo && c._faixa.o > 0.5 && it.apaga < 0.5;
      L.save(); L.beginPath(); L.rect(tx - 4, cy - rowH / 2, (tw2 + 12) * it.rev, rowH); L.clip();
      L.globalAlpha *= 1 - 0.3 * it.apaga;
      L.shadowColor = rgba(K.metal_aresta, metal ? 0.6 : 0); L.shadowOffsetY = 1.5 * k; L.shadowBlur = 2 * k;
      L.fillStyle = eAtivo ? K.destaque : K.texto; L.fillText(it.texto, tx + (1 - it.rev) * 22 * k, cy + 2 * k); L.restore();
    }
  });
  // ---- assenta na parede: sombra de contato + perspectiva (faixas verticais com altura variando = giro em Y)
  const DX = X0 - m, DY = Y0 - m;
  g.save();
  const alfa = clamp(e * 1.3) * (1 - sai); g.globalAlpha = alfa;
  const subir = (1 - e) * 50 * k + sai * 40 * k;
  if (metal) {   // sombra: escura e curta colada na base + larga e suave (a luz da janela vem da direita)
    g.save(); g.filter = `blur(${22 * k}px)`; g.fillStyle = rgba(K.sombra_funda, 0.5); rr(g, X0 + 10 * k - 10 * k, Y0 + 26 * k - subir, w, h, r); g.fill(); g.restore();
    g.save(); g.filter = `blur(${6 * k}px)`; g.fillStyle = rgba(K.sombra_funda, 0.55); rr(g, X0 + 6 * k, Y0 + h - 10 * k + esp - subir, w - 12 * k, 18 * k, 9 * k); g.fill(); g.restore();
  }
  if (e < 0.98) g.filter = `blur(${(1 - e) * 14}px)`;
  const pers = (c.perspectiva ?? 0.07) + 0.28 * c._ent.giro, N = 72;
  for (let i = 0; i < N; i++) {
    const u0 = i / N, u1 = (i + 1) / N, sx = u0 * CW, sw = (u1 - u0) * CW + 1;
    const um = (u0 + u1) / 2, s = 1 + pers * (0.5 - um) * 2 * 0.5;   // lado esquerdo mais perto, direito mais longe
    const dw = CW * (1 - pers * 0.35), dx = DX + CW * pers * 0.175 + sx * (dw / CW);
    const dh = CH * s, dy = DY + (CH - dh) / 2 - subir;
    g.drawImage(c._cv, sx, 0, sw, CH, dx, dy, sw * (dw / CW) + 0.6, dh);
  }
  g.restore();
}

export default { tipo: 'checklist', camada: 'parede', mascara: true, quadro: true, timeline, sons, desenhar };
