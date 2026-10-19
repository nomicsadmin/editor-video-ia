// EFEITO NATIVO · caixa · o destaque que se desenha em volta de um trecho da tela (editor da Nomics, 17/Out/2026).
// Contorno na cor de destaque se desenhando a partir de um canto, com brilho e um véu leve por dentro. Para marcar um
// pedaço de print, de gravação de tela ou do próprio vídeo na palavra dita. Dentro de um "print", use a marca
// { "tipo": "caixa" } (ela acompanha a rolagem e a perspectiva); esta cena solta é para o resto.
// { "tipo": "caixa", "area": [0.08, 0.18, 0.84, 0.06], "quando": "categorias", "ate": "cada", "cor": null, "espessura": 5 }
// area = [x, y, largura, altura] em fração da tela.
let B, K;
const usa = (b, c) => { B = b; ({ K } = b.usa(c)); };

const sons = c => [{ t: c.t0, som: 'clique', ganho: 0.35 }];

function desenhar({ g: x, c, t }, b) {
  usa(b, c);
  const { W, H, rgba, eOut, seg } = B, u = W / 1080;
  const a = 1 - seg(t, c.t1 - 0.25, c.t1); if (a <= 0 || t < c.t0) return;
  const p = eOut(seg(t, c.t0, c.t0 + (c.desenha_s ?? 0.5))), [ax, ay, aw, ah] = c.area || [0.1, 0.2, 0.8, 0.08], pad = (c.pad ?? 8) * u;
  const X = ax * W - pad, Y = ay * H - pad, w = aw * W + 2 * pad, h = ah * H + 2 * pad, r = (c.raio ?? 12) * u, per = 2 * (w + h), cor = c.cor || K.destaque;
  x.save(); x.globalAlpha = a;
  x.fillStyle = rgba(cor, 0.10 * p); x.beginPath(); x.roundRect(X, Y, w, h, r); x.fill();
  x.lineWidth = (c.espessura ?? 5) * u; x.strokeStyle = cor; x.shadowColor = rgba(cor, 0.55); x.shadowBlur = 16 * u; x.lineCap = 'round';
  x.setLineDash([per * p, per]); x.beginPath(); x.roundRect(X, Y, w, h, r); x.stroke();
  x.restore();
}

export default { tipo: 'caixa', camada: 'frente', mascara: false, quadro: false, sons, desenhar };
