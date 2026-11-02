# Efeitos extras (opcional)

## 0 · Antes: os efeitos prontos
Print vivo em 3D, tela do assunto, checklist, holofote, comentário, número que conta, hodômetro, caixa, logo no traço,
texto cinético, antes e depois e timeline em chamas já vêm prontos, com a frase que pede cada um:
[Efeitos prontos](10-efeitos-prontos.md). Este guia é para o que nem eles fazem.

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
`seg`, `eOut`, `eBack`, `clamp`, `rr`, `img`, `logo`, `titulo`, `rotulo`, `quadroSeq` e `FPS`. Use `ancora` para o tempo:
nada de segundo chutado. Os três ganchos podem ser `async` (o motor espera cada um): é o que deixa uma cena carregar um
quadro de uma sequência por vez com `quadroSeq('/p/pasta/00012.png')`, que guarda só os últimos 12 na memória.

## 1b · Fogo de verdade (filmagem real, não desenho)
Para queimar um papel com a headline, um logo ou a tela inteira com fogo filmado:
1. Baixe uma filmagem grátis de papel queimando em **fundo verde** (Pexels, por exemplo "burning paper green background";
   anote a licença). O papel tem de começar inteiro (escuro) e o verde aparecer conforme queima.
2. Gere as camadas: `.venv/bin/python motor/fogo_real.py <clip.mp4> <projeto>/assets/fogo/<nome> --largura 900 --altura 360
   --acima 260 --de 1.8 --ate 9.4 --velocidade 3.5 --espelhar`. `--de/--ate` = do primeiro fogo até quase tudo verde;
   `--velocidade` acelera; `--zoom` e `--foco X Y` põem o ponto onde o fogo nasce onde você quer (o isqueiro, por exemplo);
   `--acabar S` some com o que sobrou quando o trecho não queima tudo. O script diz em quantos segundos a caixa queima toda.
3. No `extra.js`: `import { FogoReal } from '/comp/efeitos/fogo_real.js';`, prepare com `c._fogo = await FogoReal(api,
   'assets/fogo/<nome>')` e, numa cena `async draw`, `await c._fogo.desenha(x, G, t - t_queima, { x, y, rot, esc, sombra })`,
   onde `G` é um canvas do tamanho da caixa com o que vai queimar. Antes de `t_queima` o desenho aparece inteiro; depois,
   queima com a borda em carvão e as chamas da filmagem por cima (mistura "screen"). Para a tela inteira, copie a tela em `G`,
   desenhe por baixo o que deve aparecer e queime `G` por cima.

## 2 · HyperFrames (catálogo aberto de efeitos)
[HyperFrames](https://github.com/heygen-com/hyperframes) (Apache 2.0, HeyGen) monta vídeo a partir de HTML e tem um
catálogo público de transições, legendas animadas e gráficos. Use só quando a pessoa pedir um efeito que o motor
não faz, e só para **aquela cena**:
1. Peça permissão e explique em uma frase que vai instalar uma ferramenta extra.
2. `HYPERFRAMES_NO_TELEMETRY=1 npx hyperframes@0.8.104 ...` (versão travada; não use a mais nova sem testar).
3. Renderize a cena com fundo transparente (`--format webm`), extraia os quadros em PNG e entre no vídeo
   pelo `extra.js` (`img()` quadro a quadro) ou como `imagem` `modo: solto`.
4. Confira o quadro antes do render inteiro, como toda tela.
