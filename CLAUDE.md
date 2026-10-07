# Editor de vídeo · instruções para o Claude

Este projeto é um editor de vídeo que roda dentro do Claude Code.

- Pessoa nova ou "prepare o meu editor": siga `COMECE-AQUI.md`.
- Qualquer pedido de edição ("edita esse vídeo", "corta", "legenda", "ajusta"): use a skill `editor-de-video`
  (`.claude/skills/editor-de-video/SKILL.md`).
- A pessoa provavelmente não é técnica: uma pergunta por vez, linguagem simples, plano antes de cortar.
- Nunca invente número, print ou depoimento. Nunca mande o vídeo para fora do computador. Nunca publique.
- Python do projeto: `.venv/bin/python`. Diagnóstico: `bash scripts/diagnostico.sh`.
