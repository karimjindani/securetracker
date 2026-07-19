import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const host = process.env.OPS_CONSOLE_HOST || '127.0.0.1';
const port = Number(process.env.OPS_CONSOLE_PORT || 3300);
const token = process.env.OPS_CONSOLE_TOKEN || '';
const runs = new Map();

function defaultMinioHealthUrl() {
  const host = process.env.MINIO_HEALTH_HOST || 'localhost';
  const port = process.env.MINIO_API_HOST_PORT || process.env.MINIO_PORT || '9000';
  return `http://${host}:${port}/minio/health/live`;
}

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(body, null, 2));
}

function text(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  response.end(body);
}

function isApi(pathname) {
  return pathname.startsWith('/api/');
}

function isAuthorized(request, url) {
  if (!token) return true;
  return request.headers['x-ops-token'] === token || url.searchParams.get('token') === token;
}

function commandName(name) {
  if (process.platform === 'win32' && name === 'npm') return 'npm.cmd';
  return name;
}

function runCommand(command, args, options = {}) {
  const id = randomUUID();
  const run = {
    id,
    command: [command, ...args].join(' '),
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    logs: []
  };
  runs.set(id, run);

  const child = spawn(commandName(command), args, {
    cwd: repoRoot,
    shell: process.platform === 'win32',
    env: { ...process.env, ...options.env }
  });

  child.stdout.on('data', (chunk) => run.logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => run.logs.push(chunk.toString()));
  child.on('error', (error) => {
    run.status = 'failed';
    run.exitCode = 1;
    run.finishedAt = new Date().toISOString();
    run.logs.push(`\n${error.message}\n`);
  });
  child.on('exit', (code) => {
    run.exitCode = code;
    run.status = code === 0 ? 'passed' : 'failed';
    run.finishedAt = new Date().toISOString();
  });

  return run;
}

function activeRegressionRun() {
  return [...runs.values()].find((run) => run.status === 'running' && run.kind === 'regression');
}

async function httpProbe(name, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { name, status: response.ok ? 'ok' : 'down', detail: `${response.status} ${response.statusText}` };
  } catch (error) {
    return { name, status: 'down', detail: error instanceof Error ? error.message : 'Unknown error' };
  } finally {
    clearTimeout(timeout);
  }
}

function tcpProbe(name, portNumber, hostname = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostname, port: portNumber, timeout: 3000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve({ name, status: 'ok', detail: `${hostname}:${portNumber} reachable` });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ name, status: 'down', detail: `${hostname}:${portNumber} timed out` });
    });
    socket.on('error', (error) => resolve({ name, status: 'down', detail: error.message }));
  });
}

async function containers() {
  return new Promise((resolve) => {
    const child = spawn('docker', ['compose', 'ps', '--format', 'json'], {
      cwd: repoRoot,
      shell: process.platform === 'win32'
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      resolve([{ name: 'docker-compose', service: 'local-docker', state: 'unavailable', status: error.message }]);
    });
    child.on('exit', (code) => {
      if (code !== 0) {
        resolve([{ name: 'docker-compose', service: 'local-docker', state: 'unavailable', status: stderr || `Exited ${code}` }]);
        return;
      }
      const rows = stdout
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .flatMap((line) => {
          try {
            const parsed = JSON.parse(line);
            return [
              {
                name: parsed.Name || parsed.Service || 'unknown',
                service: parsed.Service || 'unknown',
                state: parsed.State || 'unknown',
                status: parsed.Status || 'unknown'
              }
            ];
          } catch {
            return [];
          }
        });
      resolve(rows);
    });
  });
}

