# AGENTS.md

Instruções para qualquer agente de código (Claude Code, Cursor, Codex) neste repositório.

- Roteiro de instalação e uso: `COMECE-AQUI.md`.
- Método de edição (fluxo, regras, receitas, formato dos arquivos): `.claude/skills/editor-de-video/`.
  Em ferramentas sem suporte a skills, leia `SKILL.md` e a pasta `referencias/` como instruções.
- Motor: `motor/` (preparar.py → base.py → [mascaras.py, só Mac] → render.mjs → sfx.py → montar.sh → qa.py).
  Python: `.venv/bin/python` (Mac) ou `.venv/Scripts/python.exe` (Windows, Git Bash).
- Efeitos prontos: `motor/comp/efeitos/<nome>.js` (registro em `index.js`), tipografia e traço em `motor/comp/anim.js`;
  uso e JSON em `.claude/skills/editor-de-video/referencias/efeitos-prontos.md`. Sons todos sintetizados em `motor/sfx.py`.
- Referências e estilo salvo: `motor/referencia.py` (1 a 6 referências, `--estilo <nome>`, `--aplicar`, `--folha`, `--lista`).
  Área de um trecho num print: `motor/achar_texto.py` (Vision no Mac; `--grade` no Windows).
- Pastas pessoais (`meus-videos/`, `minhas-referencias/`, `minha-marca/`, `edicoes/`) nunca vão para o git.
- Regras: plano antes de cortar · nunca cortar dentro de palavra · tela ancorada na fala · nada inventado ·
  conferir (`qa.py`) antes de mostrar · nada sai do computador · sem música por padrão · nada que dependa de chave de
  API, serviço pago ou arquivo sem licença livre (fontes OFL, sons sintetizados).
