// Etapa 5 · renderiza o vídeo quadro a quadro no Chromium headless e codifica em H.264 (sem áudio; o mix entra no montar.sh).
// Tamanho do quadro e codificação saem do `formato` do projeto.json (padrão 1080×1920, crf 18, teto 12M).
//   node render.mjs <pasta-do-projeto>                      → _build/video.mp4
//   node render.mjs <pasta> --frames 30,300,900 [--out dir]  → JPGs soltos para conferir antes do render inteiro
//   node render.mjs <pasta> --qa                             → imprime o relatório do compositor (legenda estourando etc.)
// O compositor mora em motor/comp; o projeto entra com _build, assets e cenas.json.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { spawn } from 'node:child_process'; import { once } from 'node:events'; import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(HERE, '..');
const { chromium } = createRequire(path.join(RAIZ, 'package.json'))('playwright');
const PROJ = path.resolve(process.argv[2] || '.');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const B = path.join(PROJ, '_build');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.otf': 'font/otf', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const dentro = (base, rel) => { const f = path.join(base, rel); return f.startsWith(base) ? f : null; };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let f = null;
  if (u === '/' || u === '/index.html') f = path.join(HERE, 'comp', 'index.html');
  else if (u.startsWith('/comp/')) f = dentro(path.join(HERE, 'comp'), u.slice(6));
  else if (u.startsWith('/fonts/')) f = dentro(path.join(HERE, 'fontes'), u.slice(7));
  else if (u.startsWith('/logos/')) f = dentro(path.join(HERE, 'logos'), u.slice(7));
  else if (u.startsWith('/marca/')) f = dentro(path.join(RAIZ, 'minha-marca'), u.slice(7));
  else if (u.startsWith('/b/')) f = dentro(B, u.slice(3));
  else if (u.startsWith('/p/')) f = dentro(PROJ, u.slice(3));
  if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
// formato do quadro vem do projeto.json (padrão 1080×1920); o compositor lê o mesmo da timeline
const PJ = JSON.parse(fs.readFileSync(path.join(PROJ, 'projeto.json'), 'utf8'));
const FMT = PJ.formato || {};
const W = +(FMT.largura || 1080), H = +(FMT.altura || 1920);
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.error('[erro na página]', e.message));
page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/.test(m.text())) console.log('[página]', m.text()); }); // arquivo opcional ausente (marca.json, extra.js) não é erro
const temExtra = fs.existsSync(path.join(PROJ, 'extra.js'));
await page.addInitScript(v => { window.__temExtra = v; }, temExtra);
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
await page.waitForFunction(() => window.__ready === true || window.__erro, null, { timeout: 180000 });
const erro = await page.evaluate(() => window.__erro);
if (erro) { console.error('compositor falhou:', erro); process.exit(1); }
const meta = await page.evaluate(() => window.__meta);
fs.writeFileSync(path.join(B, 'cenas_resolvidas.json'), JSON.stringify(await page.evaluate(() => window.__cenas()), null, 1));
const jpg = async (f, q = 0.93) => { const d = await page.evaluate(([n, qq]) => window.__frame(n, qq), [f, q]); return Buffer.from(d.slice(d.indexOf(',') + 1), 'base64'); };

if (process.argv.includes('--qa')) {
  console.log(JSON.stringify(await page.evaluate(() => window.__qa()), null, 1));
} else if (arg('--frames')) {
  const out = arg('--out', path.join(B, 'q')); fs.mkdirSync(out, { recursive: true });
  for (const f of arg('--frames').split(',').map(Number)) fs.writeFileSync(path.join(out, `q${String(f).padStart(5, '0')}.jpg`), await jpg(f));
  console.log('quadros em', out);
} else {
  const saida = path.join(B, 'video.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(meta.FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', FMT.preset || 'medium', '-crf', String(FMT.crf ?? 18), '-maxrate', FMT.maxrate || '12M', '-bufsize', FMT.bufsize || '24M', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', saida], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < meta.FRAMES; f++) {
    if (!ff.stdin.write(await jpg(f))) await once(ff.stdin, 'drain');
    if (f % 300 === 299) console.log(`  ${f + 1}/${meta.FRAMES} quadros · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end(); await once(ff, 'close'); console.log('  vídeo:', saida);
}
await browser.close(); srv.close();
