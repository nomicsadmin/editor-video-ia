# Problemas comuns

Primeiro passo sempre: peça para a IA rodar o diagnóstico (`bash scripts/diagnostico.sh`).

| O que aconteceu | O que fazer |
|---|---|
| "command not found: brew" ou "ffmpeg" | Rode o setup de novo: `bash scripts/setup.sh`. |
| Windows: instalou mas diz que falta ffmpeg/node/python | Feche e abra o Claude Code (o Windows só enxerga programa novo em janela nova) e rode o setup de novo. |
| Windows: "winget não encontrado" | Atualize o "Instalador de Aplicativo" na Microsoft Store. |
| Janela pedindo "ferramentas de linha de comando" | Clique em Instalar, espere terminar e rode o setup de novo. |
| O Mac pediu a senha do Chaveiro | É o navegador liberando o seu login para baixar a referência. Pode permitir. |
| Referência não baixou | Post privado ou navegador sem login no Instagram (no Windows, entre no Instagram pelo Firefox). Mande o arquivo ou 3 prints. |
| A transcrição errou um nome (seu produto, seu sobrenome) | Diga à IA: ela corrige neste vídeo e guarda para os próximos. |
| Uma palavra sumiu no corte | Diga em que segundo. A IA ajusta o corte (a conferência costuma pegar antes). |
| Legenda em cima da boca ou do botão do Instagram | "Legenda mais pra baixo/cima". |
| Vídeo muito pesado para mandar | "Deixa o arquivo mais leve". |
| Disco cheio | Apague a pasta `_build` dos vídeos já aprovados (é só o rascunho do render). |
