# Efeitos extras (opcional)

As telas prontas do motor cobrem a maior parte dos vídeos. Quando a pessoa pede algo que elas não fazem
(transição de vidro quebrando, gráfico subindo animado, texto com efeito especial), há dois caminhos.

## 1 · Cena sob medida (extra.js)
Para uma cena simples desenhada em canvas: crie `edicoes/<pasta>/extra.js`. O motor chama três ganchos:
```js
export default (api) => ({
  fundo(t, s, layout) {},          // desenha logo depois do vídeo, antes das telas
  cena(c, t, s) { return false },  // desenha um tipo novo de cena; devolva true se desenhou
  frente(t, s, layout) {},         // desenha por cima das telas, antes da legenda
});
```
`api` traz `x` (o canvas), `W`, `H`, `C` (cores), `F` (fontes), `words` (fala com tempo), `ancora("palavra#1")`,
`seg`, `eOut`, `eBack`, `clamp`, `rr`, `img`, `logo`, `titulo`, `rotulo`. Use `ancora` para o tempo: nada de segundo chutado.

## 2 · HyperFrames (catálogo aberto de efeitos)
[HyperFrames](https://github.com/heygen-com/hyperframes) (Apache 2.0, HeyGen) monta vídeo a partir de HTML e tem um
catálogo público de transições, legendas animadas e gráficos. Use só quando a pessoa pedir um efeito que o motor
não faz, e só para **aquela cena**:
1. Peça permissão e explique em uma frase que vai instalar uma ferramenta extra.
2. `HYPERFRAMES_NO_TELEMETRY=1 npx hyperframes@0.8.104 ...` (versão travada; não use a mais nova sem testar).
3. Renderize a cena com fundo transparente (`--format webm`), extraia os quadros em PNG e entre no vídeo
   pelo `extra.js` (`img()` quadro a quadro) ou como `imagem` `modo: solto`.
4. Confira o quadro antes do render inteiro, como toda tela.
