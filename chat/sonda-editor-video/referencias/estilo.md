# Estilo da legenda a partir de uma referência

A pessoa pode mandar um print ou um vídeo curto de um reels com a legenda que ela gosta.
Rode `sonda.py referencia --ref <arquivo>`, abra a imagem `sonda-referencia.png` que ela gera e preencha
um `estilo.json` olhando a legenda da referência. Só preencha o que der para ver; o resto fica no padrão.

| Campo | Valores | Como ler na referência |
|---|---|---|
| `modo` | `palavra` · `blocos` · `normal` | uma palavra por vez · 2 a 4 palavras com uma em destaque · frase inteira em 1 ou 2 linhas |
| `fonte` | `manrope` · `montserrat` · `anton` · `bebas` · `poppins` · `bricolage` · `instrument` | a mais parecida: grotesca larga e pesada = `montserrat`; condensada = `anton` ou `bebas`; redonda = `poppins`; com serifa = `instrument`; neutra moderna = `manrope` |
| `caixa` | `auto` · `alta` · `normal` | tudo maiúsculo = `alta`; maiúsculas e minúsculas = `normal` |
| `cor` | `#RRGGBB` | cor da maioria das letras |
| `destaque` | `#RRGGBB` ou `null` | cor da palavra que está sendo falada; `null` se não muda de cor |
| `apagadas` | 0 a 1 | se as outras palavras ficam mais fracas, a opacidade delas (ex. 0.6); 1 = iguais |
| `contorno` | px (0 a 10) | traço em volta das letras; 0 = sem traço |
| `cor_contorno` | `#RRGGBB` | cor do traço |
| `sombra` | `suave` · `dura` · `nenhuma` | sombra esfumada · sombra recortada deslocada · sem sombra |
| `fundo` | `#RRGGBB` ou `null` | tarja/caixa atrás do texto e a cor dela |
| `fundo_opacidade` | 0 a 1 | quanto a tarja tapa o vídeo |
| `altura` | 0 a 1 | onde fica o pé do texto: 0.5 = meio da tela, 0.73 = terço de baixo, 0.85 = bem embaixo |
| `tamanho` | 0.6 a 1.6 | maior ou menor que o padrão |
| `animacao` | `pop` · `fade` · `nenhuma` | palavra que salta · aparece suave · entra seca |

Exemplo (tarja escura, letra creme, palavra da vez em laranja):

```json
{"modo": "blocos", "fonte": "manrope", "caixa": "normal", "cor": "#F3EEE7", "destaque": "#FF5500",
 "contorno": 0, "sombra": "nenhuma", "fundo": "#0B0604", "fundo_opacidade": 0.82, "altura": 0.72}
```

Depois de preencher, mostre à pessoa em uma frase o que você entendeu ("tarja escura, letra creme, palavra da vez
em laranja, fonte parecida com a Manrope") e rode `fontes --estilo estilo.json` para ela ver o estilo nas 7 fontes,
ou direto `demo --estilo estilo.json` se ela já estiver satisfeita. Não existe a fonte exata da referência aqui:
diga qual das 7 ficou mais parecida.
