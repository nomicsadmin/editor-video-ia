# Efeitos prontos (para a IA)

Guia da pessoa, com as frases que pedem cada um: `docs/10-efeitos-prontos.md`. Aqui: quando usar, o JSON e o que conferir.
Todos entram no `cenas.json` como qualquer cena, ancorados na fala (`quando`, `ate`, `ate_fim`).

## Regras
1. **Um efeito grande a cada ~6 s** (print vivo, tela do assunto, checklist, holofote, comentário, hodômetro, antes e
   depois, timeline em chamas). Três a cinco no vídeo. Selo, caixa, contador, lista, traço e cinético são leves.
2. **O efeito ilustra a frase daquele momento.** Número só se a pessoa disse; print só se ela mandou; logo só de marca citada.
3. **Som desenhado já vem com cada efeito** (whoosh, clique, pop, tique, riser, impacto, sintetizados no `sfx.py`).
   Para trocar o som de uma cena: `"som": "clique" | "clique-suave" | "whoosh" | "whoosh-curto" | "whoosh-cinematico" |
   "pop" | "tique" | "digitacao" | "brilho" | "riser" | "impacto" | "impacto-grave" | "nenhum"` e `"som_ganho"`.
   Som solto, sem nada na tela: `{ "tipo": "som", "som": "riser", "quando": "E aí tem" }` (o riser termina na palavra).
   **Música: nenhuma por padrão.** Só com `edicao.trilha`, quando a pessoa pedir e mandar o arquivo.
4. **Mac × Windows:** `tela_assunto`, `checklist`, `holofote`, `hodometro` e `timeline_chamas` usam o recorte da pessoa
   (`motor/mascaras.py`, Vision, só no Mac; o `montar.sh` roda sozinho). No Windows saem por cima, sem quebrar (o aviso
   "sem o recorte da pessoa" no `--qa` é normal lá). Avise a pessoa no plano se ela estiver no Windows.
5. Confira com `node motor/render.mjs <pasta> --frames ...` no meio de cada efeito e **olhe** antes do render inteiro.

## Print vivo · `print`
O painel de cima da tela dividida (o layout vira `split` sozinho enquanto dura). Janela de navegador em 3D que entra em
chicote, rola, cursor que clica no trecho e marca-texto/caixa na palavra. Prints em sequência emendam (um sai, o outro entra).
```json
{ "tipo": "print", "src": "assets/pagina.png", "quando": "aprende o estilo", "ate": "Funciona",
  "url": "github.com/pessoa/projeto",
  "marcas": [ { "area": [0.06, 0.41, 0.52, 0.03], "quando": "referências" },
              { "area": [[0.20, 0.284, 0.05, 0.003], [0.02, 0.288, 0.21, 0.004]], "quando": "ritmo", "tipo": "caixa" } ],
  "rola": [0, 0.35], "rola_em": ["aprende", "referências"], "lado": "esquerda", "modo": "topo", "cursor": true }
```
- `area` = [x, y, largura, altura] em fração do print. Trecho em várias linhas: uma área por linha (a caixa junta tudo).
  **Ache a área com** `$PY motor/achar_texto.py <print> "trecho exato"` (Mac, lê o texto com o Vision). Windows:
  `$PY motor/achar_texto.py <print> --grade` gera o print com grade de 10% para você estimar olhando.
- Sem `rola`: a janela centra a primeira marca. `modo: "flutua"` = janela sobre o vídeo, sem fundo, topo em `y`.
- Print em página inteira (captura longa) funciona; texto pequeno demais no celular: recorte antes.

## Tela do assunto · `tela_assunto`
Para o gancho (2,2 s ou mais). A pessoa desce, fundo de estúdio, janela do assunto descendo do alto e rolando.
```json
{ "tipo": "tela_assunto", "quando": "gratuito", "volta": "absurdo", "src": "assets/pagina.png",
  "rotulo": "github.com/pessoa/projeto", "rola": [0, 0.04], "escala_pessoa": 0.8, "janela": { "largura": 0.76, "y": 0.035 } }
```
`volta` = palavra em que ela sobe de volta. A legenda sobe sozinha para o vão entre a janela e a cabeça.

