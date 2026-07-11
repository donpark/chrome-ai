---
name: chrome-ai
description: Programmatically test Chrome's built-in AI APIs (Prompt, Summarizer, Translator, Writer) via agent-browser. Use when the user needs to test Chrome's LanguageModel/Prompt API, benchmark Gemini Nano, integrate Chrome AI APIs into automated test pipelines, or call Chrome's on-device AI from scripts. Triggers include "test Chrome Prompt API", "benchmark Gemini Nano", "test LanguageModel API", "call Chrome AI from Python", "automate Chrome AI testing", or any task requiring programmatic access to Chrome's built-in AI APIs.
allowed-tools: Bash(agent-browser:*), Bash(python3:*)
---

> This repo is also an npm package: `npm install chrome-ai` → `import { prompt } from 'chrome-ai'`.
> See [README.md](README.md) for the Node.js API.

# Chrome AI API Testing via agent-browser

Chrome's built-in AI APIs (Gemini Nano via `LanguageModel`) only run inside Chrome pages — no CLI, no REST API, no Node.js binding. This skill bridges that gap: serve an HTML page that calls the API, load it via agent-browser, read the result from the DOM.

## Core Pattern

```
Python/Node test script
    │
    ├─ writes prompt into HTML page
    ├─ serves via localhost
    ▼
agent-browser loads the page in Chrome
    │
    ▼
Page JS calls globalThis.LanguageModel.create() + session.prompt()
    │  ← Chrome's built-in Prompt API (Gemini Nano)
    ▼
Result written to <pre id="r">
    │
    ▼
agent-browser get text "#r" → script reads result
```

## Quick Test

```bash
# Create test page
cat > /tmp/nano_test.html << 'EOF'
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body><pre id="r">loading...</pre>
<script>
(async () => {
  const el = document.getElementById('r');
  const api = globalThis.LanguageModel;
  if (!api) { el.textContent = 'ERROR: no API'; return; }
  const avail = await api.availability();
  if (avail === 'unavailable') { el.textContent = 'ERROR: unavailable'; return; }
  el.textContent = 'running...';
  const s = await api.create({
    initialPrompts: [{role:'system', content: 'Answer in one word.'}]
  });
  try {
    const t = await s.prompt('What color is the sky?');
    el.textContent = 'OK:\n' + t;
  } finally { if (s.destroy) s.destroy(); }
})();
</script></body></html>
EOF

# Serve and test
python3 -m http.server 8766 --directory /tmp &
agent-browser open "http://localhost:8766/nano_test.html"
agent-browser wait 35000  # Gemini Nano first call is slow (~20-30s)
agent-browser get text "#r"
# → "OK:\nBlue."
```

## Python Client Library

Wrap the pattern in a reusable function. Serve pages from a temp directory on a fixed port, write prompts into HTML files, load via agent-browser, read results from the DOM.

