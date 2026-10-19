// EFEITO NATIVO · comentario (CTA) · criado do zero pela Nomics em 12/Out/2026 (refino no mesmo dia: foto de perfil).
// O comentário com a palavra-chave se digita, é publicado e a resposta com o link chega.
// "avatar" = a FOTO DE PERFIL de quem responde (jpg no projeto; ex. o avatar.jpg dos carrosséis do Instagram). Sem foto,
// a bolinha mostra as iniciais de "nome" na segunda cor da marca. "avatar_comentario": "perfil" põe a mesma foto também
// na bolinha de quem comenta (padrão: silhueta genérica, que é o espectador).
// { "tipo": "comentario", "quando": "comenta#1", "ate_fim": "Recordly#2", "palavra": "IA", "digita_em": "IA",
//   "resposta_em": "link", "nome": "Vinicius Parizotto", "resposta": "Te mandei o link no direct", "botao": "Abrir link",
//   "avatar": "assets/perfil.jpg", "avatar_comentario": "silhueta", "y": 0.2 }
let B, T, K, F;
const usa = (b, c) => { B = b; ({ T, K, F } = b.usa(c)); };

function timeline(c, b) {
  usa(b, c);
  const tl = c._tl = B.linha();
  const td = B.tempo(c.digita_em || c.palavra) ?? c.t0 + 0.6, tr = B.tempo(c.resposta_em) ?? td + 1.2;
  const r = v => Math.max(0, v - c.t0), letras = [...String(c.palavra || 'IA')];
  c._ent = { p: 0 }; c._foco = { p: 0 }; c._dig = { n: 0 }; c._env = { p: 0, aperta: 0 }; c._pub = { p: 0 }; c._cor = { p: 0, raio: 0 };
  c._fio = { p: 0 }; c._pts = { p: 0 }; c._resp = { p: 0 }; c._chip = { p: 0, brilho: 0 }; c._sai = { p: 0 };
  tl.fromTo(c._ent, { p: 0 }, { p: 1, duration: 0.6, ease: 'expo.out' }, 0);
  tl.fromTo(c._foco, { p: 0 }, { p: 1, duration: 0.3, ease: 'power2.out' }, Math.max(0.25, r(td) - 0.35));
  const passo = c.passo_letra ?? 0.09;
  tl.fromTo(c._dig, { n: 0 }, { n: letras.length, duration: passo * letras.length, ease: `steps(${letras.length})` }, r(td));
  const tEnv = r(td) + passo * letras.length + 0.22;
  tl.fromTo(c._env, { aperta: 0 }, { aperta: 1, duration: 0.12, ease: 'power2.in', yoyo: true, repeat: 1 }, tEnv);
  tl.fromTo(c._pub, { p: 0 }, { p: 1, duration: 0.55, ease: 'expo.inOut' }, tEnv + 0.16);
  tl.fromTo(c._cor, { p: 0 }, { p: 1, duration: 0.42, ease: 'back.out(3)' }, tEnv + 0.62);
  tl.fromTo(c._cor, { raio: 0 }, { raio: 1, duration: 0.5, ease: 'power2.out' }, tEnv + 0.66);
  const tR = Math.max(r(tr) - 0.1, tEnv + 0.75);
  tl.fromTo(c._fio, { p: 0 }, { p: 1, duration: 0.35, ease: 'power2.out' }, tR - 0.45);
  tl.fromTo(c._pts, { p: 0 }, { p: 1, duration: 0.25, ease: 'power2.out' }, tR - 0.3);
  tl.fromTo(c._resp, { p: 0 }, { p: 1, duration: 0.55, ease: 'expo.out' }, tR);
  tl.fromTo(c._chip, { p: 0 }, { p: 1, duration: 0.5, ease: 'back.out(2)' }, tR + 0.38);
  tl.fromTo(c._chip, { brilho: 0 }, { brilho: 1, duration: 0.7, ease: 'power1.inOut' }, tR + 0.75);
  const d = c.saida_s ?? 0.4; tl.fromTo(c._sai, { p: 0 }, { p: 1, duration: d, ease: 'power2.in' }, Math.max(tR + 1.0, c.t1 - c.t0 - d));
  c._letras = letras; c._td = td; c._passo = passo; c._tEnv = tEnv; c._tR = tR;
  return tl;
}

// tique por letra digitada, whoosh ao publicar, pop do coração, clique da resposta, pop do botão
const sons = c => [...c._letras.map((_, i) => ({ t: c._td + i * c._passo + 0.01, som: 'tique', ganho: 0.7 })),
  { t: c.t0 + c._tEnv + 0.16, som: 'whoosh', ganho: 0.55 }, { t: c.t0 + c._tEnv + 0.62, som: 'pop', ganho: 0.7 },
  { t: c.t0 + c._tR, som: 'clique', ganho: 0.8 }, { t: c.t0 + c._tR + 0.38, som: 'pop', ganho: 0.55 }];

