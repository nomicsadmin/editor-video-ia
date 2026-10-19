// EFEITO NATIVO · hodometro · criado do zero pela Nomics em 12/Out/2026.
// Hodômetro mecânico na parede, atrás da cabeça: tambores de dígito girando até o número dito.
// (o nome "contador" já é do componente de motion em motion.js: número serifado contando)
// { "tipo": "hodometro", "quando": "33", "ate": "...", "valor": 33000, "separador": ".", "rotulo": "estrelas no GitHub",
//   "giro_s": 1.8, "prefixo": "", "sufixo": "", "escala": 1, "x": 0.5, "y": null (padrão: base logo abaixo do topo da cabeça) }
let B, T, K, F;
const usa = (b, c) => { B = b; ({ T, K, F } = b.usa(c)); };

function timeline(c, b) {
  usa(b, c);
  const alvo = String(Math.round(c.valor ?? 0)).split('').map(Number);
  const n = alvo.length, giro = c.giro_s ?? 1.8, tl = c._tl = B.linha();
  c._rodas = alvo.map(() => ({ v: 0 })); c._ent = { p: 0 }; c._fim = { p: 0 }; c._sai = { p: 0 };
  tl.fromTo(c._ent, { p: 0 }, { p: 1, duration: 0.75, ease: 'expo.out' }, 0);
  c._pouso = [];
  alvo.forEach((d, i) => {
    // a roda da esquerda pousa primeiro (o número se lê da esquerda para a direita); a da direita gira mais voltas
    const ini = 0.12, fim = ini + giro * (0.5 + 0.5 * (n === 1 ? 1 : i / (n - 1)));
    const voltas = 1 + i + (c.voltas_extra ?? 1);
    tl.fromTo(c._rodas[i], { v: 0 }, { v: voltas * 10 + d, duration: fim - ini, ease: 'power4.out' }, ini);
    c._pouso.push(fim);
  });
  const ult = c._ult = Math.max(...c._pouso);
  tl.fromTo(c._fim, { p: 0 }, { p: 1, duration: 0.7, ease: 'power3.out' }, ult - 0.05);
  const d = c.saida_s ?? 0.45; tl.fromTo(c._sai, { p: 0 }, { p: 1, duration: d, ease: 'power2.in' }, Math.max(ult + 0.6, c.t1 - c.t0 - d));
  c._alvo = alvo;
  return tl;
}

// tique quando cada tambor pousa e pop no fechamento
const sons = c => [...c._pouso.map(f => ({ t: c.t0 + f - 0.02, som: 'tique', ganho: 0.8 })), { t: c.t0 + c._ult, som: 'pop', ganho: 0.8 }];

// um tambor: os dígitos estão num cilindro que gira para cima (o próximo número vem de baixo)
function tambor(g, v, X, Y, w, h, tam, borrao) {
  const base = Math.floor(v), fr = v - base, ang = 0.98, R = h * 0.6;
  g.save(); B.rr(g, X, Y, w, h, 14); g.clip();
  const fundo = g.createLinearGradient(X, Y, X, Y + h); fundo.addColorStop(0, K.tambor_borda); fundo.addColorStop(0.5, K.tambor); fundo.addColorStop(1, K.tambor_borda);
  g.fillStyle = fundo; g.fillRect(X, Y, w, h);
  const amostras = Math.max(1, Math.min(7, Math.round(Math.abs(borrao) * 0.55)));
  g.textAlign = 'center'; g.textBaseline = 'middle'; B.fMono(g, tam, -0.02);
  for (let s = 0; s < amostras; s++) {
    const dv = amostras > 1 ? (s / (amostras - 1) - 0.5) * Math.min(0.9, Math.abs(borrao) * 0.05) * Math.sign(borrao) : 0;
    for (let j = -2; j <= 2; j++) {
      const off = j - fr - dv, a = off * ang; if (Math.abs(a) >= Math.PI / 2) continue;
      const dig = (((base + j) % 10) + 10) % 10, cy = Y + h / 2 + R * Math.sin(a), sy = Math.cos(a);
      g.save(); g.globalAlpha = Math.pow(sy, 1.6) / amostras * (amostras > 1 ? 1.35 : 1); g.translate(X + w / 2, cy); g.scale(1, sy);
      g.fillStyle = K.texto; g.fillText(String(dig), 0, tam * 0.04); g.restore();
    }
  }
  // sombra do cilindro (em cima e embaixo) e o fio de luz no meio do tambor
  const sh = g.createLinearGradient(X, Y, X, Y + h);
  sh.addColorStop(0, B.rgba(K.cilindro, 0.95)); sh.addColorStop(0.3, B.rgba(K.cilindro, 0)); sh.addColorStop(0.7, B.rgba(K.cilindro, 0)); sh.addColorStop(1, B.rgba(K.cilindro, 0.95));
  g.fillStyle = sh; g.fillRect(X, Y, w, h);
  g.fillStyle = B.rgba(K.realce, 0.05); g.fillRect(X, Y + h * 0.5 - 1, w, 2);
  g.restore();
}

