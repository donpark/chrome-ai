#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString().trim();
}

function startServer(): Promise<string> {
  const serverPy = join(__dirname, '..', 'server.py');
  const python = platform() === 'win32' ? 'python' : 'python3';
  const proc = spawn(python, [serverPy], { stdio: ['ignore', 'pipe', 'inherit'] });

  return new Promise((resolve, reject) => {
    let url = '';
    proc.stdout!.on('data', (chunk: Buffer) => {
      url += chunk.toString();
      const line = url.split('\n')[0].trim();
      if (line.startsWith('http')) {
        proc.stdout!.removeAllListeners();
        proc.stdout!.destroy();
        resolve(line);
      }
    });
    proc.on('error', reject);
    setTimeout(() => reject(new Error('Server start timed out')), 10_000);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || (cmd !== 'prompt' && cmd !== 'summarize')) {
    process.stderr.write('Usage: chrome-ai prompt|summarize [text]\n');
    process.exit(1);
  }

  let text = args.slice(1).join(' ').trim();
  if (!text && !process.stdin.isTTY) {
    text = await readStdin();
  }
  if (!text) {
    process.stderr.write('No text provided.\n');
    process.exit(1);
  }

  const system = cmd === 'summarize' ? 'Summarize the following text.' : '';

  if (!process.env.CHROME_AI_URL) {
    const url = await startServer();
    process.env.CHROME_AI_URL = url;
  }

  const { prompt } = await import('./index.js');
  const result = await prompt({ system, user: text });
  process.stdout.write(result + '\n');
}

main().catch((err) => {
  process.stderr.write(`chrome-ai: ${err.message}\n`);
  process.exit(1);
});
