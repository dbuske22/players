import type { IncomingMessage, ServerResponse } from 'http';
import { app } from '../backend/src/index.js';

// Convert Node.js IncomingMessage to Web Fetch Request
// Strips the /api prefix so Hono routes match correctly
async function toRequest(req: IncomingMessage): Promise<Request> {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) || 'https';
  const host = req.headers['host'] || 'localhost';

  // Strip /api prefix — Vercel routes /api/* → this function,
  // but Hono is registered at / not /api/
  let path = req.url || '/';
  if (path.startsWith('/api')) {
    path = path.slice(4) || '/';
  }

  const url = `${proto}://${host}${path}`;

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : null;

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

// Write Web Fetch Response to Node.js ServerResponse
async function writeResponse(webRes: Response, res: ServerResponse): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = await webRes.arrayBuffer();
  res.end(Buffer.from(body));
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

// CJS default export — Vercel expects module.exports = handler
module.exports = handler;
