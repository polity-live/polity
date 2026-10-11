import http from 'node:http';
import net from 'node:net';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export function browserTargets(project, start) {
  const match = /^polity-zero-performance-([a-f0-9]{8})$/.exec(project);
  if (
    !match ||
    !Number.isInteger(start) ||
    start < 15620 ||
    start > 15810 ||
    (start - 15620) % 10 !== 0
  )
    throw new Error('Invalid isolated browser identity');
  return new Map([
    [start, { hostname: `polity-zero-performance-app-${match[1]}`, port: start }],
    [start + 1, { hostname: `polity-zero-performance-runtime-${match[1]}`, port: start + 1 }],
    [start + 4, { hostname: `supabase_kong_${project}`, port: 8000 }],
  ]);
}

/** Preserve the app's original loopback URLs while routing inside its private Docker network. */
export function browserTarget(address, targets) {
  const url = new URL(address);
  const target = targets.get(Number(url.port));
  if (
    !['http:', 'ws:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username ||
    url.password ||
    !target
  )
    throw new Error('Browser proxy destination is outside the isolated stack');
  return { ...target, path: `${url.pathname}${url.search}` };
}

async function startBrowser() {
  const start = Number(process.env.ZERO_PERFORMANCE_BROWSER_PORT);
  const targets = browserTargets(process.env.ZERO_PERFORMANCE_BROWSER_PROJECT, start);
  const proxy = http.createServer((request, response) => {
    let destination;
    try {
      destination = browserTarget(request.url, targets);
    } catch {
      response.writeHead(403).end();
      return;
    }
    const upstream = http.request(
      { ...destination, method: request.method, headers: request.headers },
      received => {
        response.writeHead(received.statusCode, received.headers);
        received.pipe(response);
      }
    );
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.pipe(upstream);
  });
  proxy.on('connect', (request, socket, head) => {
    let destination;
    try {
      destination = browserTarget(`http://${request.url}`, targets);
    } catch {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    const upstream = net.connect(destination.port, destination.hostname, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
  });
  await new Promise(resolve => proxy.listen(30001, '127.0.0.1', resolve));
  const require = createRequire('/tmp/zero-performance-browser/package.json');
  const { chromium } = require('playwright');
  const version = require('playwright/package.json').version;
  if (version !== process.env.ZERO_PERFORMANCE_PLAYWRIGHT_VERSION)
    throw new Error('Linux browser changes the pinned Playwright version');
  const server = await chromium.launchServer({
    host: '0.0.0.0',
    port: start + 7,
    headless: true,
    proxy: { server: 'http://127.0.0.1:30001' },
  });
  const operatingSystem = await readFile('/etc/os-release', 'utf8');
  if (!/^ID=ubuntu$/m.test(operatingSystem) || !/^VERSION_ID="24\.04"$/m.test(operatingSystem))
    throw new Error('Linux browser requires Ubuntu 24.04');
  await writeFile(
    '/benchmark/browser-ready.json.tmp',
    JSON.stringify({
      endpoint: server.wsEndpoint(),
      runtime: {
        platform: 'linux',
        distribution: 'ubuntu-24.04',
        node: process.version,
        playwright: version,
      },
    })
  );
  await rename('/benchmark/browser-ready.json.tmp', '/benchmark/browser-ready.json');
  // The browser-control endpoint is consumed privately and never written to logs.
  console.info('Isolated Ubuntu browser ready');
  const stop = async () => {
    await server.close();
    proxy.close();
    process.exit(0);
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await startBrowser();
