// EFEITOS NATIVOS DA NOMICS · orquestrador · criado do zero pela Nomics em 12/Out/2026.
// Código 100% da casa (sem nada de terceiros além do GSAP já vendorizado no motor). Doc: referencias/efeitos-nativos.md.
//
// Cada efeito é um módulo em ./efeitos/<nome>.js (registro em ./efeitos/index.js); o que eles dividem (tema da marca,
// vidro, fontes, cantos, âncoras de fala, recorte na parede) está em ./efeitos/base.js. Este arquivo só liga os módulos
// ao compositor: prepara cada cena (tema, cabeça, timeline, sons) e desenha cada uma na sua camada, sempre na mesma ordem:
//   luz    · mexe no quadro inteiro, antes de tudo (holofote)
//   parede · desenhado nas coordenadas do quadro-fonte (cola no cenário, acompanha zoom e punch) e apagado onde a
//            pessoa está, com a maciez da câmera (hodometro, checklist)
//   objeto · coisa que flutua no espaço, atrás da pessoa (celular)
//   frente · por cima do vídeo e das cenas, junto com as cenas de frente do compositor (comentario)
// "Na parede" pede as máscaras do motor/mascaras.py.
//   import efeitos from './efeitos.js';  const EF = efeitos(api);  await EF.preparar(cena);  await EF.camadas(t)
import * as REGISTRO from './efeitos/index.js';
import { criaBase } from './efeitos/base.js';

const ORDEM = ['luz', 'parede', 'objeto'];

export default function efeitos(api) {
  const B = criaBase(api);
  const { x, W, H, avisos, mascaraDe, quadro, idxEm, vid, getJ, MARCA } = api;
  const MOD = Object.fromEntries(Object.values(REGISTRO).map(m => [m.tipo, m]));
  const TIPOS = new Set(Object.keys(MOD));
  const CENAS = [];

  async function preparar(c) {
    const m = MOD[c.tipo]; if (!m) return;
    await B.usaGsap();
    if (B.TOPO === null) B.TOPO = (await getJ('/b/m/topo.json', true)) || false;
    if (!B.TOPO && m.camada !== 'frente') avisos.push(`${c.tipo}: faltou _build/m/topo.json (rode motor/mascaras.py <pasta>)`);
    c._T = c.marca ? B.mescla(MARCA, c.marca) : MARCA;   // "marca" na cena ajusta só ela
    c._sons = []; c._cab = B.cabeca(c);
    if (m.preparar) m.preparar(c, B);
    if (m.timeline) m.timeline(c, B);
    if (m.sons) for (const s of m.sons(c, B)) if (s.t != null && c.som !== 'nenhum') c._sons.push({ t: s.t, som: s.som, ganho: s.ganho ?? 1 });
    B.gsap.ticker.sleep();
    CENAS.push(c);
  }

  // camada "parede": desenha nas coordenadas do quadro-fonte, apaga onde a pessoa está e aplica a maciez da câmera
  async function naParede(m, c, t, V, frame, mask) {
    const G = B.ga(); B.reset(G); B.naParede(G, V);
    await m.desenhar({ g: G, c, t, V, frame, mask }, B);
    if (mask && c.atras_da_pessoa !== false) { G.globalCompositeOperation = 'destination-out'; G.filter = 'none'; G.drawImage(mask, 0, 0, W, H); }
    G.setTransform(1, 0, 0, 1, 0, 0);
    x.save(); const d = c.desfoque ?? 0.5; if (d > 0) x.filter = `blur(${d}px)`; x.drawImage(G.canvas, 0, 0); x.restore();
  }

  // camadas que precisam do quadro e da máscara (assíncronas): depois do vídeo, antes das cenas de frente e da legenda
  async function camadas(t) {
    const ativas = CENAS.filter(c => MOD[c.tipo].camada !== 'frente' && t >= c.t0 - 0.01 && t <= c.t1 + 0.01);
    const V = vid(); if (!ativas.length || !V) return;
    const idx = idxEm(t), mask = await mascaraDe(idx), frame = ativas.some(c => MOD[c.tipo].quadro) ? await quadro(idx) : null;
    for (const camada of ORDEM) for (const c of ativas.filter(c => MOD[c.tipo].camada === camada)) {
      const m = MOD[c.tipo];
      if (camada === 'parede') await naParede(m, c, t, V, frame, mask);
      else await m.desenhar({ g: x, c, t, V, frame, mask }, B);
    }
  }

  // camada "frente": entra no DESENHA do compositor (sync, junto com as outras cenas)
  const DESENHA = Object.fromEntries(Object.values(MOD).filter(m => m.camada === 'frente').map(m => [m.tipo, (c, t) => m.desenhar({ g: x, c, t }, B)]));
  return { TIPOS, preparar, camadas, DESENHA };
}
