# Chrome AI

Call Chrome's built-in AI APIs (Gemini Nano) from Node.js — no manual browser interaction.

Uses [agent-browser](https://github.com/potatosalad/agent-browser) under the hood to bridge between Node.js and Chrome's `globalThis.LanguageModel` API.

## Install

```bash
npm install chrome-ai
```

Requires: `agent-browser` (`brew install agent-browser`) and recent desktop Chrome.

## Usage

```js
import { prompt, summarize, translate } from 'chrome-ai';

// Prompt API
const answer = await prompt({ system: 'You are helpful.', user: 'Hello!' });

// Summarizer API
const summary = await summarize({ text: longArticle, type: 'key-points' });

// Translator API
const spanish = await translate({ text: 'Hello world', targetLanguage: 'es' });

// Writer API
const draft = await write({ prompt: 'Write a short poem about AI', tone: 'informal' });
```

## API

### `prompt(opts)`
| Option | Type | Default |
|--------|------|---------|
| `system` | string | `''` |
| `user` | string | *required* |

### `summarize(opts)`
| Option | Type | Default |
|--------|------|---------|
| `text` | string | *required* |
| `type` | `'key-points'` \| `'tl;dr'` \| `'teaser'` \| `'headline'` | `'key-points'` |
| `format` | `'plain-text'` \| `'markdown'` | `'plain-text'` |
| `length` | `'short'` \| `'medium'` \| `'long'` | `'medium'` |

### `translate(opts)`
| Option | Type | Default |
|--------|------|---------|
| `text` | string | *required* |
| `sourceLanguage` | string | `'en'` |
| `targetLanguage` | string | `'es'` |

### `write(opts)`
| Option | Type | Default |
|--------|------|---------|
| `prompt` | string | *required* |
| `tone` | `'neutral'` \| `'formal'` \| `'informal'` | `'neutral'` |
| `format` | `'plain-text'` \| `'markdown'` | `'plain-text'` |
| `length` | `'short'` \| `'medium'` \| `'long'` | `'medium'` |

## Latency

First call in a session: 20–35s (model loading). Subsequent calls: 1–5s. Keep the Node process alive between calls.

## Requirements

- **agent-browser**: `brew install agent-browser`
- **Chrome**: v129+ (Prompt API on by default)

## Also a Pi Skill

This repo also contains a [SKILL.md](SKILL.md) for use with [Pi coding agent](https://github.com/earendil-works/pi-coding-agent) via `skills.sh`:

```bash
skills.sh install donpark/chrome-ai
```
