// EFEITO NATIVO · antes_depois · criado do zero pela Nomics em 12/Out/2026 (frente 3). Rodada 2 em 13/Out/2026.
// O QUADRO INTEIRO vira "não editado × editado". Na entrada, o vídeo perde a edição: fica o bruto do celular
// (cor lavada, contraste chapado, preto levantado, balanço de branco frio, ruído de sensor, sem legenda) e o selo
// "antes" estala no canto. Na palavra, uma linha de corte com puxador redondo entra pela direita e varre o quadro:
// o que fica à direita dela já é o editado (a grade da casa, a legenda). A linha não passa reto: vai, volta como quem
// arrasta o puxador para comparar, segura um instante e sai pela esquerda. O selo "antes" anda colado do lado
// esquerdo da linha e o "depois" do lado direito; no fim fica só o editado com o selo "depois".
// Camada "luz": mexe no quadro já enquadrado (a pessoa e tudo), antes das outras cenas e da legenda.
// { "tipo": "antes_depois", "quando": "ficou", "corta": "edição", "ate_fim": "dinâmica",
//   "rotulos": ["antes", "depois"], "varredura": "vai_e_volta", "paradas": [0.27, 0.6, 0.54], "alca_y": 0.66, "selo_y": 0.115,
//   "cru": { "saturacao": 0.55, "contraste": 0.78, "brilho": 1.04, "frio": 0.5, "ruido": 0.09 } }
// varredura: "vai_e_volta" (padrão) ou "direta". A legenda some do lado cru (a de baixo volta quando a linha passa de
// 62% da largura); "legenda_no_cru": true deixa a legenda sempre.
import { mix } from './acabamento.js';
let B, T, K, F;
const usa = (b, c) => { B = b; ({ T, K, F } = b.usa(c)); };
let _cru = null;
const tela = () => _cru || (_cru = new OffscreenCanvas(B.W, B.H).getContext('2d'));

function timeline(c, b) {
  usa(b, c);
  const tl = c._tl = B.linha(), dur = c.t1 - c.t0;
  c._ent = { p: 0 }; c._sel = { p: 0 }; c._L = { p: 1.08 }; c._sai = { p: 0 };
  const tc = (B.tempo(c.corta) ?? c.t0 + 1.4) - c.t0, ti = c._ti = Math.max(0.5, tc - 0.08);
  const nf = { immediateRender: false };
  tl.fromTo(c._ent, { p: 0 }, { p: 1, duration: 0.22, ease: 'power2.out', ...nf }, 0);
  tl.fromTo(c._sel, { p: 0 }, { p: 1, duration: 0.6, ease: 'elastic.out(1, 0.55)', ...nf }, 0.12);
  if ((c.varredura || 'vai_e_volta') === 'direta') {
    tl.fromTo(c._L, { p: 1.08 }, { p: -0.08, duration: 1.15, ease: 'power2.inOut', ...nf }, ti);
    c._fimL = ti + 1.15; c._bat = [ti];
  } else {
    // entra rápido e freia perto da esquerda, volta para a direita, segura respirando e sai pela esquerda
    // paradas (fração da largura): onde freia, para onde volta e onde segura (padrão: a volta racha o rosto ao meio)
    const [p1, p2, p3] = c.paradas || [0.27, 0.6, 0.54];
    tl.fromTo(c._L, { p: 1.08 }, { p: p1, duration: 0.38, ease: 'power3.out', ...nf }, ti);
    tl.to(c._L, { p: p2, duration: 0.42, ease: 'power2.inOut', ...nf }, ti + 0.38);
    tl.to(c._L, { p: p3, duration: 0.34, ease: 'sine.inOut', ...nf }, ti + 0.8);
    tl.to(c._L, { p: -0.08, duration: 0.38, ease: 'power2.in', ...nf }, ti + 1.14);
    c._fimL = ti + 1.52; c._bat = [ti, ti + 0.38, ti + 1.14];
  }
  tl.fromTo(c._sai, { p: 0 }, { p: 1, duration: 0.35, ease: 'power2.in', ...nf }, Math.max(c._fimL + 0.5, dur - 0.35));
  return tl;
}

