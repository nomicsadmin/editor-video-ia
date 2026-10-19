// EFEITO NATIVO · contador · versão aberta do número que conta do editor da Nomics (17/Out/2026, reels do Tabbied).
// Um cartão de vidro escuro entra na palavra e o número conta de 0 até o valor em ~0,9 s, com o rótulo embaixo e um
// pop quando ele pousa. Sem máscara: funciona igual no Mac e no Windows.
// { "tipo": "contador", "valor": 377, "rotulo": "sites prontos", "quando": "377", "ate": "templates",
//   "prefixo": "", "sufixo": "", "x": 0.5, "y": null, "conta_s": 0.9, "separador": "." }
// x, y = centro do cartão em fração da tela (padrão: no meio do painel de cima da tela dividida, 0,72 da altura dele).
let B, K, F;
const usa = (b, c) => { B = b; ({ K, F } = b.usa(c)); };

function preparar(c, b) { usa(b, c); c._conta = c.conta_s ?? 0.9; }
const sons = c => [{ t: c.t0, som: 'whoosh', ganho: 0.35 }, { t: c.t0 + 0.05 + c._conta, som: 'pop', ganho: 0.8 }];

const fmt = (n, sep) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

function desenhar({ g: x, c, t }, b) {
  usa(b, c);
  const { W, H, clamp, rgba, eOut, seg } = B, u = W / 1080;
  const a = eOut(seg(t, c.t0, c.t0 + 0.3)) * (1 - seg(t, c.t1 - 0.25, c.t1)); if (a <= 0) return;
  const alvo = Number(c.valor) || 0, dec = String(c.valor).includes('.') && !Number.isInteger(alvo) ? String(c.valor).split('.')[1].length : 0;
  const v = alvo * eOut(seg(t, c.t0 + 0.05, c.t0 + 0.05 + c._conta));
  const sep = c.separador ?? '.', num = dec ? v.toFixed(dec).replace('.', ',') : fmt(Math.round(v), sep);
  const txt = `${c.prefixo || ''}${num}${c.sufixo || ''}`, cheio = `${c.prefixo || ''}${dec ? alvo.toFixed(dec).replace('.', ',') : fmt(alvo, sep)}${c.sufixo || ''}`;
  const PH = H * (B.ED.divisao || 0.48), cx = (c.x ?? 0.5) * W, cy = c.y != null ? c.y * H : PH * 0.72;
  const tam = 168 * u * (c.escala ?? 1), tr = 26 * u * (c.escala ?? 1);
  x.save(); x.globalAlpha = a;
  B.fTitulo(x, tam, -0.012); const tw = Math.max(x.measureText(cheio).width, 180 * u);
  const rot = String(c.rotulo || '').toUpperCase(); B.fMono(x, tr, 0.15); const lw = x.measureText(rot).width;
  const bw = Math.max(tw, lw) + 110 * u, bh = (rot ? 240 : 200) * u * (c.escala ?? 1), X = cx - bw / 2, Y = cy - bh / 2 + (1 - a) * 26 * u;
  // pop no fim da contagem
  const pp = clamp((t - c.t0 - 0.05 - c._conta) / 0.25), sp = 1 + 0.05 * Math.sin(Math.PI * pp);
  x.translate(cx, cy); x.scale(sp, sp); x.translate(-cx, -cy);
  x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 40 * u; x.shadowOffsetY = 14 * u;
  B.rr(x, X, Y, bw, bh, 26 * u); x.fillStyle = rgba(K.vidro || '#0F1221', 0.86); x.fill();
  x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0;
  const lg = x.createLinearGradient(0, Y, 0, Y + bh); lg.addColorStop(0, rgba(K.realce, 0.10)); lg.addColorStop(0.4, rgba(K.realce, 0)); x.fillStyle = lg; B.rr(x, X, Y, bw, bh, 26 * u); x.fill();
  x.lineWidth = 2 * u; x.strokeStyle = rgba(K.borda, 0.14); B.rr(x, X, Y, bw, bh, 26 * u); x.stroke();
  x.fillStyle = K.destaque; x.fillRect(X + 34 * u, Y + 34 * u, 34 * u, 4 * u);
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  B.fTitulo(x, tam, -0.012); x.fillStyle = K.texto_forte; x.fillText(txt, cx, Y + (rot ? 166 : 150) * u * (c.escala ?? 1));
  if (rot) { B.fMono(x, tr, 0.15); x.fillStyle = c.cor_rotulo || K.enfase; x.fillText(rot, cx, Y + 212 * u * (c.escala ?? 1)); }
  x.restore();
}

export default { tipo: 'contador', camada: 'frente', mascara: false, quadro: false, preparar, sons, desenhar };
