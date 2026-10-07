# Os arquivos de um projeto de edição

Uma pasta por vídeo em `edicoes/<AAAA-MM-DD>-<slug>/`:

```
projeto.json     o vídeo bruto + as escolhas da edição
edl.json         a lista de cortes (escrita depois do plano aprovado)
cenas.json       o que entra na tela, ancorado na fala
extra.js         opcional: cena sob medida (efeitos-extras.md)
assets/          prints, fotos e logos deste vídeo
referencia/      gerado: ficha e folhas da referência
leitura.md       gerado: a fala em frases com tempo
projeto.md       você escreve: o plano, as decisões e cada rodada
transcricoes/    gerado: cache da transcrição
qa/              gerado: folhas de contato e relatório da conferência
_build/          gerado: quadros, voz, linha do tempo
<saida>.mp4      o vídeo final
```

## projeto.json

```json
{
  "titulo": "3 erros de quem lança perpétuo",
  "saida": "3-erros-v1",
  "brutos": [ { "id": "v1", "arquivo": "meus-videos/IMG_2231.MOV" } ],
  "edicao": {
    "receita": "tela-dividida",
    "legenda": "palavra",
    "cor": "destaque",
    "zoom": [1.0, 1.12],
    "divisao": 0.48,
    "escurecer": 0.18,
    "acabamento": null,
    "trilha": "meus-videos/trilha.mp3"
  }
}
```
- `brutos`: um ou mais arquivos (ex.: a pessoa gravou em duas partes). `arquivo` aceita caminho do projeto, absoluto ou `~/`.
  O `preparar.py` completa cada um com duração, tamanho, fps e onde está o rosto.
- `legenda`: `palavra` · `marca-texto` · `nenhuma`. Ajuste fino: `"legenda_ajuste": { "tamanho": 96, "y": 0.8 }`.
- `cor`: cor de destaque das telas: `destaque`, `cor2`, `cor3` (da marca) ou um hex (`"#00A86B"`).
- `zoom`: os dois enquadramentos que alternam a cada frase. `foco: [x, y]` (0 a 1) força o centro; sem ele, usa o rosto.
- `divisao`: onde a tela dividida corta (0,47 a 0,5). `zoom_split`: aproximação do rosto no split (1,0 a 1,1; selfie
  com o rosto já grande, como no carro: 1,0). `subir_rosto`: sobe o rosto dentro da metade de baixo (0 a 0,12).
  `legenda_split_dy`: desce (+) ou sobe (-) a legenda no split em relação ao queixo (padrão 0,035). `fundo_split`: `claro` ou `escuro`.
- `escurecer`: sombra no pé do vídeo para a legenda ler (0 a 0,4).
- `acabamento`: `"cru"` = grão de filme, vinheta e tom quente (receita Conversa crua).
- `trilha`: música opcional; entra baixa e abaixa sozinha quando a pessoa fala.
- `formato`: só para horizontal: `{ "largura": 1920, "altura": 1080 }`. Sem isso, 1080×1920.
- `paleta` e `fontes`: trocam as da marca só neste vídeo (mesmo formato de `minha-marca/marca.json`).

## minha-marca/marca.json (uma vez, vale para todos os vídeos)

```json
{
  "nome": "Academia X",
  "cores": { "destaque": "#FF5A1F", "cor2": "#2F6BFF", "cor3": "#1BA97A",
             "claro": "#F5F3EF", "escuro": "#111214", "tinta": "#16171A", "suave": "#6E6F76" },
  "fontes": {
    "titulo":  ["Playfair Display", "playfair-700.woff2", "700"],
    "texto":   ["Inter Tight", "inter-tight-500.woff2", "500"],
    "legenda": ["Inter Tight", "inter-tight-800.woff2", "800"]
  },
  "logo": "logo.png"
}
```
Arquivos de fonte (`.woff2`) e logo ficam em `minha-marca/`. Só fonte com licença livre ou que a pessoa comprou.
Sem marca: o visual neutro (Fraunces, Manrope, JetBrains Mono; laranja de destaque).