const sons = c => [{ t: c.t0 + 0.1, som: 'click-soft', ganho: 0.7 },
  ...c._bat.map((q, i) => ({ t: c.t0 + q - 0.04, som: i === 2 ? 'whoosh' : 'whoosh-short', ganho: i ? 0.38 : 0.55 })),
  { t: c.t0 + c._fimL - 0.05, som: 'sparkle', ganho: 0.3 }];

// o bruto do celular: refeito a partir do quadro editado (cor lavada, chapado, frio, macio e com ruído)
function cru(c, x, n) {
  const S = tela(), { W, H } = B, o = c.cru || {};
  const sat = o.saturacao ?? 0.55, con = o.contraste ?? 0.78, bri = o.brilho ?? 1.04, frio = o.frio ?? 0.5, ruido = o.ruido ?? 0.09;
  S.setTransform(1, 0, 0, 1, 0, 0); S.globalAlpha = 1; S.globalCompositeOperation = 'source-over'; S.filter = 'none';
  S.filter = `saturate(${sat}) contrast(${con}) brightness(${bri}) blur(0.6px)`; S.drawImage(x.canvas, 0, 0, W, H); S.filter = 'none';
  // balanço de branco automático do celular: puxa para o frio/esverdeado (overlay de um cinza azulado)
  if (frio > 0) { S.globalCompositeOperation = 'overlay'; S.fillStyle = `rgba(104,126,140,${0.42 * frio})`; S.fillRect(0, 0, W, H); }
  // preto levantado (sem curva): um véu cinza claro bem fraco
  S.globalCompositeOperation = 'screen'; S.fillStyle = 'rgba(40,44,48,0.32)'; S.fillRect(0, 0, W, H);
  // ruído de sensor, vivo (deslocado a cada quadro, semente pelo número do quadro)
  if (ruido > 0) {
    const r = B.rng(n * 7 + 3), gr = B.grao(), pat = S.createPattern(gr, 'repeat');
    S.save(); S.globalCompositeOperation = 'overlay'; S.globalAlpha = ruido * 2.2; S.translate(-r() * 256, -r() * 256);
    S.fillStyle = pat; S.fillRect(0, 0, W + 256, H + 256); S.restore();
  }
  S.globalCompositeOperation = 'source-over';
  return S.canvas;
}

function selo(g, txt, X, Y, alinha, fundo, tinta, borda, k, s) {
  B.fCorpo(g, 32 * k, true, 0.01); const tw = g.measureText(txt).width, w = tw + 46 * k, h = 56 * k;
  const x0 = alinha === 'dir' ? X - w : X;
  g.save(); g.translate(x0 + w / 2, Y + h / 2); g.scale(s, s); g.translate(-(x0 + w / 2), -(Y + h / 2));
  g.shadowColor = B.rgba(K.sombra_funda, 0.45); g.shadowBlur = 18 * k; g.shadowOffsetY = 5 * k;
  B.rr(g, x0, Y, w, h, h / 2); g.fillStyle = fundo; g.fill(); g.shadowColor = 'transparent';
  // brilho de cima (pílula com volume, não adesivo chapado)
  const lg = g.createLinearGradient(0, Y, 0, Y + h); lg.addColorStop(0, B.rgba(K.realce, 0.22)); lg.addColorStop(0.5, B.rgba(K.realce, 0)); lg.addColorStop(1, B.rgba(K.sombra_funda, 0.12));
  B.rr(g, x0, Y, w, h, h / 2); g.fillStyle = lg; g.fill();
  B.rr(g, x0 + 0.75, Y + 0.75, w - 1.5, h - 1.5, h / 2); g.strokeStyle = borda; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = tinta; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x0 + w / 2, Y + h / 2 + 1.5 * k);
  g.restore();
  return w;
}

