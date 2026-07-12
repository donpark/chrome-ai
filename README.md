# Chrome AI

Call Chrome's built-in AI APIs (Gemini Nano) from Node.js or Python.

Chrome's AI APIs only run inside browser pages. chrome-ai bridges that gap: a Python HTTP server manages a prompt queue, and a bridge page (open once in Chrome) processes prompts by calling the API directly.

## Install

```bash
npm install chrome-ai
```

Just Chrome. No agent-browser, no extensions, no API keys.

## Quick Start

Start the server:

```bash
python chrome_ai/server.py
# → http://localhost:62835
```

Open that URL in Chrome. Keep the tab open.

Now use it from **Node.js**:

```js
import { prompt } from 'chrome-ai';

const answer = await prompt({
  system: 'You are helpful.',
  user: 'What is the capital of France?',
});
console.log(answer);
```

Or from **Python**:

```python
from chrome_ai.client import nano_prompt

answer = nano_prompt('You are helpful.', 'What is the capital of France?')
print(answer)
```

Or from **any HTTP client**:

```bash
# Submit
curl -s -X POST http://localhost:62835/prompt \
  -H 'Content-Type: application/json' \
  -d '{"system":"You are helpful.","user":"Hello!"}'
# → {"id": "a1b2c3d4e5f6"}

# Poll
curl -s http://localhost:62835/result/a1b2c3d4e5f6
# → {"status": "done", "text": "Hello! How can I help?"}
```

## How it works

```
Client (Node / Python / curl)
    │
    ├─ POST /prompt {system, user} → {id}
    │
    ▼
Python HTTP server — manages prompt queue
    │
    ├─ GET /pending ← bridge page polls every 500ms
    │
    ▼
Bridge page (Chrome, open once)
    - calls LanguageModel.create() + session.prompt()
    - POSTs result to /result/{id}
    │
    ▼
Client — poll GET /result/{id} → result
```

## API

### TypeScript

```ts
import { prompt } from 'chrome-ai';

const text = await prompt({
  system?: string,  // system prompt (optional)
  user: string,     // user message (required)
});
```

### Python

```python
from chrome_ai.client import nano_prompt

text = nano_prompt(
    system: str,   # system prompt
    user: str,     # user message
    timeout: float = 120  # max wait in seconds
)
```

### Server Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/prompt` | Submit a prompt `{system, user}` → `{id}` |
| GET | `/pending` | Bridge page polls for pending prompts |
| POST | `/result/{id}` | Bridge page submits result `{status, text}` |
| GET | `/result/{id}` | Client polls for result |
| GET | `/health` | `{ok, port, pending}` |

## Requirements

- Recent desktop Chrome (v129+, Prompt API on by default)
- Python 3.9+

## Also a Pi Skill

[SKILL.md](SKILL.md) — installable via `skills.sh install donpark/chrome-ai` for use with Pi coding agent.
