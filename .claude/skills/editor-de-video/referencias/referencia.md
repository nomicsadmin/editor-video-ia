# Como ler a referência

A referência é o atalho mais forte que a pessoa pode te dar. Ela mostra o que "ficar foda" significa para ela.

## O que medir
Rode `motor/referencia.py` (link ou arquivo). Ele devolve duração, cortes por minuto, o tempo de cada bloco (mediana,
mais curto, mais longo), primeiro corte, palavras por minuto, % do tempo com o rosto cheio / embaixo (tela dividida) /
sem rosto (print, card, gravação), zooms por minuto, se tem música por baixo e efeitos sonoros por minuto. Depois
**olhe** `folha.jpg` e `cortes.jpg`: legenda, cards, prints e cor só se veem olhando.

## Estilo salvo (de 1 a 6 referências)
Quando a pessoa quer que o editor "aprenda" um jeito de editar ("salva esse estilo", "quero editar sempre assim"):
1. Pergunte o nome (uma palavra: `rapido`, `aula`, `meu-jeito`) e peça de 1 a 6 referências editadas do mesmo jeito.
   Três ou mais dão uma média confiável; uma só vira a cópia daquele vídeo.
2. `$PY motor/referencia.py <ref1> ... <ref6> --estilo <nome>` → `minhas-referencias/estilos/<nome>.json` (medido =
   mediana das referências, faixa entre elas, e a tradução para a edição em `edicao`), `<nome>.md` (a folha legível) e
   `<nome>.jpg` (os quadros depois de cada corte de todas).
3. Olhe `estilos/<nome>/ref-N/folha.jpg` e `cortes.jpg` e preencha `visto` no JSON: `legenda_tipo` (`palavra` ou
   `marca-texto`), `legenda` (como é: "branca, uma palavra, serifa, no queixo"), `cards_texto_pct`, `prints_pct`,
   `cor_destaque`, `fundo`, `movimento`, `observacoes` (o que dá o jeito dela: "print sempre em janela", "número grande
   em toda cifra"). Rode `$PY motor/referencia.py --folha <nome>` e mostre o `.md` para a pessoa em 4 linhas.
4. Depois é só "edita no estilo <nome>": `$PY motor/referencia.py --aplicar <nome> edicoes/<pasta>` grava o estilo no
   `projeto.json` e devolve as metas (receita, `gapmax` para o edl, tela nova a cada X s, % de tela dividida, efeitos
   por minuto, som). Siga as metas no plano e no `cenas.json`; o "visto" diz como as telas devem parecer.
- Música da referência não vira música no vídeo: aqui só entra se a pessoa pedir.
- As medidas são estimativa (🟡): diga "mais ou menos" para a pessoa e confirme olhando as folhas.

## O que olhar nas imagens
1. **Onde está o rosto:** tela cheia, metade de baixo, janela pequena, some?
2. **O que aparece na tela:** prints, cards, números grandes, fotos, interface, texto solto.
3. **Legenda:** uma palavra ou frase? serifa ou sem serifa? maiúscula? com marca-texto? onde fica?
4. **Cor e fundo:** fundo claro, escuro, papel, gradiente? qual a cor de destaque?
5. **Movimento:** as coisas entram deslizando, pulando, aparecendo? há zoom no rosto?
6. **Som** (se ouvir): música alta ou baixa? efeito em cada entrada?

## A ficha (o que você mostra para a pessoa)
Curta, sem jargão. Exemplo:
> "Essa referência corta a cada 2 segundos, mais ou menos. O rosto fica na metade de baixo e em cima entra um print
> por assunto. A legenda é uma palavra por vez, grande, branca. A cor de destaque é laranja. O mais parecido nas
> nossas receitas é a **Tela dividida**. Vou seguir esse ritmo com as suas cores."

Depois pergunte: "O que você mais gostou nela?" `1 ritmo · 2 legenda · 3 tela dividida · 4 as imagens entrando · 5 tudo`

## Limites
- Copie o **jeito**, nunca a marca, o rosto, a voz ou o texto de outra pessoa.
- Se a referência usa algo que o motor não faz, diga com sinceridade e ofereça o mais próximo: muita coisa já está nos
  efeitos prontos (`efeitos-prontos.md`: print em janela 3D, texto atrás da pessoa no holofote, número que conta,
  checklist na parede, comentário). Efeito especial pontual: `efeitos-extras.md`.
- Link baixa sozinho: o script tenta sem login e, se o Instagram pedir, usa o login do Chrome (ou Firefox) da pessoa,
  só neste computador. Na primeira vez o Mac pode pedir a senha do Chaveiro; diga que é normal. Só se mesmo assim
  falhar (post privado, navegador sem login), peça o arquivo do vídeo ou 3 prints.
