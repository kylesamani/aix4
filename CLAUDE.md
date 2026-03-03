# AIx4

Desktop app for comparing AI chat responses from ChatGPT, Claude, Gemini, and Grok side-by-side. Built with Electron + React + TypeScript.

## Tech Stack
- Electron 28 (main process: Node.js, renderer: Chromium)
- React 18 + TypeScript 5.3
- Vite for bundling
- Tailwind CSS for styling
- electron-store for persistent settings
- dnd-kit for drag-and-drop

## Project Structure
```
src/
├── main/           # Electron main process
│   ├── main.ts     # App init, IPC handlers, window management
│   ├── browserViews.ts  # BrowserViewManager for AI panels
│   └── preload.ts  # Secure IPC bridge
├── renderer/       # React UI
│   ├── App.tsx     # Root component
│   ├── components/ # MenuBar, TabBar, PromptInput, LoadingBars
│   └── index.css   # Tailwind entry
└── shared/
    └── types.ts    # Shared TypeScript types
```

## Commands
- `npm run dev` - Start dev mode (renderer + main concurrently)
- `npm run build` - Build for production
- `npm run package` - Package app with electron-builder

## Code Conventions

**Naming:**
- Components/Types: PascalCase (`MenuBar`, `AIProvider`)
- Functions: camelCase (`handleSendPrompt`)
- IPC channels: kebab-case (`send-prompt`, `set-view-mode`)
- Booleans: prefix with `is`, `has`, `on`

**Patterns:**
- Functional components with hooks
- Props interfaces for component typing
- Event handlers named `handle{Action}`
- Tailwind utilities only (no custom CSS classes)
- Dark mode via class toggle on document root

**Architecture:**
- Main process manages BrowserViews (one per AI per tab)
- Renderer communicates via IPC through preload script
- Context isolation enabled - no direct Node access in renderer
- Preferences persisted with electron-store

## IPC Channels
- `send-prompt` - Send prompt to all AI panels
- `set-view-mode` - Change layout (grid/column/focus)
- `set-theme` - Toggle theme
- `reorder-ais` - Update AI order after drag
- `get-preferences` / `preferences-updated` - Settings sync
- `get-tabs` / `create-tab` / `close-tab` / `tabs-updated` - Tab management

## Layout Constants
- TOP_HEIGHT: 55px (menu bar)
- GAP: 4px (spacing between panels)
- Loading bar height: 3px
