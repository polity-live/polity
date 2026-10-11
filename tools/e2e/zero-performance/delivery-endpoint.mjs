import { createServer } from 'node:http';
const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 15628 || port > 15818 || (port - 15628) % 10 !== 0)
  throw new Error('Invalid isolated delivery port');
const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/ready') {
    response.writeHead(200).end();
    return;
  }
  if (request.method !== 'POST' || request.url !== '/deliver') {
    response.writeHead(404).end();
    return;
  }
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString();
    if (body.length > 128) {
      response.writeHead(413).end();
      return;
    }
  }
  try {
    const input = JSON.parse(body);
    if (Object.keys(input).length !== 1 || input.provider !== 'web-push')
      throw new Error('Invalid provider');
    console.info(
      JSON.stringify({
        benchmark: 'local-external-delivery',
        provider: input.provider,
        outcome: 'accepted',
      })
    );
    response.writeHead(201).end();
  } catch {
    response.writeHead(400).end();
  }
});
server.listen(port, '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close());