## edl.json (os cortes)

Tempos em segundos **do bruto** (leia no `leitura.md`). A ordem dos trechos é a ordem do vídeo final.

```json
{
  "gapmax": 0.45,
  "ritmo": 1.0,
  "fix": { "Ana Lia": "Analía" },
  "juntar": [["GPT", "6", "GPT-6"]],
  "bips": ["Fulano"],
  "audio": { "limpeza": "padrao", "zumbido": [] },
  "trechos": [
    { "bruto": "v1", "a": 0.0, "b": 8.6 },
    { "bruto": "v1", "a": 8.8, "b": 17.05, "skip": [[9.0, 9.7]] },
    { "bruto": "v1", "a": 17.35, "b": 27.25, "zoom": "fixo" },
    { "bruto": "tela", "a": 3.0, "b": 15.0, "fala": false, "speed": 3, "enquadrar": "conter" }
  ]
}
```
- `gapmax`: pausa interna maior que isso sai (0,25 rápido · 0,45 normal · 0,6 conversa).
- `ritmo`: velocidade de todos os trechos (padrão 1,0). Só mude se a pessoa pedir o vídeo mais rápido (até 1,1).
- `skip`: pedaços de TEMPO que saem de dentro do trecho (tropeço, repetição, hesitação escondida em palavra `esticada` no `leitura.md`).
- Palavra esticada por cima de hesitação engana o `skip` (a palavra certa some junto). Retranscreva só o trecho
  (`ffmpeg -ss A -to B -i bruto trecho.wav` + `motor/transcrever.py`), corrija o tempo dela em
  `transcricoes/<id>.palavras.json` (guarde o original) e rode o `base.py` de novo. O `checar_voz.py` mostra se sumiu algo.
- `speed`: acelera sem mudar o tom da voz (1,1 a 1,2 em fala longa; 2 a 6 em tela sem fala).
- `fala: false`: trecho sem áudio (gravação de tela). `enquadrar`: `cobrir` (preenche) ou `conter` (cabe inteiro).
- `layout`: `cheio` · `split` · `claro` · `escuro` (ou troque pela fala, no `cenas.json`).
- `audio.limpeza`: `leve` · `padrao` (voz clara, bom para carro e celular) · `neutro` · `forte` (muito ruído).
  `zumbido`: frequências de ruído constante (ar-condicionado), ex.: `[60, 120]`.
- `fix` / `juntar`: corrigem a transcrição na legenda. Erro que se repete em todo vídeo vai em `motor/glossario.json`.

## cenas.json (o que entra na tela)

`quando` e `ate`: segundos do vídeo final **ou** a fala: `"Claude#2"` (a segunda vez que ela diz Claude),
`"os três erros"` (sequência de palavras), `"assin*"` (prefixo). A cena sai quando a palavra do `ate` **começa**;
`ate_fim` sai quando ela termina; sem os dois, fica `dur` segundos (padrão 2,6). `y` = altura do topo da cena (0 a 1).
Para contar o `#n`, procure a palavra no `leitura.md` **ignorando acento e maiúscula** ("aí" conta igual a "AI", "é" igual a "e"); errou a conta, o `render.mjs --qa` avisa "âncora não achada".
Cena com `quando: 0` aparece já inteira no primeiro quadro (é a capa do reels). Cena que termina a menos de 0,6 s do fim
fica até o último quadro, sozinha.

