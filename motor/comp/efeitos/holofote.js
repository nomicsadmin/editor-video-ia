// EFEITO NATIVO · holofote · criado do zero pela Nomics em 12/Out/2026 (refino v2 no mesmo dia: luz física).
// A sala apaga, a pessoa fica acesa sob um facho de luz e as palavras grandes entram atrás dela.
// v2 ("o dele está mais real", Vinicius 12/Out): nada de preto CGI. A sala continua lá e escurece de forma física:
//   · o quadro é MULTIPLICADO por um mapa de luz: luz ambiente fraca e levemente fria (cores.sombra_fria) + a poça do
//     facho caindo pelo inverso do quadrado a partir de um ponto acima da cabeça (I = 1 / (1 + (d/R)²));
//   · a sala perde um pouco de foco (profundidade), o grão volta por cima do escuro e a vinheta fecha as bordas;
//   · a pessoa recebe a mesma luz vinda de cima: rosto aceso, corpo caindo para a sombra, contorno quente por trás.
// "fonte_estilo": "referencia" troca as palavras para grotesca preta em caixa baixa (fontes.display_ref, Inter Tight 900),
// cheias, sem degradê: a primeira no tom das palavras e a de destaque na cor de ação.
// { "tipo": "holofote", "quando": "acaba", "ate_fim": "graça",
//   "palavras": [{ "texto": "acaba", "quando": "acaba" }, { "texto": "de graça", "quando": "de graça", "destaque": true }],
//   "ambiente": 0.2, "raio_luz": 0.3, "luz": "#FFEBD2", "fonte_estilo": "serifa" | "referencia" }
let B, T, K, F;
const usa = (b, c) => { B = b; ({ T, K, F } = b.usa(c)); };

function timeline(c, b) {
  usa(b, c);
  const tl = c._tl = B.linha(); c._luz = { p: 0 };
  c._pals = (c.palavras || []).map(p => ({ texto: p.texto, destaque: !!p.destaque, t: B.tempo(p.quando), p: 0, sobe: 0 }));
  // luz apaga com tremida de lâmpada (3 quadros) e volta suave no fim
  tl.set(c._luz, { p: 0.9 }, 0); tl.set(c._luz, { p: 0.35 }, 2 / 30); tl.set(c._luz, { p: 1 }, 3 / 30);
  const fim = c.t1 - c.t0, d = c.volta_s ?? 0.4;   // a luz volta DEPOIS da última palavra (a cena se estende pela volta)
  tl.to(c._luz, { p: 0, duration: d, ease: 'power2.inOut' }, Math.max(0.5, fim + 0.05)); c.t1 += d + 0.05;
  c._pals.forEach((p, i) => {
    if (p.t == null) { B.avisos.push(`holofote: palavra "${p.texto}" sem âncora`); return; }
    tl.fromTo(p, { p: 0 }, { p: 1, duration: 0.5, ease: 'expo.out' }, Math.max(0.04, p.t - c.t0 - 0.04));
    if (i > 0) tl.to(c._pals[i - 1], { sobe: 1, duration: 0.5, ease: 'expo.out' }, Math.max(0.04, p.t - c.t0 - 0.04));
  });
  return tl;
}

// clique do interruptor e impacto a cada palavra depois da primeira
const sons = c => [{ t: c.t0 - 0.01, som: 'clique', ganho: 1.0 },
  ...c._pals.map((p, i) => ({ p, i })).filter(({ p, i }) => p.t != null && i > 0).map(({ p }) => ({ t: p.t - 0.03, som: 'impacto', ganho: 0.75 }))];

