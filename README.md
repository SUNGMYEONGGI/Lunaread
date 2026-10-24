<div align="center">

<img src="app/icon.svg" width="96" alt="Lunaread icon">

# Lunaread

**An AI research-paper reader that runs on the subscriptions you already pay for.** Open a PDF or an arXiv ID. An AI colleague beside the page explains passages and figures, translates, finds the key sentences and resolves citations without you leaving the page.

AI runs through the Claude Agent SDK on your Claude login, or through the Codex SDK on your ChatGPT login. You need no API keys and no cloud account. Your papers, highlights and notes stay in your browser.

[**Website**](https://sungmyeonggi.github.io/Lunaread/) · [**Open the reader**](https://sungmyeonggi.github.io/Lunaread/library/) · [**Quick start**](#quick-start) · [**Features**](#features) · [**Architecture**](#architecture) · [**Security model**](#security-model) · [**Build and deploy**](#build-and-deploy)

[![Deploy to GitHub Pages](https://github.com/SUNGMYEONGGI/Lunaread/actions/workflows/deploy.yml/badge.svg)](https://github.com/SUNGMYEONGGI/Lunaread/actions/workflows/deploy.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)
![Platform: Web · macOS · Windows](https://img.shields.io/badge/platform-web%20%C2%B7%20macOS%20%C2%B7%20Windows-lightgrey.svg)
![Alpha](https://img.shields.io/badge/status-alpha-orange.svg)

<img src="docs/reader.png" width="860" alt="Lunaread reader with the AI Colleague panel">

</div>

> **Alpha, and a personal project.** Lunaread is early. It has only been tested by hand. Expect rough edges, and read the [Security model](#security-model) and [Limitations](#limitations) sections before relying on it.

> **Your subscriptions, your machine.** AI calls go through the Claude Code and Codex logins on this computer, via a small server that listens only on `127.0.0.1`. Lunaread never asks for your password. Papers live in IndexedDB and settings in `localStorage`, both in your browser.

> **Answers in your language.** The interface is in English. AI answers default to Korean; change the language in Settings.

## What it is

A PDF reader with an AI panel, a library and a Semantic Scholar search, delivered three ways:

| Surface | How it runs | AI |
| --- | --- | --- |
| **Website** ([sungmyeonggi.github.io/Lunaread](https://sungmyeonggi.github.io/Lunaread/)) | Static Next.js export on GitHub Pages | Calls the local server at `http://127.0.0.1:8787` when it is running |
| **Local web** (`npm start`) | The same export, served by the local server | Same origin, works out of the box |
| **Desktop app** (Electron) | Starts the server in-process on a free port and opens a window | Works out of the box |

Without the server you can still read papers and add highlights and notes, everything except AI and fetching PDFs by link.

## Built on two agent SDKs

| Provider | Engine | Authenticates with |
| --- | --- | --- |
| `claude-sub` (default) | [Claude Agent SDK](https://docs.claude.com/en/docs/agent-sdk/overview) (`@anthropic-ai/claude-agent-sdk`) | The Claude Code login on this computer (subscription) |
| `codex-sub` | [Codex SDK](https://github.com/openai/codex) (`@openai/codex-sdk`) | The Codex (ChatGPT) login in `~/.codex` |
| `anthropic-api` | Anthropic SDK, Files API with prompt caching | An API key entered in Settings |
| `openai-api` | OpenAI SDK, structured outputs | An API key entered in Settings |

The model list comes from each engine. For Claude, that is the models your plan offers. For Codex, it is `~/.codex/models_cache.json`. Pick a model in Settings or in the chat composer.

## Requirements

- Node.js 22.18 or later. The server runs its `.ts` files directly with Node's type stripping.
- A Claude subscription, signed in with [Claude Code](https://docs.claude.com/en/docs/claude-code) (run `claude`, then log in). Optionally, a ChatGPT subscription signed in with the Codex CLI.
- Optional: `S2_API_KEY` for a higher Semantic Scholar rate limit.

## Quick start

```sh
git clone https://github.com/SUNGMYEONGGI/Lunaread.git
cd Lunaread
npm install
npm run build
npm start          # http://127.0.0.1:8787
```

You can now use either address:

- **http://127.0.0.1:8787**, served by the local server.
- **The [website](https://sungmyeonggi.github.io/Lunaread/library/).** It finds the server on its own. The first time, Chrome asks for permission to access devices on your local network; choose **Allow**.

To use the desktop app instead, run `npm run desktop`.

## Try it

- In the library, paste `1706.03762` and press **Open**.
- In the AI panel, press **Generate keywords & summary**, then click a suggested question.
- Select a sentence and choose **Explain**, **Translate** or **Ask**, or pick a highlight color.
- Turn on **Image Explanation** and drag over a figure. Holding `⌘`/`Ctrl` while dragging does the same.
- Press **Auto Highlight** to mark novelty, method and result sentences.
- Click a citation marker such as `[12]`, or hover an internal link to preview its target.
- Open the palette in the left rail and try any Color Hunt palette as the app theme.

## Main surfaces

| Surface | Purpose |
| --- | --- |
| Landing (`/`, `/features/`, `/pricing/`) | Product site in the style of the Magic UI templates |
| Library (`/library/`) | Papers and folders, upload or drag and drop, import by arXiv ID or PDF link |
| Scholar Deep Search (`/library/?scholar`) | Semantic Scholar search; open-access PDFs go straight into the library |
| Reader (`/read/?id=`) | pdf.js viewer with a toolbar, an outline and a right-side panel with four tabs |
| AI Colleague tab | Keyword dictionary, summary, suggested questions, explanation cards, chat with references to other papers |
| Translate Page tab | Translates the current page as a stream; results are cached per page |
| Markup & Notes tab | Every highlight with its note; export them as Markdown |
| Discussion tab | Strengths, weaknesses and open questions of the paper |
| Settings | Provider and model, server URL and API keys, answer language, theme |

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `⌘F` / `Ctrl+F` | Find in paper (`Enter` next, `Shift+Enter` previous) |
| `⌘`/`Ctrl` + drag | Explain the selected area as an image |
| `Esc` | Close popovers, menus and area mode |

## Features

- **Subscription first.** Claude goes through the Agent SDK with `ANTHROPIC_API_KEY` removed from its environment, so it always uses your login instead of API billing. Codex runs in a read-only sandbox.
- **The paper as context.** The full text goes along with every question. On the API providers, the PDF is uploaded once through the Files API and then cached.
- **Explain, translate, ask.** Each selection becomes a card that streams in. A card can also be redrawn as an infographic in your theme's colors.
- **Image Explanation.** The selected region is rendered at full resolution and sent as an image.
- **Auto Highlight.** The model returns verbatim key sentences, which are then located in the text layer and highlighted by category.
- **Layout Translate (beta).** Text blocks are translated and laid over the page in place. Results are cached per page.
- **Smart Citations.** A citation marker is resolved against the paper's reference list. Results are cached per paper.
- **Link preview.** Hovering an internal link renders the destination area of the target page.
- **Library.** Import by arXiv ID, PDF link or drag and drop. Organize papers in folders, search them, and see your reading position.
- **Themes from Color Hunt.** Infinite scroll through every palette, with a live preview, plus light and dark mode.
- **Desktop app.** Electron with a hidden-inset title bar on macOS. External links open in the system browser.

## Security model

- **Loopback only.** The server binds to `127.0.0.1`; set `HOST` to change that.
- **Origin allowlist.** `/api/*` accepts requests from the server's own loopback origin, `https://sungmyeonggi.github.io` and `localhost:3000`. Add more with `LUNAREAD_ORIGINS` (comma-separated). Other origins get `403`, because a request here spends your subscription.
- **DNS rebinding guard.** A request counts as same-origin only when its `Host` is `127.0.0.1` or `localhost`.
- **Private Network Access.** Preflights are answered with `access-control-allow-private-network`, and the browser still asks you before a public page may reach `127.0.0.1`.
- **No SSRF through the PDF proxy.** `/api/pdf` fetches only `http(s)` URLs on public hosts. Loopback, private ranges, link-local and ULA addresses are refused.
- **Your Claude setup stays out.** Agent SDK calls run with `settingSources: []`, `tools: []` and one turn, so your `~/.claude` hooks, `CLAUDE.md` and plugins never apply.
- **Keys stay in the browser.** API keys live in `localStorage`, are sent only to your own server, and are never written to disk by it.
- **Request size cap.** Bodies over 60 MB are refused.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | Server port |
| `HOST` | `127.0.0.1` | Bind address |
| `LUNAREAD_ORIGINS` | none | Extra allowed origins |
| `S2_API_KEY` | none | Semantic Scholar API key |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | none | Fallback keys for the API providers |
| `CODEX_HOME` | `~/.codex` | Where to read the Codex login and model cache |
| `NEXT_PUBLIC_BASE_PATH` | none | Base path for the static export (`/Lunaread` on Pages) |
| `NEXT_PUBLIC_API_BASE` | same origin | Server address baked into the export |

In the browser, the IndexedDB database `lunaread` holds papers, PDFs, highlights, notes, chats and AI caches. The `localStorage` key `settings` holds settings.

## Architecture

```
┌──────────────────────── Browser / Electron window ────────────────────────┐
│  Next.js static export (out/)                                             │
│   app/            /, /features, /pricing, /library, /read                 │
│   components/site Landing, nav, mocks (Magic UI-style effects in CSS)     │
│   components/app  Library, Rail, Settings, ThemePicker, GetStarted        │
│   components/viewer Viewer, PdfPage (pdf.js), Panels                      │
│   lib/            api, db (IndexedDB), pdf, layout, theme, types          │
└───────────────────────────────▲───────────────────────────────────────────┘
                                │ fetch / SSE   (same origin, or CORS + PNA)
┌───────────────────────────────┴──── server/server.ts (127.0.0.1:8787) ────┐
│  /api/ai (SSE) · /api/ai-json · /api/upload · /api/models                 │
│  /api/pdf · /api/scholar · /api/palettes · /api/health · static out/      │
│     └── providers.ts ── Claude Agent SDK │ Codex SDK │ Anthropic │ OpenAI │
│     └── prompts.ts ──── task prompts and JSON schemas                     │
└───────────────────────────────────────────────────────────────────────────┘
```

| Path | Purpose |
| --- | --- |
| `app/` | Next.js App Router pages. Library and reader are client-only. |
| `components/site/` | Landing, features and pricing: nav, hero, bento, feature switcher, FAQ |
| `components/magic/` | BlurFade, BorderBeam, Marquee, ShinyText (CSS, no motion library) |
| `components/app/` | Library, rail, settings, the model picker, Color Hunt theme picker, Get started dialog |
| `components/viewer/` | Reader: zoom, search, selection, citations, link previews, area capture, panels |
| `lib/` | Typed client: API client, IndexedDB store, pdf.js helpers, layout and theme math |
| `server/` | Node server, AI providers, prompts and schemas |
| `electron/main.cjs` | Desktop shell; imports the compiled `dist-server/server.js` |
| `lib/*.test.ts` | Unit tests for layout block grouping and theme derivation |

## Build and deploy

```sh
npm run typecheck    # tsc for the app and the server
npm test             # node --test lib/*.test.ts
npm run build        # next build (out/) + tsc server (dist-server/)
npm run build:pages  # export with basePath /Lunaread for GitHub Pages
npm run dev          # server + next dev at http://localhost:3000
npm run desktop      # build, then Electron
npm run dist:mac     # macOS .dmg
npm run dist:win     # Windows installer
```

### Website

Every push to `main` runs `.github/workflows/deploy.yml`. It installs dependencies, runs `npm run build:pages` and deploys `out/` to GitHub Pages at <https://sungmyeonggi.github.io/Lunaread/>.

## Limitations

- On the website, AI features need the local server, plus the browser's permission to reach it.
- Only one person, one browser. There is no sync between devices.
- Scanned PDFs without a text layer get no selection actions, search or Auto Highlight.
- Desktop builds are unsigned.
- The interface is in English only.

## Roadmap

- [ ] OCR for scanned PDFs
- [ ] Signed desktop releases with auto-update
- [ ] Export and import of the library
- [ ] Sync across devices

## Acknowledgements

- Lunaread is an independent project. It is not affiliated with or endorsed by Anthropic, OpenAI or Moonlight.
- Design inspired by the [Magic UI](https://magicui.design) templates.
- Palettes from [Color Hunt](https://colorhunt.co), paper search from [Semantic Scholar](https://www.semanticscholar.org), PDF rendering by [pdf.js](https://mozilla.github.io/pdf.js/).
- Brand logos identify their services only.

## Contributing

- Open an issue before starting substantial work.
- Keep changes focused, and update this README when setup, behavior or security changes.
- Keep secrets, keys and paper data out of the repository.
- Run `npm run typecheck` and `npm test` before opening a pull request.
