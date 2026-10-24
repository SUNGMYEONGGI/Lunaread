# Lunaread

An AI research-paper reader for the web and desktop. It runs on the Claude or ChatGPT subscription you already have.

**Live site:** https://sungmyeonggi.github.io/Lunaread/

## Features

- **AI Colleague.** Generates a keyword dictionary, a summary and suggested questions, and answers chat questions about the paper.
- **Selection actions.** Select text to explain or translate it, ask about it, or highlight it with notes.
- **Image Explanation.** Drag over a figure, or hold ⌘/Ctrl and drag, to have it explained.
- **Auto Highlight.** Marks the paper's novelty, method and result sentences.
- **Translation.** Translate Page, plus a beta Layout Translate that keeps the page layout.
- **Smart Citations and link previews.** See a reference or link target without leaving your place.
- **Library.** Import from an arXiv ID or PDF link, search Semantic Scholar, and organize papers into folders.
- **Themes.** Every palette on Color Hunt is available as a color theme.

## How it runs

Lunaread is a static Next.js export plus a small local Node server. The server talks to the AI providers and proxies PDF downloads.

| Provider | What it uses |
| --- | --- |
| `claude-sub` | Your Claude Code login, through the Claude Agent SDK |
| `codex-sub` | Your ChatGPT/Codex login, through the Codex SDK |
| `anthropic-api` / `openai-api` | An API key entered in Settings (stored only in your browser) |

The GitHub Pages site cannot reach AI on its own. Reading and markup work there without a server. To use AI features, run the server on your computer; the Pages site connects to `http://127.0.0.1:8787` automatically.

```bash
git clone https://github.com/SUNGMYEONGGI/Lunaread && cd Lunaread
npm i && npm run build && npm start   # http://127.0.0.1:8787
```

The server only accepts requests from itself, `https://sungmyeonggi.github.io` and `localhost:3000`. To allow other origins, list them comma-separated in `LUNAREAD_ORIGINS`.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Server plus Next dev at http://localhost:3000 |
| `npm run build` / `npm start` | Static export plus the compiled server |
| `npm run build:pages` | Export for GitHub Pages (basePath `/Lunaread`) |
| `npm run desktop` | Electron app |
| `npm run dist:mac` / `dist:win` | Desktop installers |
| `npm run typecheck` / `npm test` | Checks |

Requires Node 22.18 or later. Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, pdf.js and Electron.