function desenhar({ g, c, t }, b) {
  usa(b, c);
  const { W, H, clamp, rgba } = B;
  B.seek(c, t); const vs = c._rodas.map(r => r.v);
  B.seek(c, t - 1 / 60); const ant = c._rodas.map(r => r.v); B.seek(c, t);
  const e = c._ent.p, sai = c._sai.p; if (e <= 0 || sai >= 1) return;
  const k = (c.escala ?? 1.22), tam = 122 * k, cw = 118 * k, ch = 172 * k, gap = 10 * k, sepW = 34 * k, pad = 22 * k;
  const n = c._alvo.length, sep = c.separador ?? '.', grupos = [];
  for (let i = 0; i < n; i++) grupos.push(i > 0 && (n - i) % 3 === 0 && sep ? 'sep' : null);
  const larg = n * cw + (n - 1) * gap + grupos.filter(Boolean).length * (sepW - gap * 0) + pad * 2;
  const alt = ch + pad * 2;
  const cx = (c.x ?? c._cab.cx) * W;
  const base = c.y != null ? c.y * H : c._cab.topo * H + (c.mergulho ?? 0.03) * H;  // a base fica atrás do cabelo
  const X0 = cx - larg / 2, Y0 = base - alt;
  g.save();
  g.globalAlpha = clamp(e * 1.4) * (1 - sai);
  const s = 0.94 + 0.06 * e; g.translate(cx, Y0 + alt / 2 + (1 - e) * 46 * k - sai * 40 * k); g.scale(s, s); g.translate(-cx, -(Y0 + alt / 2));
  if (e < 0.98) g.filter = `blur(${(1 - e) * 14}px)`;
  // caixa: corpo escuro com sombra na parede (a janela fica à direita: a sombra cai para a esquerda e para baixo)
  g.save(); g.shadowColor = rgba(K.sombra, 0.38); g.shadowBlur = 46 * k; g.shadowOffsetX = -12 * k; g.shadowOffsetY = 22 * k;
  B.rr(g, X0, Y0, larg, alt, 30 * k); const corpo = g.createLinearGradient(X0, Y0, X0, Y0 + alt); corpo.addColorStop(0, K.superficie); corpo.addColorStop(1, K.superficie_funda);
  g.fillStyle = corpo; g.fill(); g.restore();
  B.rr(g, X0 + 1, Y0 + 1, larg - 2, alt - 2, 29 * k); g.lineWidth = 2; const bd = g.createLinearGradient(X0, Y0, X0, Y0 + alt); bd.addColorStop(0, rgba(K.borda, 0.20)); bd.addColorStop(1, rgba(K.borda, 0.04)); g.strokeStyle = bd; g.stroke();
  let X = X0 + pad;
  for (let i = 0; i < n; i++) {
    if (grupos[i]) { g.fillStyle = K.texto; g.beginPath(); g.arc(X + sepW / 2 - gap / 2, Y0 + pad + ch * 0.74, 7 * k, 0, Math.PI * 2); g.fill(); X += sepW; }
    const pousou = t - c.t0 - c._pouso[i];
    const bal = pousou > 0 ? 0.085 * Math.exp(-pousou * 13) * Math.sin(pousou * 40) : 0;   // o tambor trava no dente e assenta
    tambor(g, vs[i] - bal, X, Y0 + pad, cw, ch, tam, (vs[i] - ant[i]) * 60 / 10);
    X += cw + gap;
  }
  // reflexo do vidro por cima dos tambores
  g.save(); B.rr(g, X0, Y0, larg, alt, 30 * k); g.clip(); const rf = g.createLinearGradient(X0, Y0, X0 + larg * 0.5, Y0 + alt);
  rf.addColorStop(0, rgba(K.realce, 0.09)); rf.addColorStop(0.45, rgba(K.realce, 0.02)); rf.addColorStop(0.46, rgba(K.realce, 0)); g.fillStyle = rf; g.fillRect(X0, Y0, larg, alt); g.restore();
  // fio na cor de ação que acende quando o último tambor pousa + rótulo acima da caixa
  const f = c._fim.p;
  if (f > 0) {
    g.save(); g.shadowColor = K.destaque; g.shadowBlur = 18 * k * (1 - f * 0.6); g.fillStyle = K.destaque;
    g.fillRect(cx - (larg - 60 * k) / 2 * f, Y0 + alt - 5 * k, (larg - 60 * k) * f, 3 * k); g.restore();
  }
  if (c.rotulo) {
    g.filter = 'none'; B.fMono(g, 32 * k, 0.16); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const txt = c.caixa_rotulo === 'original' ? String(c.rotulo) : String(c.rotulo).toUpperCase(), pr = B.eOut(B.seg(t - c.t0, 0.25, 0.85));
    const tw = g.measureText(txt).width;
    g.save(); g.globalAlpha *= pr; g.shadowColor = rgba(K.sombra, 0.35); g.shadowBlur = 16;
    g.fillStyle = K.texto_forte; g.fillText(txt, cx + 14 * k, Y0 - 26 * k + (1 - pr) * 14);
    g.fillStyle = K.destaque; g.beginPath(); g.arc(cx - tw / 2 - 6 * k, Y0 - 26 * k - 10 * k + (1 - pr) * 14, 7 * k, 0, Math.PI * 2); g.fill(); g.restore();
  }
  if (c.prefixo || c.sufixo) {
    B.fTitulo(g, 96 * k); g.textBaseline = 'middle'; g.fillStyle = K.destaque;
    if (c.prefixo) { g.textAlign = 'right'; g.fillText(c.prefixo, X0 - 16 * k, Y0 + alt / 2); }
    if (c.sufixo) { g.textAlign = 'left'; g.fillText(c.sufixo, X0 + larg + 16 * k, Y0 + alt / 2); }
  }
  g.restore();
}

export default { tipo: 'hodometro', camada: 'parede', mascara: true, quadro: false, timeline, sons, desenhar };