async function health() {
  const [frontend, backend, postgres, keycloak, minio, mailpit, containerRows] = await Promise.all([
    httpProbe('frontend', process.env.FRONTEND_BASE_URL || 'http://localhost:5173'),
    httpProbe('backend-api', process.env.API_HEALTH_URL || 'http://localhost:3000/health'),
    tcpProbe('postgres', Number(process.env.POSTGRES_PORT || 5432)),
    httpProbe('keycloak', process.env.KEYCLOAK_BASE_URL || 'http://localhost:18080/realms/securetracker'),
    httpProbe('minio', process.env.MINIO_HEALTH_URL || defaultMinioHealthUrl()),
    httpProbe('smtp-test-service', process.env.SMTP_UI_URL || 'http://localhost:8025'),
    containers()
  ]);
  return {
    tokenRequired: Boolean(token),
    repoRoot,
    services: [frontend, backend, postgres, keycloak, minio, mailpit],
    containers: containerRows
  };
}

async function routeApi(request, response, url) {
  if (!isAuthorized(request, url)) {
    json(response, 401, { error: 'Ops token required' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    json(response, 200, await health());
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/containers') {
    json(response, 200, await containers());
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/containers/up') {
    json(response, 202, runCommand('docker', ['compose', 'up', '-d']));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/regression/run') {
    const active = activeRegressionRun();
    if (active) {
      json(response, 409, { error: 'Regression suite already running', run: active });
      return;
    }
    const run = runCommand('npm', ['run', 'test:regression']);
    run.kind = 'regression';
    json(response, 202, run);
    return;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/api/regression/runs/')) {
    const id = url.pathname.split('/').at(-1);
    const run = runs.get(id);
    json(response, run ? 200 : 404, run || { error: 'Run not found' });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/test-data/cleanup') {
    json(response, 202, runCommand('npm', ['run', 'test:data:cleanup']));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/reset') {
    json(response, 202, runCommand('npm', ['run', 'reset:seeded']));
    return;
  }

  json(response, 404, { error: 'Not found' });
}

const page = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SecureTracker Ops Console</title>
  <style>
    :root { color-scheme: light; font-family: Inter, "Segoe UI", Arial, sans-serif; background: #f6f8fa; color: #1f2933; }
    body { margin: 0; }
    header { background: #255f85; color: white; padding: 18px 28px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    h1 { font-size: 22px; margin: 0; }
    main { padding: 24px; max-width: 1280px; margin: 0 auto; }
    button, input { font: inherit; }
    button { border: 1px solid #255f85; background: #255f85; color: white; padding: 9px 13px; border-radius: 6px; cursor: pointer; }
    button.secondary { background: white; color: #255f85; }
    button.warning { border-color: #9a5b00; color: #9a5b00; background: white; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; }
    .panel { background: white; border: 1px solid #d9e2ec; border-radius: 6px; padding: 16px; margin-bottom: 18px; }
    .card { background: white; border: 1px solid #d9e2ec; border-radius: 6px; padding: 14px; }
    .card h3 { margin: 0 0 8px; font-size: 16px; }
    .pill { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 12px; background: #e5e7eb; margin-bottom: 8px; }
    .ok { background: #d1fae5; color: #065f46; }
    .down, .failed { background: #fee2e2; color: #991b1b; }
    .running { background: #dbeafe; color: #1e40af; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    pre { background: #111827; color: #f9fafb; padding: 14px; border-radius: 6px; min-height: 220px; max-height: 460px; overflow: auto; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 14px; }
    .muted { color: #64748b; }
    .token { display: flex; gap: 8px; align-items: center; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>SecureTracker Ops Console</h1>
      <div class="muted" style="color:#dbeafe">Host-run local console outside the app containers</div>
    </div>
    <div class="token">
      <input id="token" type="password" placeholder="Ops token if configured" />
      <button class="secondary" onclick="saveToken()">Save</button>
    </div>
  </header>
  <main>
    <section class="panel">
      <div class="actions">
        <button onclick="composeUp()">Start Containers</button>
        <button onclick="runRegression()">Run Regression Suite</button>
        <button class="secondary" onclick="cleanup()">Clean Test Data</button>
        <button class="warning" onclick="resetSeeded()">Reset Seeded Data</button>
        <button class="secondary" onclick="refresh()">Refresh</button>
      </div>
    </section>

    <section class="panel">
      <h2>Service Health</h2>
      <div id="services" class="grid"></div>
    </section>

    <section class="panel">
      <h2>Containers</h2>
      <table>
        <thead><tr><th>Service</th><th>Name</th><th>State</th><th>Status</th></tr></thead>
        <tbody id="containers"></tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Command Output</h2>
      <div id="runSummary" class="muted">No command started from this session.</div>
      <pre id="logs"></pre>
    </section>
  </main>
  <script>
    let currentRunId = null;
    let poller = null;
    const tokenInput = document.getElementById('token');
    tokenInput.value = localStorage.getItem('opsToken') || '';

    function saveToken() {
      localStorage.setItem('opsToken', tokenInput.value);
      refresh();
    }
    function headers() {
      const token = localStorage.getItem('opsToken') || '';
      return token ? { 'x-ops-token': token } : {};
    }
    async function api(path, options = {}) {
      const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || response.statusText);
      return body;
    }
    function card(item) {
      const cls = item.status === 'ok' ? 'ok' : 'down';
      return '<div class="card"><h3>' + item.name + '</h3><span class="pill ' + cls + '">' + item.status.toUpperCase() + '</span><div class="muted">' + item.detail + '</div></div>';
    }
    async function refresh() {
      try {
        const health = await api('/api/health');
        document.getElementById('services').innerHTML = health.services.map(card).join('');
        document.getElementById('containers').innerHTML = health.containers.map((row) =>
          '<tr><td>' + row.service + '</td><td>' + row.name + '</td><td>' + row.state + '</td><td>' + row.status + '</td></tr>'
        ).join('') || '<tr><td colspan="4">No containers returned.</td></tr>';
      } catch (error) {
        document.getElementById('services').innerHTML = '<div class="card"><h3>Ops API</h3><span class="pill down">ERROR</span><div class="muted">' + error.message + '</div></div>';
      }
    }
    function setRun(run) {
      currentRunId = run.id;
      document.getElementById('runSummary').textContent = run.command + ' - ' + run.status.toUpperCase() + (run.exitCode === null ? '' : ' exit ' + run.exitCode);
      document.getElementById('logs').textContent = (run.logs || []).join('') || 'Waiting for output...';
      if (run.status === 'running') {
        clearInterval(poller);
        poller = setInterval(loadRun, 1500);
      } else {
        clearInterval(poller);
        refresh();
      }
    }
    async function loadRun() {
      if (!currentRunId) return;
      try { setRun(await api('/api/regression/runs/' + currentRunId)); } catch (error) { document.getElementById('logs').textContent += '\n' + error.message; }
    }
    async function start(path) {
      try { setRun(await api(path, { method: 'POST' })); } catch (error) { document.getElementById('logs').textContent = error.message; }
    }
    function composeUp() { start('/api/containers/up'); }
    function runRegression() { start('/api/regression/run'); }
    function cleanup() { if (confirm('Clean only REGRESSION_ test data?')) start('/api/test-data/cleanup'); }
    function resetSeeded() { if (confirm('Reset to seeded baseline data?')) start('/api/reset'); }
    refresh();
    setInterval(refresh, 10000);
  </script>
</body>
</html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  if (isApi(url.pathname)) {
    void routeApi(request, response, url).catch((error) => {
      json(response, 500, { error: error instanceof Error ? error.message : 'Unknown error' });
    });
    return;
  }
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    text(response, 200, page, 'text/html; charset=utf-8');
    return;
  }
  text(response, 404, 'Not found');
});

if (!existsSync(path.join(repoRoot, 'package.json'))) {
  throw new Error(`Could not locate repo root from ${repoRoot}`);
}

server.listen(port, host, () => {
  console.log(`SecureTracker Ops Console running at http://${host}:${port}`);
});