// mapa de luz (tela W×H): ambiente frio + poça do facho pelo inverso do quadrado + o ar iluminado do cone
function mapaDeLuz(M, c, hx, hy, luz) {
  const { W, H, rgba } = B;
  const amb = c.ambiente ?? 0.2, R = (c.raio_luz ?? 0.3) * W, forca = c.forca_luz ?? 1.0;
  M.setTransform(1, 0, 0, 1, 0, 0); M.globalCompositeOperation = 'source-over'; M.filter = 'none'; M.globalAlpha = 1;
  // luz ambiente: o tom frio da marca, levado ao nível pedido (multiplicar por ele = expor a sala para baixo)
  M.fillStyle = '#000'; M.fillRect(0, 0, W, H);
  M.globalAlpha = Math.min(1, amb * 2.6); M.fillStyle = K.sombra_fria; M.fillRect(0, 0, W, H);
  M.globalAlpha = amb * 0.55; M.fillStyle = '#FFFFFF'; M.fillRect(0, 0, W, H); M.globalAlpha = 1;
  // a poça: centro na parede logo acima e atrás da cabeça; queda 1/(1+(d/R)²) em 14 paradas
  M.globalCompositeOperation = 'lighter';
  const px = hx, py = hy - 0.07 * H, far = 2.6 * R, gr = M.createRadialGradient(px, py, 0, px, py, far);
  for (let i = 0; i <= 14; i++) { const d = far * i / 14, I = forca / (1 + (d / R) ** 2); gr.addColorStop(i / 14, rgba(luz, Math.min(1, I * (1 - i / 14) ** 0.35))); }
  M.fillStyle = gr; M.fillRect(0, 0, W, H);
  M.globalCompositeOperation = 'source-over';
}

