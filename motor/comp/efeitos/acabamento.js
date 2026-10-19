// EFEITOS NATIVOS · ACABAMENTO · utilidades de cor que os efeitos dividem (versão aberta: só o que os efeitos daqui usam).
//   import { mix } from './acabamento.js';

// mistura duas cores hex: mix('#000000', '#FFFFFF', 0.5) → '#808080'
export function mix(a, b, t) {
  const p = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const A = p(a), C = p(b); return '#' + A.map((v, i) => Math.round(v + (C[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
