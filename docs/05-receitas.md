# Receitas de edição

Cada receita diz quando usar, o ritmo, o que entra na tela e o erro que mata o vídeo.
Os números são faixas, não regra fixa: a referência da pessoa manda mais que a receita.

## Rosto e ideia
**Quando:** opinião, tese, notícia comentada. O rosto conta a história; a tela reforça a frase forte.
- Rosto cheio (`cheio`) quase o tempo todo. O zoom alterna entre dois enquadramentos a cada frase (`zoom: [1.0, 1.12]`).
- A cada 4 a 8 s, uma tela entra na palavra: `frase` (a frase forte por cima do vídeo, palavra a palavra na fala),
  `card` com a ideia, `logos` da marca citada, `numero` quando ela diz um dado.
- Respiro: 1 a 2 s em `escuro` ou `claro` com uma `frase` grande, no ponto mais importante do vídeo.
- Foto forte e literal da metáfora (`imagem` `modo: cheia`), se ela tiver: iceberg, xadrez, multidão. Nada abstrato.
- **Erro que mata:** tela em todo segundo. O rosto é o protagonista.

## Tela dividida
**Quando:** explicar ferramenta, método, passo a passo. Cada coisa citada vira um objeto na tela.
- `split` (assunto em cima, rosto grande embaixo) em ~2/3 do tempo, `cheio` no resto. Troca a cada 3 a 5 s, corte seco.
- Em cima: `titulo` de seção (rótulo + título com uma palavra em destaque), um `card` ou `imagem` (print) por assunto,
  entrando pela direita (`"entrada": "direita"`) como carrossel. `lista` quando ela enumera. `numero` quando cita dado.
- Post ou página em inglês vira `citacao` TRADUZIDA (`"traduzido": true`); o print original fica em `assets/` como prova.
- Um `titulo` de seção fixo no topo enquanto o assunto dura (4 a 9 s), e o print ou card embaixo dele. O título amarra
  o que a pessoa está vendo ao que está ouvindo.
- O card ocupa a largura (0,88 a 0,92). Fundo de cima vazio por mais de ~1 s é tela morta.
- Rosto grande: `divisao` entre 0,47 e 0,5. Janela pequena deixa o rosto minúsculo no celular.
- **Erro que mata:** cards pequenos boiando no fundo e rosto espremido.

## Motion de produto
**Quando:** lançamento, comparação, número forte. O gráfico domina e cada frase é uma pequena demonstração.
- Fundo `claro` a maior parte do tempo, `split` quando o rosto precisa aparecer, rosto cheio só em lampejos (< 1 s).
- Corte a cada 1,5 a 2,5 s. Pausas quase todas fora (`gapmax: 0.25`).
- Cada frase = um movimento só: `comparativo` (bom × ruim), `numero`, `lista` acendendo no ritmo da fala, `logos`.
- Legenda `marca-texto` (até 5 palavras, a cor da marca varrendo cada palavra enquanto é dita).
- **Erro que mata:** duas animações ao mesmo tempo. Uma coisa se mexe por vez.

## Conversa crua
**Quando:** bastidor, recado, papo com a audiência. Parece conversa, não produção.
- Rosto cheio do começo ao fim, `"acabamento": "cru"` (grão de filme leve, vinheta, tom levemente quente).
- Poucas imagens (3 a 5 no vídeo todo), recortadas no essencial (o trecho do print, não a tela inteira), com
  `"fita": true` e `"inclinacao"` entre -5 e 5, nos cantos de cima, sem cobrir o rosto.
- Legenda palavra a palavra.
- **Erro que mata:** cara de anúncio. Nada de card brilhante aqui.

## Bastidor de tela
**Quando:** trabalho acontecendo (gravação de tela + rosto).
- Gravação de tela com `"enquadrar": "conter"` (cabe inteira), rosto com `"cobrir"`.
- Pausas acima de 0,5 s saem; fala longa a 1,15 a 1,2× (`speed`); tela sem fala a 2 a 6× com um `selo` ("acelerado").
- Etapas numeradas no topo (`selo` "1 · Abri o painel").
- Dado sensível na tela: corte o trecho ou peça outra gravação. Não invente tarja sobre número que você não conferiu.
- **Erro que mata:** tela pequena e ilegível no celular. Se não dá para ler, aproxime (`zoom`) ou corte.

## Para todas
- **Print sempre recortado no essencial.** Página inteira ou tabela larga fica ilegível no celular. Recorte só o trecho
  que ela cita (`ffmpeg -i print.png -vf "crop=LARGURA:ALTURA:X:Y" print-recorte.png`) e salve em `assets/`. Tabela:
  fique com a coluna dos nomes e a coluna que importa. Texto do print com menos de ~40 px no quadro final não se lê no
  celular: recorte mais ou troque o print por um `card` com o dado (citando a fonte no `projeto.md`).
- Gancho nos 3 primeiros segundos: a primeira frase dela, sem respiro antes. Se ela enrola no começo, comece na frase forte.
- Ritmo médio de fala: 2,8 a 3,2 palavras por segundo depois do corte. Abaixo disso, o vídeo arrasta.
- Duração: o que o conteúdo pede. Corte repetição, não ideia.
- Som: voz limpa e nivelada antes de qualquer efeito. Efeito sonoro só na entrada de elemento, baixinho.
- Música (se ela mandar): entra baixa e abaixa sozinha quando ela fala (`edicao.trilha`).
