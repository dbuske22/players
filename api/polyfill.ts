// This file is injected at the very top of the esbuild bundle via --inject.
// It runs before any other module code, ensuring Web Fetch API globals exist.
// Uses the bundled undici copy — no external require() needed.
import { Headers, Request, Response, fetch } from 'undici';

if (typeof globalThis.Headers === 'undefined') {
  (globalThis as typeof globalThis & { Headers: typeof Headers }).Headers = Headers;
}
if (typeof globalThis.Request === 'undefined') {
  (globalThis as typeof globalThis & { Request: typeof Request }).Request = Request;
}
if (typeof globalThis.Response === 'undefined') {
  (globalThis as typeof globalThis & { Response: typeof Response }).Response = Response;
}
if (typeof globalThis.fetch === 'undefined') {
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetch;
}
