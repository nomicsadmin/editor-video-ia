// EFEITOS NATIVOS · BASE COMUM · criado do zero pela Nomics em 12/Out/2026.
// Tudo que os efeitos dividem: a camada de MARCA (tema), as utilidades de desenho (rr, vidro, fontes),
// o tempo (GSAP pausado + seek por quadro, âncoras de fala), a cabeça medida pelo mascaras.py e o recorte na parede.
// Cada efeito vive em ./<nome>.js e recebe o objeto B (criaBase) em todas as chamadas. Receita: referencias/efeitos-nativos.md.

// ================================================================== MARCA (tema)
// Os efeitos não têm cor nem fonte fixa: leem tudo daqui. De onde vem a marca (a mais específica vence):
//   1. PADRAO abaixo (= motor/marcas/nomics.json, a identidade da casa);
//   2. "edicao.marca" no projeto.json: o nome de um preset em motor/marcas/<nome>.json, ou o próprio objeto;
//   3. "edicao.marca_ajuste" no projeto.json: só os campos que mudam;
//   4. "marca" na cena do cenas.json: ajuste daquela cena.
// Cores em hex (#RRGGBB). Onde o efeito precisa de transparência, aplica o alfa por cima do token: rgba(K.texto, 0.5).
export const PADRAO = {
  nome: 'nomics',
  cores: {
    texto: '#F4F4F2',          // texto corrido e dígitos, sobre superfície escura
    texto_forte: '#FFFFFF',    // a palavra que importa (comentário publicado, resposta, rótulo)
    destaque: '#FE572A',       // a cor de ação: visto, fio, botão, borda que acende, palavra-destaque
    destaque_claro: '#FF7A50', // topo do degradê da palavra-destaque do holofote
    destaque2: '#6448E0',      // segunda cor (avatar sem foto)
    sobre_destaque: '#1A0C06', // tinta sobre a cor de ação (visto, ícone e texto do botão)
    superficie: '#1C2136',     // caixa do hodômetro (topo do degradê)
    superficie_funda: '#0B0E19', // caixa do hodômetro (base do degradê)
    tambor: '#151A2B',         // meio do tambor de dígito
    tambor_borda: '#05070D',   // topo e base do tambor
    cilindro: '#030408',       // sombra de curvatura do tambor
    vidro: '#0F1221',          // tinta do vidro fosco (checklist)
    vidro2: '#0E111E',         // tinta do vidro do comentário e da bolha "digitando"
    realce: '#FFFFFF',         // brilho de vidro, reflexo, fio de luz
    borda: '#FFFFFF',          // contorno fino das superfícies
    linha: '#FFFFFF',          // trilhos, esqueleto de texto, faixa ativa
    selo: '#FFFFFF',           // fundo do selo do coração
    avatar: '#3A3F57', avatar2: '#22263A',
    sombra: '#0A0C14', sombra_funda: '#05060C',
    noite: '#0F1221',          // tom da sala apagada no holofote
    luz: '#FFEBD2', luz_facho: '#FFF0DE', luz_poeira: '#FFF0DC', luz_brilho: '#FFE1BE',
    palavra: '#FFFFFF', palavra2: '#E8E3DC', // degradê das palavras grandes do holofote
    enfase: '#FDF7BB',         // cor de ênfase: palavra do apagao, etiqueta do adesivo, marcador do bastidor
    vinheta: '#000000',
    // checklist metálico (refino da onda 1): face da placa (topo → base), a espessura vista embaixo e os sulcos gravados
    metal: '#2B2F3B', metal_fundo: '#12141B', metal_aresta: '#06070B', gravado: '#07080C',
    sombra_fria: '#2A3350',    // a luz ambiente que sobra na sala apagada do holofote (levemente fria)
    // frente 2 (12/Out): fogo, fumaça e as faixas de uma timeline de edição
    fogo: '#FF7A1A', fogo_nucleo: '#FFE7B0', fogo_borda: '#C8320E', brasa: '#FFB04A', carvao: '#1E0F07', fumaca: '#191513',
    faixa_video: '#6448E0', faixa_video2: '#4C7BE8', faixa_texto: '#FE572A', faixa_audio: '#2FBF8F',
    fundo_app: '#0B0D16', fundo_app2: '#151827',   // fundo de tela de app (bastidor, pilha)
    recorte: '#FFFFFF',        // borda do adesivo recortado e tinta da escrita à mão sobre o fundo (frente 3)
    fundo_adesivo: '#2A2F6B',  // fundo de raios atrás do adesivo (frente 3): tom fundo da segunda cor
  },
  fontes: {
    titulo: 'Instrument Serif', titulo_italico: true,          // prefixo/sufixo do hodômetro, palavra-destaque do holofote
    display: 'Hedvig Letters Serif', display_caixa_alta: true, // palavras grandes do holofote
    corpo: 'Hedvig Letters Sans',                              // itens, comentário, resposta, botão
    mono: 'Geist Mono',                                        // rótulos, placar, dígitos, nomes
    display_ref: 'Inter Tight',                                // holofote com "fonte_estilo": "referencia" (grotesca preta, caixa baixa)
    mao: 'Caveat',                                             // anotação escrita à mão (adesivo, frente 3)
  },
  pesos: { titulo: 400, display: 400, corpo: 400, corpo_forte: 500, mono: 500, display_ref: 900 },
  pesos: { titulo: 400, display: 400, corpo: 400, corpo_forte: 500, mono: 500, mao: 600 },
  tracking: { mono: 1, display: 1 },  // multiplica o espaçamento entre letras
  raio: 1,                            // multiplica todos os cantos arredondados (0 = cantos retos)
  vidro: { tinta: 1, brilho: 1, desfoque: 1 },  // intensidade do vidro fosco (multiplicadores)
  visto: 'circulo',                   // "circulo" | "quadrado": a marca do checklist
  traco: 1,                           // espessura do visto e dos ícones
  celular: { corpo: '#2C2E35', metal: 0.88, aspereza: 0.34, reflexo: 0.16, luz_chave: '#FFF1E2' },
  arquivos: [],                       // fontes do preset: [família, arquivo em assets/fonts, peso, estilo]
};