async function desenhar({ g: x, c, t, V, mask }, b) {
  usa(b, c);
  const { W, H, clamp, rgba } = B;
  B.seek(c, t); const Lz = c._luz.p; if (Lz <= 0) return;
  const A = B.gp(); B.reset(A); A.drawImage(x.canvas, 0, 0);          // o quadro como está (vídeo já enquadrado)
  const cab = c._cab, hx = V.X + (cab.cx * W - V.sx) * V.k, hy = V.Y + (cab.topo * H - V.sy) * V.k;
  const luz = c.luz || K.luz;
  // 1 · a sala relit: quadro (um pouco fora de foco) × mapa de luz, numa tela à parte, e depois misturada pela luz da cena
  const S = c._S || (c._S = new OffscreenCanvas(W, H).getContext('2d')), M = c._M || (c._M = new OffscreenCanvas(W, H).getContext('2d'));
  S.setTransform(1, 0, 0, 1, 0, 0); S.globalCompositeOperation = 'source-over'; S.globalAlpha = 1;
  S.filter = `blur(${c.desfoque_sala ?? 2.5}px) saturate(0.8)`; S.drawImage(A.canvas, 0, 0); S.filter = 'none';
  mapaDeLuz(M, c, hx, hy, luz);
  S.globalCompositeOperation = 'multiply'; S.drawImage(M.canvas, 0, 0); S.globalCompositeOperation = 'source-over';
  // a poça acende a parede além do que a multiplicação devolve (a lâmpada é mais forte que a luz do dia que sobrou)
  { const px = hx, py = hy - 0.07 * H, R = (c.raio_luz ?? 0.3) * W, gl = S.createRadialGradient(px, py, 0, px, py, R * 1.4);
    gl.addColorStop(0, rgba(luz, c.brilho_parede ?? 0.22)); gl.addColorStop(0.45, rgba(luz, (c.brilho_parede ?? 0.22) * 0.35)); gl.addColorStop(1, rgba(luz, 0));
    S.globalCompositeOperation = 'screen'; S.fillStyle = gl; S.fillRect(0, 0, W, H); S.globalCompositeOperation = 'source-over'; }
  // ar iluminado: o cone do facho e a poeira, bem de leve (luz que bate em partícula, não um triângulo pintado)
  S.save(); S.globalCompositeOperation = 'screen'; S.filter = 'blur(34px)';
  const top = -60, base = hy + 0.05 * H, cone = S.createLinearGradient(0, top, 0, base);
  cone.addColorStop(0, rgba(K.luz_facho, 0.16)); cone.addColorStop(0.7, rgba(K.luz_facho, 0.06)); cone.addColorStop(1, rgba(K.luz_facho, 0));
  S.fillStyle = cone; S.beginPath(); S.moveTo(hx - 60, top); S.lineTo(hx + 60, top); S.lineTo(hx + 0.36 * W, base); S.lineTo(hx - 0.36 * W, base); S.closePath(); S.fill(); S.filter = 'none';
  const r = B.rng(41); for (let q = 0; q < 46; q++) { const fx = r(), fy = r(), vel = 0.01 + r() * 0.03, ph = r() * 6.28;
    const yy = ((fy + (t - c.t0) * vel) % 1) * (hy + 0.05 * H), larg = 0.36 * W * (yy / (hy + 0.05 * H)), xx = hx + (fx - 0.5) * 2 * larg + Math.sin(t * 0.8 + ph) * 8;
    S.fillStyle = rgba(K.luz_poeira, 0.10 + 0.18 * Math.sin(t * 1.3 + ph) ** 2); S.beginPath(); S.arc(xx, yy, 1.2 + r() * 1.6, 0, Math.PI * 2); S.fill(); }
  S.restore();
  // grão por cima do escuro (o sensor da câmera não fica liso quando a luz cai)
  S.save(); S.globalCompositeOperation = 'overlay'; S.globalAlpha = c.grao ?? 0.08;
  const gp = S.createPattern(B.grao(), 'repeat'), fq = Math.round(t * 30); S.translate((fq * 73) % 256, (fq * 151) % 256); S.fillStyle = gp; S.fillRect(-256, -256, W + 512, H + 512); S.restore();
  // vinheta física (a luz não alcança os cantos)
  S.save(); const vg = S.createRadialGradient(hx, hy, H * 0.22, hx, hy, H * 0.85); vg.addColorStop(0, rgba(K.vinheta, 0)); vg.addColorStop(1, rgba(K.vinheta, 0.5)); S.fillStyle = vg; S.fillRect(0, 0, W, H); S.restore();
  x.save(); x.globalAlpha = Lz; x.drawImage(S.canvas, 0, 0); x.restore();
  // 2 · palavras grandes atrás da pessoa (iluminadas pela mesma poça: perto da luz, mais claras)
  const ref = c.fonte_estilo === 'referencia';
  const G = B.ga(); B.reset(G);
  // sem o recorte da pessoa (Windows): as palavras sobem para cima da cabeça em vez de passar atrás dela
  const yBase = mask ? hy + 0.02 * H : hy - 0.035 * H; const linhas = c._pals.filter(p => p.p > 0);
  c._pals.forEach(p => {
    if (p.p <= 0) return;
    let tam, txt;
    if (ref) { tam = 250 * (c.escala ?? 1); B.fRef(G, tam, -0.045); txt = p.texto.toLowerCase(); }
    else { tam = (p.destaque ? 250 : 230) * (c.escala ?? 1); if (p.destaque) B.fTitulo(G, tam, -0.01); else B.fDisplay(G, tam, -0.025); txt = p.destaque || !F.display_caixa_alta ? p.texto : p.texto.toUpperCase(); }
    const tw = G.measureText(txt).width, lim = W * 0.92, s0 = tw > lim ? lim / tw : 1;
    const nAcima = linhas.length - 1 - linhas.indexOf(p);
    const y = yBase - nAcima * tam * (ref ? 0.86 : 0.82);
    const s = s0 * (1.16 - 0.16 * p.p);
    G.save(); G.globalAlpha = clamp(p.p * 1.6) * Lz * (1 - 0.35 * p.sobe); G.translate(hx, y); G.scale(s, s);
    if (p.p < 0.98) G.filter = `blur(${(1 - p.p) * 14}px)`;
    G.textAlign = 'center'; G.textBaseline = 'alphabetic';
    if (ref) {   // cheia, sem degradê; sombra curta e suave na parede (a luz vem de cima)
      G.shadowColor = rgba(K.sombra_funda, 0.45); G.shadowBlur = 24; G.shadowOffsetY = 14;
      G.fillStyle = p.destaque ? K.destaque : K.palavra; G.fillText(txt, 0, 0);
    } else {
      G.shadowColor = rgba(K.luz_brilho, 0.35); G.shadowBlur = 40;
      const gr = G.createLinearGradient(0, -tam * 0.8, 0, 0); gr.addColorStop(0, p.destaque ? K.destaque_claro : K.palavra); gr.addColorStop(1, p.destaque ? K.destaque : K.palavra2);
      G.fillStyle = gr; G.fillText(txt, 0, 0);
    }
    G.restore();
  });
  // 3 · a pessoa por cima, com a luz de cima: rosto aceso, corpo caindo para a sombra, contorno quente por trás
  if (mask) {
    const P = B.gsnap(); B.reset(P); B.naParede(P, V); P.drawImage(mask, 0, 0, W, H); P.setTransform(1, 0, 0, 1, 0, 0);
    G.globalCompositeOperation = 'destination-out'; G.drawImage(P.canvas, 0, 0); G.globalCompositeOperation = 'source-over';
    x.drawImage(G.canvas, 0, 0);
    // contorno de luz: silhueta desfocada em tom quente, desenhada ANTES da pessoa (só a borda de fora aparece)
    x.save(); x.globalAlpha = (c.contorno ?? 0.24) * Lz; x.globalCompositeOperation = 'screen'; x.filter = 'blur(18px)';
    const tint = c._tint || (c._tint = new OffscreenCanvas(W, H)), tg = tint.getContext('2d');
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H); tg.drawImage(P.canvas, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = luz; tg.fillRect(0, 0, W, H);
    // a luz de cima só desenha a borda da cabeça e dos ombros; o corpo embaixo fica sem contorno
    tg.globalCompositeOperation = 'destination-in'; const cf = tg.createLinearGradient(0, hy, 0, hy + 0.3 * H); cf.addColorStop(0, 'rgba(0,0,0,1)'); cf.addColorStop(1, 'rgba(0,0,0,0)'); tg.fillStyle = cf; tg.fillRect(0, 0, W, H);
    x.drawImage(tint, 0, -14); x.restore();
    // pessoa: o quadro original recortado, multiplicado por uma queda vertical (luz de cima) e com o mesmo grão
    P.globalCompositeOperation = 'source-in'; P.drawImage(A.canvas, 0, 0);
    // (preto por cima só onde há pessoa = multiplicar a pessoa pela queda; "multiply" pintaria o fundo vazio)
    P.globalCompositeOperation = 'source-atop'; const qd = P.createLinearGradient(0, hy - 0.05 * H, 0, H);
    qd.addColorStop(0, 'rgba(0,0,0,0)'); qd.addColorStop(0.18, 'rgba(0,0,0,0)'); qd.addColorStop(1, `rgba(0,0,0,${Math.min(0.75, c.queda ?? 0.55)})`);
    P.fillStyle = qd; P.fillRect(0, 0, W, H);
    // brilho quente no topo da cabeça e nos ombros (a luz chega de cima)
    P.globalCompositeOperation = 'source-atop'; const kt = P.createRadialGradient(hx, hy - 0.02 * H, 0, hx, hy - 0.02 * H, 0.22 * W);
    kt.addColorStop(0, rgba(luz, 0.18)); kt.addColorStop(1, rgba(luz, 0)); P.fillStyle = kt; P.fillRect(0, 0, W, H);
    P.globalCompositeOperation = 'source-over';
    x.save(); x.globalAlpha = Lz; x.filter = 'contrast(1.05)'; x.drawImage(P.canvas, 0, 0); x.restore();
  } else { x.drawImage(G.canvas, 0, 0); if (!c._avisou) { c._avisou = true; B.avisos.push('holofote sem o recorte da pessoa: as palavras ficam acima da cabeça (no Mac, motor/mascaras.py)'); } }
}

export default { tipo: 'holofote', camada: 'luz', mascara: true, quadro: false, timeline, sons, desenhar };