// foto redonda (recorte quadrado central) ou as iniciais do nome, com anel na cor de ação
function fotoRedonda(g, c, X, Y, R, k, anel = true) {
  g.save(); g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); g.clip();
  if (c.avBmp) { const b = c.avBmp, s = Math.min(b.width, b.height); g.drawImage(b, (b.width - s) / 2, (b.height - s) / 2, s, s, X - R, Y - R, R * 2, R * 2); }
  else {
    g.fillStyle = K.destaque2; g.fillRect(X - R, Y - R, R * 2, R * 2);
    const ini = String(c.nome || '').split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    B.fCorpo(g, R * 0.85, true); g.fillStyle = K.texto_forte; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ini, X, Y + R * 0.04);
  }
  g.restore();
  if (anel) { g.save(); g.beginPath(); g.arc(X, Y, R + 3 * k, 0, Math.PI * 2); g.strokeStyle = K.destaque; g.lineWidth = 3 * k; g.stroke(); g.restore(); }
}

function avatarVoce(g, X, Y, R, c, k) {   // quem comenta: silhueta genérica (o espectador) ou a foto ("avatar_comentario": "perfil")
  if (c && c.avatar_comentario === 'perfil') { fotoRedonda(g, c, X, Y, R, k, false); return; }
  g.save(); g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); const gr = g.createLinearGradient(X - R, Y - R, X + R, Y + R); gr.addColorStop(0, K.avatar); gr.addColorStop(1, K.avatar2); g.fillStyle = gr; g.fill(); g.clip();
  g.fillStyle = B.rgba(K.texto, 0.78); g.beginPath(); g.arc(X, Y - R * 0.18, R * 0.36, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(X, Y + R * 0.78, R * 0.66, R * 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
}
function coracao(g, X, Y, s) { g.beginPath(); g.moveTo(X, Y + s * 0.35); g.bezierCurveTo(X - s * 1.1, Y - s * 0.35, X - s * 0.45, Y - s * 1.05, X, Y - s * 0.45); g.bezierCurveTo(X + s * 0.45, Y - s * 1.05, X + s * 1.1, Y - s * 0.35, X, Y + s * 0.35); g.closePath(); }

function desenhar({ g: x, c, t }, b) {
  usa(b, c);
  const { W, H, clamp, rgba, rr } = B;
  B.seek(c, t); const e = c._ent.p, sai = c._sai.p; if (e <= 0 || sai >= 1) return;
  const k = c.escala ?? 1.1, cx = (c.x ?? 0.5) * W, Y = (c.y ?? 0.24) * H;
  // fundo do vidro: o próprio quadro já desenhado (vídeo + cenas) copiado antes de pintar o comentário
  const sn = B.gsnap(); B.reset(sn); sn.drawImage(x.canvas, 0, 0);
  const g = x; g.save();
  g.globalAlpha = clamp(e * 1.3) * (1 - sai); g.translate(0, (1 - e) * -40 * k - sai * 30 * k);
  if (e < 0.98) g.filter = `blur(${(1 - e) * 12}px)`;
  const pub = c._pub.p, n = Math.round(c._dig.n), txt = c._letras.slice(0, n).join('');
  // depois de publicar, a conversa inteira (comentário + resposta) se centraliza na tela
  B.fCorpo(g, 40 * k); const twR = g.measureText(c.resposta || '').width;
  B.fCorpo(g, 30 * k, true); const bwR = g.measureText(c.botao || 'Abrir link').width + 96 * k;
  const dirR = (cx - 410 * k * 1.0) + 26 * k + 64 * k + 44 * k + 60 * k + 12 * k + 30 * k + twR + 22 * k + bwR + 22 * k;
  g.translate((cx - ((cx - 410 * k) + dirR) / 2) * pub, 0);
  // barra de comentário (antes de publicar) → bolha do comentário (depois): a mesma forma se transformando
  const wBarra = 820 * k, hBarra = 108 * k;
  B.fCorpo(g, 54 * k, false, 0); const wTxt = g.measureText(c._letras.join('')).width;
  const wBolha = 120 * k + Math.max(wTxt, 90 * k) + 70 * k, hBolha = 124 * k;
  const w = wBarra + (wBolha - wBarra) * pub, h = hBarra + (hBolha - hBarra) * pub;
  const Xb = cx - wBarra / 2, Yb = Y - hBarra / 2;   // ancorada à esquerda: ao publicar, encolhe para a esquerda
  const R = h / 2 - (h / 2 - 34 * k) * pub;
  g.save(); g.shadowColor = rgba(K.sombra_funda, 0.45); g.shadowBlur = 40 * k; g.shadowOffsetY = 16 * k; rr(g, Xb, Yb, w, h, R); g.fillStyle = 'rgba(0,0,0,0.01)'; g.fill(); g.restore();
  B.vidro(g, sn.canvas, Xb, Yb, w, h, R, { tinta: K.vidro2, alfa: 0.66, brilho: 0.5, desfoque: 22 });
  const foco = c._foco.p * (1 - pub);
  if (foco > 0) { g.save(); rr(g, Xb + 1, Yb + 1, w - 2, h - 2, R); g.lineWidth = 3 * k; g.strokeStyle = K.destaque; g.globalAlpha *= foco; g.shadowColor = K.destaque; g.shadowBlur = 20 * k; g.stroke(); g.restore(); }
  const av = 32 * k, ax = Xb + 26 * k + av, ay = Yb + h / 2;
  avatarVoce(g, ax, ay, av, c, k);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  const tx = ax + av + 26 * k;
  if (pub < 0.5) {
    g.save(); g.globalAlpha *= 1 - pub * 2;
    if (!txt) { B.fCorpo(g, 40 * k); g.fillStyle = rgba(K.texto, 0.42); g.fillText(c.placeholder || 'Adicione um comentário', tx, ay + 2 * k); }
    else { B.fCorpo(g, 54 * k); g.fillStyle = K.texto_forte; g.fillText(txt, tx, ay + 3 * k); }
    if (c._foco.p > 0.5) {   // cursor piscando (fase pelo tempo do quadro: determinístico)
      B.fCorpo(g, 54 * k); const cxr = tx + (txt ? g.measureText(txt).width + 6 * k : 0);
      if (Math.floor((t - c.t0) * 2.4) % 2 === 0 || n > 0) { g.fillStyle = K.destaque; g.fillRect(cxr, ay - 26 * k, 3 * k, 52 * k); }
    }
    // botão de enviar
    const bx = Xb + w - 26 * k - 34 * k, cheio = n > 0 ? 1 : 0, ap = 1 - 0.12 * c._env.aperta;
    g.save(); g.translate(bx, ay); g.scale(ap, ap); g.beginPath(); g.arc(0, 0, 34 * k, 0, Math.PI * 2); g.fillStyle = cheio ? K.destaque : rgba(K.linha, 0.12); g.fill();
    g.strokeStyle = cheio ? K.sobre_destaque : rgba(K.texto, 0.7); g.lineWidth = 4 * k * T.traco; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, 13 * k); g.lineTo(0, -13 * k); g.moveTo(-11 * k, -2 * k); g.lineTo(0, -13 * k); g.lineTo(11 * k, -2 * k); g.stroke(); g.restore();
    g.restore();
  }
  if (pub > 0.5) {   // comentário publicado: "você" em mono e a palavra grande
    const q = (pub - 0.5) * 2; g.save(); g.globalAlpha *= q;
    B.fMono(g, 22 * k, 0.14); g.fillStyle = rgba(K.texto, 0.55); g.fillText('VOCÊ', tx, ay - 26 * k);
    B.fCorpo(g, 54 * k); g.fillStyle = K.texto_forte; g.fillText(c._letras.join(''), tx, ay + 16 * k);
    g.restore();
  }
  // coração que salta na borda da bolha
  if (c._cor.p > 0) {
    const hx = Xb + w - 6 * k, hy = Yb + 8 * k, s = 20 * k * c._cor.p;
    g.save(); g.beginPath(); g.arc(hx, hy, 26 * k * c._cor.p, 0, Math.PI * 2); g.fillStyle = K.selo; g.fill();
    coracao(g, hx, hy + 4 * k, s * 0.75); g.fillStyle = K.destaque; g.fill();
    if (c._cor.raio < 1) { g.strokeStyle = K.destaque; g.lineWidth = 3 * k; g.lineCap = 'round'; g.globalAlpha *= 1 - c._cor.raio; for (let q = 0; q < 6; q++) { const a = q * Math.PI / 3, r0 = 34 * k + c._cor.raio * 10 * k, r1 = r0 + 16 * k; g.beginPath(); g.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); g.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); g.stroke(); } }
    g.restore();
  }
  // fio da conversa: do avatar de quem comentou até a resposta
  const ry = Yb + hBolha + 96 * k, rx = ax + 44 * k;
  if (c._fio.p > 0) {
    g.save(); g.strokeStyle = rgba(K.texto, 0.45); g.lineWidth = 3 * k; g.lineCap = 'round';
    const L0 = ry - (ay + av + 10 * k), L1 = 30 * k, Lt = (L0 + L1) * c._fio.p;
    g.beginPath(); g.moveTo(ax, ay + av + 10 * k); g.lineTo(ax, ay + av + 10 * k + Math.min(L0 - 16 * k, Lt));
    if (Lt > L0 - 16 * k) g.quadraticCurveTo(ax, ry, ax + Math.min(16 * k + (Lt - L0), L1), ry);
    g.stroke(); g.restore();
  }
  const resp = c._resp.p, rav = 34 * k;
  if (c._pts.p > 0 && resp < 1) {   // "digitando…": três pontos que respiram
    g.save(); g.globalAlpha *= c._pts.p * (1 - resp); rr(g, rx + rav * 2 + 18 * k, ry - 30 * k, 120 * k, 60 * k, 30 * k); g.fillStyle = rgba(K.vidro2, 0.8); g.fill();
    for (let q = 0; q < 3; q++) { const b = Math.sin((t - c.t0) * 9 - q * 0.9) * 0.5 + 0.5; g.fillStyle = rgba(K.texto, 0.35 + 0.55 * b); g.beginPath(); g.arc(rx + rav * 2 + 50 * k + q * 28 * k, ry - 4 * k * b, 8 * k, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  if (resp > 0) {
    g.save(); g.globalAlpha *= clamp(resp * 1.4); g.translate(0, (1 - resp) * 26 * k);
    B.fCorpo(g, 40 * k); const tw = g.measureText(c.resposta || '').width;
    B.fCorpo(g, 30 * k, true); const bt = c.botao || 'Abrir link', bw = g.measureText(bt).width + 96 * k;
    const wr = 30 * k + tw + 22 * k + bw + 22 * k, hr = 132 * k, Xr = rx + rav * 2 + 12 * k, Yr = ry - hr / 2, ly = Yr + 88 * k;
    B.vidro(g, sn.canvas, Xr, Yr, wr, hr, 34 * k, { tinta: K.vidro2, alfa: 0.66, brilho: 0.5, desfoque: 22 });
    // foto de perfil de quem responde, com anel na cor de ação (sem foto: as iniciais)
    fotoRedonda(g, c, rx + rav, ry, rav, k);
    B.fMono(g, 22 * k, 0.12); g.fillStyle = rgba(K.texto, 0.55); g.textAlign = 'left'; g.fillText(String(c.nome || '').toUpperCase(), Xr + 30 * k, Yr + 36 * k);
    B.fCorpo(g, 40 * k); g.fillStyle = K.texto_forte; g.fillText(c.resposta || '', Xr + 30 * k, ly);
    // botão do link
    const ch = c._chip.p;
    if (ch > 0) {
      const bx = Xr + 30 * k + tw + 22 * k, bh = 60 * k, by = ly - bh / 2;
      g.save(); g.translate(bx + bw / 2, ly); g.scale(0.6 + 0.4 * ch, 0.6 + 0.4 * ch); g.translate(-(bx + bw / 2), -ly); g.globalAlpha *= clamp(ch * 1.5);
      rr(g, bx, by, bw, bh, bh / 2); g.fillStyle = K.destaque; g.fill();
      if (c._chip.brilho > 0 && c._chip.brilho < 1) { g.save(); rr(g, bx, by, bw, bh, bh / 2); g.clip(); const sx0 = bx - 80 * k + (bw + 160 * k) * c._chip.brilho; const lg = g.createLinearGradient(sx0 - 60 * k, 0, sx0 + 60 * k, 0); lg.addColorStop(0, rgba(K.realce, 0)); lg.addColorStop(0.5, rgba(K.realce, 0.55)); lg.addColorStop(1, rgba(K.realce, 0)); g.fillStyle = lg; g.fillRect(bx, by, bw, bh); g.restore(); }
      // ícone de elo de corrente: dois anéis inclinados
      g.save(); g.translate(bx + 36 * k, ly); g.rotate(-Math.PI / 4); g.strokeStyle = K.sobre_destaque; g.lineWidth = 3.6 * k * T.traco; rr(g, -15 * k, -7 * k, 17 * k, 14 * k, 7 * k); g.stroke(); rr(g, -2 * k, -7 * k, 17 * k, 14 * k, 7 * k); g.stroke(); g.restore();
      B.fCorpo(g, 30 * k, true); g.fillStyle = K.sobre_destaque; g.fillText(bt, bx + 64 * k, ly + 2 * k);
      g.restore();
    }
    g.restore();
  }
  g.restore();
}

export default { tipo: 'comentario', camada: 'frente', mascara: false, quadro: false, timeline, sons, desenhar };
