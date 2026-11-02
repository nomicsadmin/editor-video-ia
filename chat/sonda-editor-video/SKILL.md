---
name: sonda-editor-video
description: Testa se o ambiente de código deste chat aguenta editar vídeo (ffmpeg, transcrição, render) e devolve os primeiros 15 segundos do vídeo enviado editados, com legenda animada palavra por palavra e efeitos. Use quando a pessoa pedir "roda a sonda", "testa o editor de vídeo" ou mandar um vídeo para testar a edição.
---

# Sonda do editor de vídeo

Objetivo: descobrir, com medida real, o que este ambiente aguenta, e mostrar uma prévia editada.
Fale em português simples. Não pule etapa nem invente resultado: se uma etapa falhar, registre e siga para a próxima.

## Passos

1. **Ache o vídeo.** Procure o arquivo que a pessoa enviou (normalmente em `/mnt/user-data/uploads/`).
   Se não houver vídeo, rode as etapas mesmo assim: a demo usa uma legenda de exemplo sobre um fundo gerado.
   Sem vídeo, gere um fundo de 6 s depois da etapa `ffmpeg`:
   `"$FF" -f lavfi -i color=c=0x2b2b33:s=1080x1920:d=6 -f lavfi -i anullsrc=r=48000:cl=stereo -t 6 -shortest /tmp/sonda/fundo.mp4`
   (com `FF` = caminho do ffmpeg que a etapa `ffmpeg` imprimir) e use esse arquivo como `--video` na etapa `demo`.
2. **Defina a pasta de saída.** `/mnt/user-data/outputs/` se existir; senão `/tmp/sonda/saida/`.
3. **Rode uma etapa por vez**, cada uma num comando separado, e mostre à pessoa uma linha do resultado:

```bash
S=<pasta desta skill>
python3 $S/scripts/sonda.py ambiente --video <vídeo> --saida <saída>
python3 $S/scripts/sonda.py ffmpeg
python3 $S/scripts/sonda.py whisper      # pode levar alguns minutos na primeira vez
python3 $S/scripts/sonda.py referencia --ref <print ou vídeo>   # só se a pessoa mandou referência de legenda
python3 $S/scripts/sonda.py fontes       # cartela com a legenda em 7 fontes, sobre o vídeo da pessoa
python3 $S/scripts/sonda.py demo --legenda <estilo> --fonte <número> [--headline "texto" --headline-modo abertura|fixa]
python3 $S/scripts/sonda.py conferir     # prova do corte: transcreve o editado de novo e compara com o bruto
python3 $S/scripts/sonda.py chromium     # opcional: só mede se dá para usar navegador no render
python3 $S/scripts/sonda.py relatorio
```

   **Referência de legenda (se a pessoa mandar um print ou vídeo de um reels que ela gosta):** rode `referencia`,
   olhe a imagem `sonda-referencia.png`, preencha um `estilo.json` seguindo `referencias/estilo.md`, diga em uma
   frase o que entendeu e passe `--estilo estilo.json` nas etapas `fontes` e `demo`. Link do Instagram não abre
   aqui: peça o print ou o vídeo salvo.
   **Sem referência**, o padrão é: texto branco, sem traço, sombra suave, a palavra da vez cheia e as outras apagadas.
   **Antes da `demo`, apresente as opções:** mostre a imagem `sonda-fontes.png` na conversa e faça UMA pergunta
   com as três escolhas juntas:
   1. o número da fonte (1 a 7, a etapa `fontes` imprime o nome e o jeito de cada uma);
   2. o estilo da legenda;
   3. **headline sim ou não.** Se sim, ofereça 2 opções curtas (até 8 palavras) tiradas da própria fala da
      pessoa na transcrição, sem prometer nada que ela não disse, e pergunte se fica só na abertura
      (primeiros 3 s, padrão) ou fixa no topo o vídeo todo. Ela também pode escrever a dela.
   Se a pessoa disser "tanto faz": fonte 1, estilo `todas`, sem headline.
   Estilos de legenda (`--legenda`): `palavra` (uma palavra por vez, grande, saltando) · `blocos` (3 palavras,
   a da vez em amarelo) · `normal` (frase em até 2 linhas, como legenda de filme) · `todas` (os três).
   Se a pessoa já disse o estilo, use só ele; se não disse, gere `todas` para ela escolher vendo.
4. **Entregue** os `sonda-demo-<estilo>-<fonte>.mp4` e o `sonda-relatorio.md` da pasta de saída como arquivos para a pessoa baixar.
   Feche com 3 linhas: o que funcionou, o que falhou (com o erro em uma frase) e quanto tempo levou a demo.

## Cortes

A `demo` edita o vídeo inteiro (até 90 s) e tira as pausas. O corte só acontece em pausa real: mede volume e agudos
(o "s" do fim da palavra), deixa 70 ms de respiro depois da fala e 50 ms antes, não corta silêncio em cima de
palavra e tira também trecho longo sem nenhuma palavra (respiração, teclado). A linha `cortes:` da demo diz quantas
pausas saíram e se alguma borda ficou em cima de fala (tem que ser 0). Depois rode `conferir`: ela transcreve o
editado de novo e só acusa diferença **perto de uma emenda**; diferença longe de emenda é o transcritor variando.
Se a pessoa não quiser cortes, use `--sem-cortes`. Pausa mínima: `--pausa 0.35` (maior = corta menos).

## Se algo travar

- Comando passou do tempo: rode a mesma etapa de novo (o que já foi baixado fica salvo em `/tmp/sonda`).
- `whisper` falhou por rede: anote "transcrição bloqueada" e rode a `demo` mesmo assim (ela usa legenda de exemplo).
- Vídeo maior que 30 MB não sobe no chat: peça um trecho menor ou exportado em 1080p.
