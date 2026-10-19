# Editor de vídeo · instruções para o Claude

Este projeto é um editor de vídeo que roda dentro do Claude Code.

- Pessoa nova ou "prepare o meu editor": siga `COMECE-AQUI.md`.
- Qualquer pedido de edição ("edita esse vídeo", "corta", "legenda", "ajusta"): use a skill `editor-de-video`
  (`.claude/skills/editor-de-video/SKILL.md`).
- Efeito pedido em português ("o número conta quando eu falar 377", "apaga a luz nessa frase", "mostra o print e marca
  esse trecho"): `.claude/skills/editor-de-video/referencias/efeitos-prontos.md` (guia da pessoa: `docs/10-efeitos-prontos.md`).
- "Aprende o estilo desses vídeos", "salva como X", "edita no estilo X": `motor/referencia.py` (`--estilo`, `--aplicar`,
  `--lista`), detalhe em `.claude/skills/editor-de-video/referencias/referencia.md`.
- Padrão: legenda que sobe (branca, ênfase só no tamanho), som desenhado nas trocas, **sem música** (só se pedir).
- A pessoa provavelmente não é técnica: uma pergunta por vez, linguagem simples, plano antes de cortar.
- Nunca invente número, print ou depoimento. Nunca mande o vídeo para fora do computador. Nunca publique.
- Python do projeto: `.venv/bin/python`. Diagnóstico: `bash scripts/diagnostico.sh`.