```python
import json, subprocess, tempfile, threading, time, uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

PAGE_TEMPLATE = """<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body><pre id="r" style="white-space:pre-wrap;word-break:break-word">pending</pre>
<script>
(async () => {
  const el = document.getElementById('r');
  try {
    const api = globalThis.LanguageModel;
    if (!api) { el.textContent = 'ERROR:no-api'; return; }
    const avail = await api.availability({expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]});
    if (avail === 'unavailable') { el.textContent = 'ERROR:unavailable'; return; }
    el.textContent = 'running';
    const session = await api.create({
      initialPrompts: [{role:'system', content: __SYSTEM__}],
      expectedInputs: [{type:'text',languages:['en']}],
      expectedOutputs: [{type:'text',languages:['en']}],
    });
    try {
      const text = await session.prompt(__USER__);
      el.textContent = 'OK:\\n' + text;
    } finally { if (session.destroy) session.destroy(); }
  } catch(e) { el.textContent = 'ERROR:' + e.message; }
})();
</script></body></html>"""

PAGE_DIR = Path(tempfile.gettempdir()) / "chrome-ai-pages"
PAGE_DIR.mkdir(exist_ok=True)
_server = None
_server_port = 8767

def _ensure_server():
    global _server
    if _server is not None: return
    _server = HTTPServer(("localhost", _server_port), _NanoHandler)
    threading.Thread(target=_server.serve_forever, daemon=True).start()

class _NanoHandler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        path = self.path.lstrip("/")
        page = PAGE_DIR / path
        if page.exists() and page.is_file():
            body = page.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404); self.end_headers()

def _agent_browser(args, timeout=60):
    proc = subprocess.run(["agent-browser"] + args, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"agent-browser failed: {proc.stderr[:500]}")
    return proc.stdout.strip()

def nano_prompt(system, user, timeout=60):
    """Call Chrome's built-in LanguageModel API (Gemini Nano)."""
    _ensure_server()
    page_id = uuid.uuid4().hex[:8]
    html = PAGE_TEMPLATE.replace("__SYSTEM__", json.dumps(system)).replace("__USER__", json.dumps(user))
    page = PAGE_DIR / f"{page_id}.html"
    page.write_text(html)
    url = f"http://localhost:{_server_port}/{page_id}.html"
    try:
        _agent_browser(["open", url], timeout=15)
        _agent_browser(["wait", "35000"], timeout=50)
        result = _agent_browser(["get", "text", "#r"], timeout=10)
        page.unlink(missing_ok=True)
        if result.startswith("ERROR:"): raise RuntimeError(result[6:])
        if result.startswith("OK:\n"): return result[4:]
        if result == "running": raise TimeoutError("Prompt still running after 35s")
        return result
    except Exception:
        page.unlink(missing_ok=True)
        raise

# Usage:
# text = nano_prompt("You are helpful.", "Hello!")
```

## Testing Multiple Prompts (Batch)

Keep the agent-browser session open between calls to avoid cold starts:

```python
# First call: ~30s (model load)
result1 = nano_prompt(system1, user1)

# Subsequent calls: ~1-5s (model cached)
result2 = nano_prompt(system2, user2)
result3 = nano_prompt(system3, user3)
```

## Other Chrome AI APIs

Same pattern works for all Chrome built-in AI APIs:

```javascript
// Summarizer
const s = await globalThis.Summarizer.create({type:'key-points', format:'plain-text', length:'medium'});
const result = await s.summarize(longText);

// Translator
const s = await globalThis.Translator.create({sourceLanguage:'en', targetLanguage:'es'});
const result = await s.translate(text);

// Writer
const s = await globalThis.Writer.create({tone:'neutral', format:'plain-text', length:'medium'});
const result = await s.write(prompt);
```

## Requirements

- **agent-browser** installed: `brew install agent-browser` or `npm i -g agent-browser`
- **Recent desktop Chrome** (v129+): no flags needed, Prompt API is on by default
- Older Chrome: enable `chrome://flags/#prompt-api-for-gemini-nano`

## Latency Notes

| Call | Latency | Why |
|------|---------|-----|
| First call in session | 20–35s | Model loading into memory |
| Subsequent calls | 1–5s | Model cached |
| After long idle | 10–20s | Partial cache eviction |

Keep agent-browser open between calls. Don't `agent-browser close` between tests.

## Troubleshooting

| Symptom | Likely Cause |
|---------|-------------|
| `globalThis.LanguageModel` is undefined | Chrome too old, or Prompt API not available on this OS |
| `availability()` returns "unavailable" | Model not downloaded. Check `chrome://components` for "Optimization Guide On Device Model" — may need to wait for download. |
| Page says "running..." forever | Cold-start. First call in a session can take 35s. Wait longer. |
| `agent-browser get text "#r"` returns "pending" | JavaScript didn't execute. Verify `agent-browser open` succeeded. |
| agent-browser `wait` times out | Increase timeout. Try `wait 45000` for first call. |
| `nano_prompt()` hangs | Server not running. Check `_ensure_server()` was called. |
