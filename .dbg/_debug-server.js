const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf('--' + name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return def;
}

const sessionId = getArg('session', 'default');
const outdir = getArg('outdir', '.dbg');
const clean = args.includes('--clean');
const idle = parseInt(getArg('idle', '0')) || 0;
const startPort = parseInt(getArg('port', '7777')) || 7777;
const remote = args.includes('--remote');
const host = remote ? '0.0.0.0' : '127.0.0.1';

if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

const logFile = path.resolve(outdir, `trae-debug-log-${sessionId}.ndjson`);
const envFile = path.resolve(outdir, `${sessionId}.env`);

if (clean && fs.existsSync(logFile)) fs.unlinkSync(logFile);
fs.writeFileSync(logFile, '');

let port = startPort;
let server;
let idleTimer = null;

function resetIdle() {
  if (idle <= 0) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log(`[DEBUG-SERVER] Idle timeout after ${idle}s – exiting`);
    process.exit(0);
  }, idle * 1000);
}

function tryListen(p) {
  server = http.createServer((req, res) => {
    resetIdle();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      const lines = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length : 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: Date.now() - started, log_count: lines }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/logs') {
      const content = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.end(content);
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/logs') {
      fs.writeFileSync(logFile, '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/event') {
      let body = '';
      req.on('data', (c) => { body += c.toString(); });
      req.on('end', () => {
        try {
          const ev = JSON.parse(body || '{}');
          ev.ts = ev.ts || Date.now();
          if (process.env.DEBUG_VERBOSE) console.log(`[LOG] h=${ev.hypothesisId} msg=${ev.msg}`);
          fs.appendFileSync(logFile, JSON.stringify(ev) + '\n');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid json', detail: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && p < startPort + 10) {
      console.log(`[DEBUG-SERVER] Port ${p} occupied, trying ${p + 1}...`);
      tryListen(p + 1);
    } else {
      console.error(`[DEBUG-SERVER] Failed:`, e.message);
      process.exit(1);
    }
  });

  server.listen(p, host, () => {
    port = p;
    const apiUrl = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/event`;
    fs.writeFileSync(envFile, `DEBUG_SERVER_URL=${apiUrl}\nDEBUG_SESSION_ID=${sessionId}\n`);
    console.log('@@DEBUG_SERVER_INFO');
    console.log(JSON.stringify({
      api_url: apiUrl,
      session_id: sessionId,
      log_dir: path.resolve(outdir),
      log_file: path.resolve(logFile),
      env_file: path.resolve(envFile),
    }, null, 2));
    console.log('@@END_DEBUG_SERVER_INFO');
    resetIdle();
  });
}

const started = Date.now();
tryListen(port);