async function desenhar({ g: x, c, t }, b) {
  usa(b, c);
  const { W, H, clamp, rgba } = B;
  B.seek(c, t); const ent = c._ent.p, sai = c._sai.p;
  const k = c.escala ?? 1, L = c._L.p, Lx = L * W, n = Math.round(t * B.FPS);
  // legenda: some enquanto quase toda ela está no lado cru
  if (!c.legenda_no_cru) c.esconde_legenda = Lx > W * 0.62;
  // 1 · o lado cru (tudo à esquerda da linha)
  if (Lx > 0 && ent > 0) {
    const im = cru(c, x, n);
    x.save(); x.beginPath(); x.rect(0, 0, Math.min(W, Lx), H); x.clip(); x.globalAlpha = ent; x.drawImage(im, 0, 0); x.restore();
  }
  // 2 · a linha de corte e o puxador
  if (L > -0.05 && L < 1.05) {
    const y = (c.alca_y ?? 0.66) * H, r = 40 * k;
    const v = c._vL == null ? 0 : (L - c._vL) * B.FPS; c._vL = L;    // velocidade da linha (fração de W por s)
    x.save();
    // sombra macia dos dois lados (a linha descola do vídeo sem parecer recortada)
    const sg = x.createLinearGradient(Lx - 26 * k, 0, Lx + 26 * k, 0);
    sg.addColorStop(0, rgba(K.sombra_funda, 0)); sg.addColorStop(0.5, rgba(K.sombra_funda, 0.32)); sg.addColorStop(1, rgba(K.sombra_funda, 0));
    x.fillStyle = sg; x.fillRect(Lx - 26 * k, 0, 52 * k, H);
    x.shadowColor = rgba(K.realce, 0.7); x.shadowBlur = 10 * k; x.fillStyle = K.texto_forte; x.fillRect(Lx - 1.6 * k, 0, 3.2 * k, H);
    x.shadowColor = 'transparent';
    // puxador: botão branco com volume, achata um pouco na direção do movimento
    const est = clamp(Math.abs(v) * 0.05, 0, 0.14);
    x.translate(Lx, y); x.scale(1 + est, 1 - est * 0.6);
    x.shadowColor = rgba(K.sombra_funda, 0.55); x.shadowBlur = 24 * k; x.shadowOffsetY = 8 * k;
    const kg = x.createLinearGradient(0, -r, 0, r); kg.addColorStop(0, K.texto_forte); kg.addColorStop(1, mix(K.texto_forte, K.sombra, 0.16));
    x.fillStyle = kg; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.shadowColor = 'transparent';
    x.strokeStyle = rgba(K.sombra_funda, 0.18); x.lineWidth = 1.5; x.stroke();
    const hl = x.createRadialGradient(-r * 0.3, -r * 0.45, 0, -r * 0.3, -r * 0.45, r * 0.9); hl.addColorStop(0, rgba(K.realce, 0.9)); hl.addColorStop(1, rgba(K.realce, 0));
    x.fillStyle = hl; x.beginPath(); x.arc(0, 0, r - 2, 0, Math.PI * 2); x.fill();
    x.strokeStyle = K.superficie_funda; x.lineWidth = 4.6 * k; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const d of [-1, 1]) { x.beginPath(); x.moveTo(d * 7 * k, -10 * k); x.lineTo(d * 16 * k, 0); x.lineTo(d * 7 * k, 10 * k); x.stroke(); }
    x.restore();
  }
  // 3 · os selos, cada um preso ao seu lado da linha
  const [rA, rD] = c.rotulos || ['antes', 'depois'], sy = (c.selo_y ?? 0.115) * H, m = 40 * k, gap = 16 * k;
  const pop = c._sel.p;
  if (pop > 0 && Lx > 0) {
    x.save(); x.beginPath(); x.rect(0, 0, Math.min(W, Lx), H); x.clip(); x.globalAlpha = clamp(pop * 3) * ent;
    selo(x, rA, Math.min(Lx - gap, W - m), sy, 'dir', rgba(K.superficie_funda, 0.88), K.texto, rgba(K.borda, 0.22), k, 0.6 + 0.4 * pop);
    x.restore();
  }
  if (Lx < W && sai < 1) {
    const ps = clamp((t - c.t0 - c._ti) / 0.35);
    x.save(); x.beginPath(); x.rect(Math.max(0, Lx), 0, W, H); x.clip(); x.globalAlpha = (1 - sai);
    selo(x, rD, Math.max(Lx + gap, m), sy - sai * 14 * k, 'esq', K.destaque, K.sobre_destaque, rgba(K.realce, 0.35), k, 0.7 + 0.3 * B.eOut(ps));
    x.restore();
  }
}

export default { tipo: 'antes_depois', camada: 'luz', mascara: false, quadro: false, timeline, sons, desenhar };
