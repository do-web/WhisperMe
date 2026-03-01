# WhisperMe

> **Like Whisper Flow — but free and open source.** Bring your own OpenAI API key, pay only for what you use.

A lightweight macOS menu bar app that turns your voice into text — anywhere. Hold your **hotkey** (default: FN), speak, release. Your words appear at the cursor, auto-corrected and ready to go.

---

## Why WhisperMe?

| | Whisper Flow | WhisperMe |
|---|---|---|
| **Price** | Subscription | Free (pay-per-use API) |
| **Cost** | ~$8/month | ~$0.01/day typical |
| **API** | Built-in | Bring your own key |
| **Open Source** | No | Yes |
| **Hotkey** | Configurable | Configurable (default: FN) |

---

## Features

- **Push-to-talk** — hold your hotkey to record, release to transcribe (FN, F-keys, key combos like Ctrl+Space)
- **Works everywhere** — text is inserted at your cursor in any app
- **AI auto-correct** — GPT-5-mini fixes grammar and punctuation, recognizes dev terms (`readme dot md` → `@README.md`)
- **Live waveform** — real-time audio visualization while recording
- **Auto-detect language** — or pin a specific language (10+ supported)
- **Mute audio** — optionally mutes system audio while you speak
- **Launch at login** — always ready when you need it
- **Menu bar only** — no dock icon, no distractions
- **Privacy first** — audio is sent directly to OpenAI, never stored on any server

---

## Demo

```
1. Hold hotkey    →  Recording...  ▁▂▅▃▇▅▂▁
2. Speak          → "update the readme dot md and check the users endpoint"
3. Release key    →  Processing...
4. Auto-inserted  → "Update the @README.md and check the /users endpoint."
```

---

## Quick Start

### Requirements

- macOS 13+ (Ventura or later)
- Apple Silicon or Intel Mac
- [OpenAI API key](https://platform.openai.com/api-keys)
- Node.js 18+

### Install & Run

```bash
git clone https://github.com/do-web/WhisperMe.git
cd whisperme
npm install

# Build native hotkey addon
npx node-gyp rebuild
npx @electron/rebuild -m .

# Run
npm run dev
```

### Build DMG

```bash
npm run dist
# → dist/mac-arm64/WhisperMe.app
```

---

## Permissions

On first launch, WhisperMe guides you through granting the required macOS permissions automatically:

| Permission | Why | Setup |
|---|---|---|
| Microphone | Audio recording | Native system dialog |
| Accessibility | Pasting text via ⌘V | Opens System Settings for you |
| Input Monitoring | Detecting hotkey | Opens System Settings for you |

When using FN as hotkey (default), WhisperMe configures it to "Do Nothing" so it doesn't trigger Emoji picker or Dictation.

---

## Settings

Open via the tray icon → **Settings**:

| Setting | Description | Default |
|---|---|---|
| **OpenAI API Key** | Required for transcription | — |
| **Language** | Auto-detect or specific language | Auto-detect |
| **Push-to-Talk Key** | FN, F-keys, or key combos (e.g. Ctrl+Space) | FN (Globe) |
| **Auto-correct** | GPT-5-mini post-processing | On |
| **Mute audio** | Mute system audio while recording | Off |
| **Launch at login** | Start WhisperMe on macOS login | Off |

---

## How it works

1. **Hotkey press** is detected via a native C++ addon running a `CGEventTap` (supports FN, single keys, and modifier combos)
2. **Audio** is recorded in the renderer via `MediaRecorder` (WebM/Opus)
3. **Transcription** is done by OpenAI `gpt-4o-transcribe`
4. **Correction** (optional) is done by `gpt-5-mini` — fixes punctuation and grammar only
5. **Insertion** pastes via clipboard + simulated ⌘V — text stays in clipboard for re-use
6. **Fallback** — if ⌘V fails, text stays in clipboard with a macOS notification

---

## Cost

You pay only for actual OpenAI API usage:

| | Price | Example |
|---|---|---|
| **gpt-4o-transcribe** | ~$0.006/min | 10 min/day = $0.06 |
| **GPT-5-mini correction** | ~$0.0001/request | 50 requests = $0.005 |
| **Daily total** | | **~$0.07** |

Typical usage costs a few cents per day — orders of magnitude cheaper than subscription-based alternatives.

---

## Project Structure

```
WhisperMe/
├── src/                        Source code (TypeScript + HTML)
│   ├── main/                   Electron main process
│   │   ├── index.ts            App entry + orchestration
│   │   ├── hotkey-bridge.ts     Configurable hotkey bridge (FN, keys, combos)
│   │   ├── audio-recorder.ts   Audio recording controller
│   │   ├── transcription.ts    OpenAI transcription + correction pipeline
│   │   ├── text-inserter.ts    Clipboard + ⌘V text insertion
│   │   ├── media-controller.ts System audio mute/unmute during recording
│   │   ├── overlay.ts          Transparent status overlay window
│   │   ├── tray.ts             Menu bar tray icon + context menu
│   │   ├── permissions.ts      macOS permission auto-setup
│   │   ├── store.ts            Encrypted settings store
│   │   ├── logger.ts           In-memory log system + log viewer window
│   │   └── ipc-handlers.ts     Main↔Renderer IPC
│   ├── renderer/               Frontend HTML (loaded by BrowserWindows)
│   │   ├── index.html          Overlay UI (recording/processing status)
│   │   ├── settings.html       Settings window
│   │   ├── log.html            Log viewer (Tray → "Show Log...")
│   │   └── overlay.css         Overlay styles
│   ├── preload/                Electron preload scripts (IPC bridge)
│   └── shared/                 Shared TypeScript types & constants
│
├── native/                     C++ Node.js addon source
│   └── fn_monitor.cc           CGEventTap for hotkey detection (FN, keys, modifier combos)
│
├── swift-helper/               Swift CLI helper
│   ├── Package.swift           Swift package manifest
│   └── Sources/FnKeyMonitor/
│       └── main.swift          FN key monitor (fallback for sandboxed contexts)
│
├── assets/                     App icons
│   ├── trayTemplate.png        Menu bar icon (normal)
│   └── tray-recording.png      Menu bar icon (recording)
│
├── scripts/                    Build scripts
│   └── build-swift-helper.sh   Compiles the Swift helper binary
│
├── binding.gyp                 node-gyp build config for native/fn_monitor.cc
├── electron-builder.yml        Electron-builder packaging config
├── tsconfig.json               TypeScript compiler config
└── package.json                Dependencies + npm scripts
```

### Generated directories (not in git)

| Directory | Generated by | Contents |
|---|---|---|
| `dist/main/`, `dist/preload/`, `dist/shared/` | `npm run build:ts` | Compiled JavaScript from `src/` |
| `dist/mac-arm64/` | `npm run dist` | Packaged `.app` bundle |
| `bin/` | `@electron/rebuild` | Prebuilt native addon (`.node`) |
| `build/Release/` | `npx node-gyp rebuild` | Compiled C++ addon (`fn_monitor.node`) |
| `swift-helper/.build/` | `npm run build:swift` | Compiled Swift binary |
| `node_modules/` | `npm install` | Dependencies |

---

## Author

**Dominik Weber** — [dominikweber.me](https://dominikweber.me/)

## License

MIT
