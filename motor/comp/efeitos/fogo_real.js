// Fogo de verdade (filmagem real de papel queimando, recortada do fundo verde por motor/fogo_real.py).
// Queima QUALQUER desenho do extra.js: um papel com a headline, um logo, a tela inteira.
//
//   import { FogoReal } from '/comp/efeitos/fogo_real.js';
//   const fogo = await FogoReal(api, 'assets/fogo-headline');       // pasta com m/, c/ e fogo.json
//   ...dentro de um gancho async do extra.js (cena/fundo/frente podem ser async):
//   await fogo.desenha(x, G, t - t_comeco, { x: X, y: Y, rot: 0.05 }); // G = canvas com o que vai queimar (largura × altura da caixa)
//
// Camadas por quadro: m/NNNNN.png (alfa = o que ainda não queimou, cor = tom de queimado que multiplica o conteúdo)
// e c/NNNNN.png (chamas sobre preto, desenhadas com "screen"; `acima` px a mais em cima, onde a chama sobe).
// Antes do começo, o desenho aparece inteiro; depois do último quadro, nada (queimou).
export async function FogoReal(api, pasta) {
  const J = await (await fetch(`/p/${pasta}/fogo.json`)).json();
  const w = J.largura, h = J.altura, ac = J.acima || 0, fps = J.fps || 30;
  const T = new OffscreenCanvas(w, h), tx = T.getContext('2d');
  const num = k => String(k).padStart(5, '0');
  return {
    J, duracao: J.n / fps,
    // u = segundos desde o começo da queima; o = { x, y } do canto de cima-esquerdo da caixa na tela, rot em radianos
    // (gira em volta do centro da caixa), esc (escala), alfa, semChama (só a máscara), sombra (px de sombra só no desenho, não na chama)
    async desenha(x, G, u, o = {}) {
      const k = Math.floor(u * fps + 1e-6);
      if (k >= J.n) return false;
      const cx = (o.x || 0) + w / 2, cy = (o.y || 0) + h / 2;
      x.save(); x.translate(cx, cy); if (o.rot) x.rotate(o.rot); if (o.esc) x.scale(o.esc, o.esc); x.translate(-w / 2, -h / 2);
      if (o.alfa != null) x.globalAlpha *= o.alfa;
      const sombra = img => { if (o.sombra) { x.save(); x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = o.sombra; x.shadowOffsetY = o.sombra * 0.4; x.drawImage(img, 0, 0, w, h); x.restore(); } else x.drawImage(img, 0, 0, w, h); };
      if (k < 0) { sombra(G); x.restore(); return true; }
      const [m, c] = await Promise.all([api.quadroSeq(`/p/${pasta}/m/${num(k)}.png`), o.semChama ? null : api.quadroSeq(`/p/${pasta}/c/${num(k)}.png`)]);
      tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'source-over'; tx.globalAlpha = 1; tx.clearRect(0, 0, w, h);
      tx.drawImage(G, 0, 0, w, h);
      if (m) {
        tx.globalCompositeOperation = 'multiply'; tx.drawImage(m, 0, 0, w, h);          // a borda queimando escurece em carvão
        tx.globalCompositeOperation = 'destination-in'; tx.drawImage(G, 0, 0, w, h);    // nada fora do desenho
        tx.globalCompositeOperation = 'destination-in'; tx.drawImage(m, 0, 0, w, h);    // some o que já queimou
      }
      sombra(T);
      if (c) { x.globalCompositeOperation = 'screen'; x.drawImage(c, 0, -ac, w, h + ac); }
      x.restore(); return true;
    },
  };
}
