# COMECE AQUI · Roteiro para a IA preparar e usar o seu editor de vídeo

> **Você é uma pessoa?** Não precisa ler este arquivo. Abra esta pasta no Claude Code, escolha o modelo **Opus 5.5** e cole:
>
> **`Leia o COMECE-AQUI.md e prepare o meu editor de vídeo.`**
>
> A IA confere o seu Mac, instala o que faltar e edita um vídeo de teste. Depois é só mandar os seus.

---

## Para a IA: como conduzir

Você vai preparar e usar um **editor de vídeo** para uma pessoa que provavelmente **não é técnica**. O motor já está
pronto (`motor/`). O seu trabalho é instalar, entender o que ela quer e editar seguindo a skill
`.claude/skills/editor-de-video/SKILL.md`.

### Regras que valem o tempo todo
0. **Fale no idioma da pessoa.**
1. **Uma pergunta por vez**, com opções numeradas e a recomendada em primeiro. Se a sua ferramenta tiver perguntas com opções, use.
2. **Linguagem simples.** Nada de comando, caminho ou JSON na conversa, a não ser que ela peça. Termo técnico: explique em uma frase (`docs/glossario.md`).
3. **Mostre antes de fazer.** Antes de instalar algo ou de cortar o vídeo, diga o que vai fazer e espere o "pode".
4. **Nunca invente** número, print, depoimento ou resultado. Se não está na fala dela ou na pasta, não entra na tela.
5. **Nada sai do computador.** Não mande o vídeo para serviço externo. Não publique nada.
6. **Travou? Diagnostique.** Rode `bash scripts/diagnostico.sh` e leia o resultado antes de sugerir qualquer coisa.

### Etapa 1 · Instalar (uma vez)
1. Rode `bash scripts/diagnostico.sh`. Tudo ✅? Pule para a etapa 2.
2. Faltou algo: explique em uma frase ("vou instalar o ffmpeg, que corta o vídeo, e o transcritor, que escuta a sua fala
   aqui no seu computador") e, com o "pode", rode `bash scripts/setup.sh`. No Mac ele usa o Homebrew e pode pedir a senha
   do Mac (quem digita é ela, no terminal). No Windows usa o winget; se algo acabou de ser instalado e o diagnóstico ainda
   não enxerga, peça para ela fechar e abrir o Claude Code e rode de novo.
3. Se pedir as ferramentas da Apple (janela "Instalar"), oriente o clique e rode o setup de novo.
4. Rode o diagnóstico de novo até ficar tudo ✅.

### Etapa 2 · Vídeo de teste (1 minuto)
O setup já edita o vídeo de exemplo (sem rosto de ninguém). Abra `edicoes/exemplo/exemplo-editado.mp4` para ela ver
e diga: "Funcionou. Agora me manda um vídeo seu." Para rodar de novo: `bash motor/montar.sh edicoes/exemplo`.

### Etapa 3 · A marca dela (uma vez, opcional)
Pergunte: `1 tenho cores, fonte e logo · 2 só a logo · 3 usa o visual neutro`.
Com cores/fonte/logo: copie os arquivos para `minha-marca/` e escreva `minha-marca/marca.json`
(molde em `minha-marca/marca.exemplo.json`; formato em `.claude/skills/editor-de-video/referencias/formato.md`).
Só fonte livre ou comprada por ela. Sem certeza da licença: use a neutra.

### Etapa 4 · Editar
Siga a skill `.claude/skills/editor-de-video/SKILL.md` do passo 1 ao 10.
Resumo: receber vídeo + briefing + referência → perguntar só o que faltou → ler a fala → ler a referência →
plano (espera o "pode") → cortar → telas → render e conferência → entregar → ajustes.

### Etapa 5 · Depois
Diga a ela o atalho para os próximos vídeos:
```text
Edita esse vídeo: [arraste o vídeo]. [Sobre o que é]. Referência: [link ou "a mesma do último"].
```
