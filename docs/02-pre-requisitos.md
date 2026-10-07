# O que precisa

- **Mac** (chip Apple M1 ou mais novo é o ideal; Intel funciona, a transcrição fica mais lenta) **ou Windows 10/11**
  (com placa de vídeo NVIDIA a transcrição é rápida; sem ela, roda no processador, uns 2 a 4 minutos por minuto de vídeo).
- **Claude Code** com um plano do Claude que inclua o Claude Code. Baixe em [claude.com/claude-code](https://claude.com/claude-code).
- **10 GB livres** no disco (o transcritor ocupa uns 2 GB; cada edição usa até 1 GB enquanto roda, que você pode apagar depois).
- **Internet** só na instalação e para baixar referência por link. A edição em si roda offline.

O resto (ffmpeg, Node, Python, transcritor, navegador do render) a IA instala com você pelo `scripts/setup.sh`:
no Mac com o Homebrew, no Windows com o winget (o instalador do próprio Windows).

## Quanto custa
O editor é grátis e aberto (MIT). Não tem chave de API nem cobrança por minuto. Você usa o seu plano do Claude:
cada edição consome uso do Claude Code, mais na primeira (instalação) e nos vídeos longos.