## Checklist 3D · `checklist`
```json
{ "tipo": "checklist", "quando": "ele tira", "ate": "Você aprova", "titulo": "Ele tira do bruto", "largura": 0.8,
  "itens": [ { "texto": "Frases repetidas", "quando": "frases repetidas" }, { "texto": "Pausas", "quando": "pausas" } ] }
```
Placa na parede acima da cabeça: precisa de ~25% de parede livre. `"material": "vidro"` = painel de vidro fosco.

## Holofote · `holofote`
```json
{ "tipo": "holofote", "quando": "E aí tem", "ate": "Ele abre",
  "palavras": [ { "texto": "uma parte", "quando": "uma parte" }, { "texto": "muito massa", "quando": "muito massa", "destaque": true } ] }
```
Uma vez por vídeo, na virada. Combine com `{ "tipo": "som", "som": "riser", "quando": "E aí tem" }`.

## Comentário · `comentario`
```json
{ "tipo": "comentario", "quando": "Então comenta", "ate": "E o melhor", "palavra": "IA", "digita_em": "IA#1",
  "resposta_em": "direct", "nome": "Nome da pessoa", "resposta": "Te mandei o link", "botao": "Abrir link",
  "avatar": "assets/perfil.jpg", "y": 0.2 }
```
Sem `avatar`/`nome`: usa `"avatar"` e `"nome"` do `minha-marca/marca.json` (foto em `minha-marca/`); sem foto, as iniciais.
`"avatar": "marca:perfil.jpg"` lê de `minha-marca/`.

## Número que conta · `contador` · Hodômetro · `hodometro`
```json
{ "tipo": "contador", "valor": 377, "rotulo": "sites prontos", "quando": "377", "ate": "templates", "y": 0.25 }
{ "tipo": "hodometro", "valor": 437, "rotulo": "paletas de cor", "quando": "437", "ate": "Roda" }
```
Contador: cartão de vidro, conta em 0,9 s (`conta_s`), `prefixo`/`sufixo`, decimal com ponto no JSON ("2.5" vira 2,5).
Sem `y`: no meio do painel de cima da tela dividida. Hodômetro: na parede atrás da cabeça (recorte no Mac).

## Caixa · `caixa`
```json
{ "tipo": "caixa", "area": [0.08, 0.18, 0.84, 0.06], "quando": "categorias", "ate": "cada" }
```
`area` em fração da TELA. Dentro de um print, use a marca `"tipo": "caixa"` do print (acompanha a rolagem e o 3D).

## Logo no traço · `traco` · Texto cinético · `cinetica`
```json
{ "tipo": "traco", "logo": "claude", "cor": "destaque", "preenche": "destaque", "largura": 230, "espessura": 3, "y": 0.17, "dur_traco": 0.8, "quando": "Roda", "ate": "separei" }
{ "tipo": "cinetica", "texto": "Comenta IA", "destaque": "IA", "efeito": "letras", "tamanho": 150, "y": 0.2, "quando": "Então comenta#2", "ate": 999, "saida": "nenhuma" }
```
`traco`: logos de `motor/logos/` ou `"svg": "assets/logo.svg"` (só `<path>`). `cinetica`: `efeito` `letras` (sobe de dentro
da linha) · `montar` (letras espalhadas se juntam) · `digitar`; `linhas: [...]` para quebrar; `cor`/`cor_destaque`.

## Antes e depois · `antes_depois`
```json
{ "tipo": "antes_depois", "quando": "Aí você manda", "corta": "manda", "ate": "frases", "rotulos": ["antes", "depois"] }
```
O quadro vira o bruto do celular e a linha varre na palavra `corta`. Precisa de ~2,8 s a partir do `corta`. A legenda some
do lado cru (`"legenda_no_cru": true` mantém).

## Timeline em chamas · `timeline_chamas`
```json
{ "tipo": "timeline_chamas", "quando": "Ele corta", "queima_em": "tela", "titulo": "Edição · reels" }
```
Termina sozinha ~2 s depois da queima: não ponha um print nesses 2 s.

## Lista que acende · `lista` · Selo · `selo`
```json
{ "tipo": "lista", "titulo": "Você aprova", "itens": [ { "texto": "O corte", "quando": "corte" }, { "texto": "O vídeo pronto", "quando": "vídeo pronto" } ], "destaque": "fala", "quando": "Você aprova", "ate": "E aí tem", "y": 0.1 }
{ "tipo": "selo", "texto": "100% grátis", "quando": "melhor", "ate": "Então comenta", "y": 0.2 }
```
Item com `quando` acende na palavra; item texto simples acende a cada `passo` segundos.
