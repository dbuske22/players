import type { IncomingMessage, ServerResponse } from 'http';

// Polyfill Web Fetch API for Node < 18 environments (Vercel may run Node 16)
// Node 18+ has these globally via undici; Node 16 does not.
if (typeof globalThis.Headers === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require('undici');
    globalThis.Headers = undici.Headers;
    globalThis.Request = undici.Request;
    globalThis.Response = undici.Response;
    if (!globalThis.fetch) globalThis.fetch = undici.fetch;
  } catch {
    // undici not available — we're on a Node version that should have these globals
  }
}

import { app } from '../backend/src/index.js';

async function toRequest(req: IncomingMessage): Promise<Request> {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) || 'https';
  const host = req.headers['host'] || 'localhost';

  let path = req.url || '/';
  if (path.startsWith('/api')) {
    path = path.slice(4) || '/';
  }

  const url = `${proto}://${host}${path}`;

  const body = await new Promise<Buffer | null>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(chunks.length > 0 ? Buffer.concat(chunks) : null));
    req.on('error', reject);
  });

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method: req.method || 'GET',
    headers,
    body: body && body.length > 0 ? body : null,
  });
}

async function writeResponse(webRes: Response, res: ServerResponse): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buf = await webRes.arrayBuffer();
  res.end(Buffer.from(buf));
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const webReq = await toRequest(req);
    const webRes = await app.fetch(webReq);
    await writeResponse(webRes, res);
  } catch (err) {
    console.error('[api] handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

module.exports = handler;