const ehObj = v => v && typeof v === 'object' && !Array.isArray(v);
export function mescla(a, b) {
  if (!ehObj(b)) return a;
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = ehObj(v) && ehObj(a[k]) ? mescla(a[k], v) : v;
  return o;
}
// "#RRGGBB" + alfa → "rgba(r,g,b,a)"; aceita #RGB; cor já em rgb()/rgba() volta como está
export function rgba(cor, a = 1) {
  if (!cor || cor[0] !== '#') return cor;
  let h = cor.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// resolve a marca do projeto (preset servido em /marcas/ + ajustes) e carrega as fontes do preset
export async function carregaMarca(ED, { getJ, falha }) {
  let M = PADRAO;
  const m = ED.marca;
  if (typeof m === 'string' && m !== 'nomics') {
    const preset = await getJ(`/marcas/${m}.json`, true);
    if (preset) M = mescla(M, preset); else falha(`marca "${m}" não achada em motor/marcas/`);
  } else if (ehObj(m)) M = mescla(M, m);
  M = mescla(M, ED.marca_ajuste);
  for (const [fam, arq, peso, estilo] of M.arquivos || []) {
    const f = new FontFace(fam, `url(/fonts/${arq})`, { weight: peso || '400', style: estilo || 'normal' });
    try { await f.load(); document.fonts.add(f); } catch (e) { falha(`fonte da marca não carregou: ${arq}`); }
  }
  return M;
}

// ================================================================== B: utilidades de um compositor
export function criaBase(api) {
  const { W, H, clamp, ancora, idxEm, FPS, MARCA } = api;
  const B = { ...api, rgba, mescla, gsap: null, TOPO: null };
  let T = MARCA;   // tema da cena em uso: rr, vidro e as fontes leem daqui

  // tema da cena: o efeito chama no começo de cada preparar/timeline/desenhar → { T, K: cores, F: fontes }
  B.usa = c => { T = (c && c._T) || MARCA; return { T, K: T.cores, F: T.fontes }; };

  // ---- tempo
  B.usaGsap = async () => {
    if (B.gsap) return B.gsap;
    if (!window.gsap) await new Promise((ok, ruim) => { const s = document.createElement('script'); s.src = new URL('../vendor/gsap-3.15.0.min.js', import.meta.url).href; s.onload = ok; s.onerror = () => ruim(new Error('gsap não carregou')); document.head.appendChild(s); });
    const gsap = B.gsap = window.gsap; gsap.ticker.lagSmoothing(0); gsap.config({ nullTargetWarn: false }); gsap.ticker.sleep();
    return gsap;
  };
  B.linha = () => B.gsap.timeline({ paused: true, defaults: { immediateRender: true } });
  B.seek = (c, t) => c._tl.seek(Math.max(0, t - c.t0), false);
  B.seg = (t, a, b) => clamp((t - a) / (b - a));
  B.eOut = v => 1 - Math.pow(1 - v, 3);
  B.eExpo = v => (v >= 1 ? 1 : 1 - Math.pow(2, -10 * v));
  B.rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let q = Math.imul(a ^ (a >>> 15), 1 | a); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; };
  // âncora de fala: número (s do vídeo) ou palavra ("auto zoom#1"); fim = true pega o fim da palavra
  B.tempo = (q, fim = false) => (typeof q === 'number' ? q : ancora(q, fim));

  // ---- telas de rascunho (uma de cada, reaproveitadas)
  const canvas = () => { const c = new OffscreenCanvas(W, H); return c.getContext('2d'); };
  let _ga = null, _gp = null, _gs = null;
  B.ga = () => (_ga || (_ga = canvas()));
  B.gp = () => (_gp || (_gp = canvas()));
  B.gsnap = () => (_gs || (_gs = canvas()));
  B.reset = g => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowColor = 'transparent'; g.clearRect(0, 0, W, H); };

  // ---- recorte e parede
  // transformação quadro-fonte → tela do quadro atual (gravada pelo desenhaVideo do compositor)
  B.naParede = (g, V) => g.setTransform(V.k, 0, 0, V.k, V.X - V.sx * V.k, V.Y - V.sy * V.k);
  // topo da cabeça na janela da cena (fração do quadro-fonte), da medição do mascaras.py
  B.cabeca = c => {
    const qs = []; if (B.TOPO) for (let t = c.t0; t <= c.t1; t += 1 / FPS) { const q = B.TOPO.q[idxEm(t) - 1]; if (q) qs.push(q); }
    const med = i => { const a = qs.map(q => q[i]).sort((p, q) => p - q); return a.length ? a[a.length >> 1] : null; };
    return { topo: med(0) ?? 0.36, cx: med(1) ?? 0.5 };
  };

  // ---- desenho (leem o tema da cena em uso)
  B.rr = (g, X, Y, w, h, r) => { g.beginPath(); g.roundRect(X, Y, w, h, Math.max(0, Math.min(r * T.raio, h / 2, w / 2))); };
  // vidro fosco: o próprio fundo, desfocado e escurecido, dentro do retângulo arredondado
  B.vidro = (g, fonte, X, Y, w, h, r, { desfoque = 26, brilho = 0.62, tinta = T.cores.vidro, alfa = 0.42 } = {}) => {
    const V = T.vidro, K = T.cores;
    g.save(); B.rr(g, X, Y, w, h, r); g.clip();
    if (fonte) { g.filter = `blur(${desfoque * V.desfoque}px) brightness(${brilho * V.brilho}) saturate(1.1)`; g.drawImage(fonte, 0, 0, W, H); g.filter = 'none'; }
    g.fillStyle = rgba(tinta, Math.min(1, alfa * V.tinta)); g.fillRect(X, Y, w, h);
    const lg = g.createLinearGradient(X, Y, X, Y + h); lg.addColorStop(0, rgba(K.realce, 0.10)); lg.addColorStop(0.35, rgba(K.realce, 0.02)); lg.addColorStop(1, rgba(K.realce, 0));
    g.fillStyle = lg; g.fillRect(X, Y, w, h);
    g.restore();
    g.save(); B.rr(g, X + 0.75, Y + 0.75, w - 1.5, h - 1.5, r); g.lineWidth = 1.5;
    const bg = g.createLinearGradient(X, Y, X, Y + h); bg.addColorStop(0, rgba(K.borda, 0.26)); bg.addColorStop(1, rgba(K.borda, 0.07));
    g.strokeStyle = bg; g.stroke(); g.restore();
  };
  B.fonte = (g, peso, tam, fam, italico = false, track = 0) => { g.font = `${italico ? 'italic ' : ''}${peso} ${tam}px "${fam}"`; g.letterSpacing = `${track * tam}px`; };
  B.fMono = (g, tam, track = 0) => B.fonte(g, T.pesos.mono, tam, T.fontes.mono, false, track * T.tracking.mono);
  B.fCorpo = (g, tam, forte = false, track = 0) => B.fonte(g, forte ? T.pesos.corpo_forte : T.pesos.corpo, tam, T.fontes.corpo, false, track);
  B.fTitulo = (g, tam, track = 0) => B.fonte(g, T.pesos.titulo, tam, T.fontes.titulo, T.fontes.titulo_italico, track);
  B.fDisplay = (g, tam, track = 0) => B.fonte(g, T.pesos.display, tam, T.fontes.display, false, track * T.tracking.display);
  B.fRef = (g, tam, track = 0) => B.fonte(g, T.pesos.display_ref ?? 900, tam, T.fontes.display_ref || 'Inter Tight', false, track);
  // grão fixo (semente própria, 256 px, repetido): escuro sem grão vira CGI
  let _grao = null;
  B.grao = () => {
    if (_grao) return _grao;
    const n = 256, cv = new OffscreenCanvas(n, n), g = cv.getContext('2d'), im = g.createImageData(n, n), r = B.rng(7);
    for (let i = 0; i < n * n; i++) { const v = 128 + (r() + r() + r() - 1.5) * 110; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); return (_grao = cv);
  };
  B.fMao = (g, tam) => B.fonte(g, T.pesos.mao ?? 600, tam, T.fontes.mao || 'Caveat', false, 0);
  return B;
}
