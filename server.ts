import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';

const PAGE_DIR = join(tmpdir(), 'chrome-ai-pages');
mkdirSync(PAGE_DIR, { recursive: true });

let port = 0;
let server: Server | null = null;

export function start(): Promise<number> {
  if (server) return Promise.resolve(port);
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      const name = (req.url ?? '/').slice(1).split('?')[0];
      try {
        const body = readFileSync(join(PAGE_DIR, name));
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': body.length,
        });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, () => {
      port = (server!.address() as { port: number }).port;
      resolve(port);
    });
  });
}

export function servePage(html: string): { id: string; url: string } {
  const id = randomBytes(4).toString('hex');
  writeFileSync(join(PAGE_DIR, `${id}.html`), html);
  return { id, url: `http://localhost:${port}/${id}.html` };
}

export function cleanupPage(id: string): void {
  try { unlinkSync(join(PAGE_DIR, `${id}.html`)); } catch { /* ignore */ }
}