```json
{
  "layouts": [ { "quando": 0, "layout": "cheio" }, { "quando": "primeiro erro", "layout": "split" } ],
  "cenas": [
    { "tipo": "titulo", "rotulo": "Erro 1", "texto": "Lançar sem oferta validada", "destaque": "validada",
      "quando": "primeiro erro", "ate": "segundo erro", "y": 0.07 },
    { "tipo": "card", "rotulo": "O que acontece", "titulo": "Tráfego caro e ninguém compra", "destaque": "ninguém",
      "sub": "linha de apoio opcional", "logo": "meta", "quando": "tráfego", "ate": "segundo", "y": 0.2 },
    { "tipo": "imagem", "src": "assets/print.png", "moldura": true, "entrada": "direita", "quando": "olha esse", "y": 0.18 },
    { "tipo": "imagem", "src": "assets/foto.jpg", "modo": "cheia", "quando": "iceberg", "dur": 2 },
    { "tipo": "imagem", "src": "assets/produto.png", "modo": "solto", "largura": 0.42, "quando": "produto", "y": 0.3 },
    { "tipo": "imagem", "src": "assets/dm.png", "fita": true, "inclinacao": -3, "largura": 0.6, "quando": "mensagem", "y": 0.08 },
    { "tipo": "frase", "texto": "ninguém compra o que não entende", "destaque": "entende", "quando": "ninguém compra", "y": 0.2 },
    { "tipo": "numero", "valor": "37%", "legenda": "de conversão", "quando": "trinta e sete", "y": 0.3 },
    { "tipo": "logos", "logos": ["claude", "openai"], "quando": "Claude#1", "ate": "OpenAI#1", "y": 0.24 },
    { "tipo": "logo", "logo": "meta", "quando": "Meta", "y": 0.25 },
    { "tipo": "selo", "texto": "Opinião", "quando": 0.2, "dur": 2.4, "y": 0.09 },
    { "tipo": "lista", "titulo": "Os 3 erros", "itens": ["Oferta", "Público", "Página"], "destaque": "fala", "passo": 1.6, "quando": "três erros" },
    { "tipo": "comparativo", "a": { "nome": "Com oferta", "valor": "vende", "bom": true }, "b": { "nome": "Sem oferta", "valor": "trava" }, "quando": "diferença" },
    { "tipo": "citacao", "nome": "Fulano", "handle": "@fulano", "verificado": true, "avatar": "assets/av.png",
      "texto": "tradução fiel do post", "destaque": "trecho em marca-texto", "data": "3 de out de 2026",
      "traduzido": true, "entrada": "direita", "quando": "ele postou", "ate": "mas", "y": 0.08 }
  ],
  "enfase": [ { "quando": "nunca#1", "escala": 1.4 } ]
}
```
- `titulo`: cabeçalho sem caixa, para o topo do `split` ou do fundo `claro`/`escuro` (`"escuro": true` no fundo escuro).
  Tamanho no split: 110 a 130 (padrão 84 deixa a metade de cima vazia). Sozinho no fundo: 130 a 160.
- **Tela dividida:** tudo que fica em cima precisa terminar antes da divisão: `y + altura_max ≤ divisao` (ex.: `y 0.1`,
  `altura_max 0.34` com divisão 0,48). O `--qa` avisa quando uma imagem invade o rosto.
- `imagem` `modo`: `card` (padrão) · `cheia` (ocupa a tela) · `solto` (PNG recortado). `entrada`: `direita`/`esquerda`.
- `frase` `fundo`: `video` (escurece atrás) · `claro` · `escuro` (use com o layout igual). Se o texto for a fala
  literal, cada palavra entra no tempo em que é dita.
- `lista` com `"destaque": "fala"` acende o item dito, um a cada `passo` segundos.
- `citacao`: `origem` padrão `x`; página de site: `"origem": "blog.google"` + `logo`. `fica_ate`: o card recua e
  fica atrás do próximo até essa palavra.
- `enfase`: palavra da legenda maior e em outra cor (use em 3 a 5 palavras no vídeo todo, não mais).
- Logos prontos (`motor/logos/`): openai, claude, anthropic, gemini, google, deepseek, meta, grok, xai, perplexity,
  cursor, github, notion, figma, n8n, midjourney, runway, kling, elevenlabs, lovable, vercel, v0, manus, mistral,
  qwen, huggingface. Logo real só de marca que a pessoa citou.
