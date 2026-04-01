import { app, BrowserWindow, ipcMain, nativeTheme, systemPreferences, Menu, globalShortcut } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { BrowserViewManager } from './browserViews';
import { DEFAULT_PREFERENCES, UserPreferences, AIProvider, ViewMode, Theme, ExtractedResponse, ComparisonResult } from '../shared/types';

// Enable WebAuthn/Passkey support
app.commandLine.appendSwitch('enable-features', 'WebAuthenticationMacOSPasskeys');
app.commandLine.appendSwitch('enable-web-authentication-passkeys');

const store = new Store<{ preferences: UserPreferences }>({
  defaults: {
    preferences: DEFAULT_PREFERENCES,
  },
});

let mainWindow: BrowserWindow | null = null;
let viewManager: BrowserViewManager | null = null;

function createWindow() {
  const preferences = store.get('preferences');
  const bounds = preferences.windowBounds || { width: 1400, height: 900 };

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
  });

  // Log renderer errors
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    console.log(`[renderer] ${message}`);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.log(`[did-fail-load] ${code}: ${desc}`);
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Initialize BrowserView manager with all saved preferences
  viewManager = new BrowserViewManager(mainWindow, {
    aiOrder: preferences.aiOrder,
    viewMode: preferences.viewMode,
    focusedAI: preferences.focusedAI,
  });

  // Set up loading state updates
  viewManager.onLoadingUpdate((tabId, loadingState) => {
    if (mainWindow && tabId === viewManager?.getActiveTabId()) {
      mainWindow.webContents.send('loading-state-updated', loadingState);
    }
  });

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      const prefs = store.get('preferences');
      store.set('preferences', { ...prefs, windowBounds: bounds });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    viewManager = null;
  });

  // Handle resize to update BrowserView positions
  mainWindow.on('resize', () => {
    if (viewManager) {
      viewManager.updateLayout();
    }
  });

  // Apply initial theme
  applyTheme(preferences.theme);

  // Setup application menu with keyboard shortcuts
  setupMenu();
}

function sendTabUpdate() {
  if (viewManager && mainWindow) {
    const tabState = {
      tabs: viewManager.getTabs(),
      activeTabId: viewManager.getActiveTabId(),
    };
    mainWindow.webContents.send('tabs-updated', tabState);
  }
}

function setupMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            if (viewManager) {
              viewManager.createTab();
              sendTabUpdate();
            }
          }
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (viewManager) {
              const activeTabId = viewManager.getActiveTabId();
              if (activeTabId) {
                const result = viewManager.closeTab(activeTabId);
                if (result === 'last-tab') {
                  app.quit();
                } else {
                  sendTabUpdate();
                }
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Select Next Tab',
          accelerator: 'Control+Tab',
          click: () => {
            if (viewManager) {
              viewManager.nextTab();
              sendTabUpdate();
            }
          }
        },
        {
          label: 'Select Previous Tab',
          accelerator: 'Control+Shift+Tab',
          click: () => {
            if (viewManager) {
              viewManager.previousTab();
              sendTabUpdate();
            }
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    nativeTheme.themeSource = 'system';
  } else {
    nativeTheme.themeSource = theme;
  }
}

// IPC Handlers
ipcMain.handle('get-preferences', () => {
  return store.get('preferences');
});

ipcMain.on('send-prompt', (_event, { prompt }: { prompt: string }) => {
  if (viewManager) {
    viewManager.injectPrompt(prompt);
  }
});

ipcMain.on('set-view-mode', (_event, { mode }: { mode: ViewMode }) => {
  const prefs = store.get('preferences');
  store.set('preferences', { ...prefs, viewMode: mode });
  if (viewManager) {
    viewManager.setViewMode(mode);
  }
  mainWindow?.webContents.send('preferences-updated', store.get('preferences'));
});

ipcMain.on('set-theme', (_event, { theme }: { theme: Theme }) => {
  const prefs = store.get('preferences');
  store.set('preferences', { ...prefs, theme });
  applyTheme(theme);
  mainWindow?.webContents.send('preferences-updated', store.get('preferences'));
});

ipcMain.on('reorder-ais', (_event, { order }: { order: AIProvider[] }) => {
  const prefs = store.get('preferences');
  store.set('preferences', { ...prefs, aiOrder: order });
  if (viewManager) {
    viewManager.reorder(order);
  }
  mainWindow?.webContents.send('preferences-updated', store.get('preferences'));
});

ipcMain.on('set-focus', (_event, { ai }: { ai: AIProvider | null }) => {
  const prefs = store.get('preferences');
  store.set('preferences', { ...prefs, focusedAI: ai });
  if (viewManager) {
    viewManager.setFocusedAI(ai);
  }
  mainWindow?.webContents.send('preferences-updated', store.get('preferences'));
});

// Tab management IPC handlers
ipcMain.handle('get-tabs', () => {
  if (!viewManager) return { tabs: [], activeTabId: null, loadingState: {} };
  const activeTabId = viewManager.getActiveTabId();
  return {
    tabs: viewManager.getTabs(),
    activeTabId,
    loadingState: activeTabId ? viewManager.getLoadingState(activeTabId) : {},
  };
});

ipcMain.handle('get-loading-state', () => {
  if (!viewManager) return {};
  const activeTabId = viewManager.getActiveTabId();
  return activeTabId ? viewManager.getLoadingState(activeTabId) : {};
});

ipcMain.handle('create-tab', () => {
  if (!viewManager) return null;
  const tab = viewManager.createTab();
  const tabState = {
    tabs: viewManager.getTabs(),
    activeTabId: viewManager.getActiveTabId(),
  };
  mainWindow?.webContents.send('tabs-updated', tabState);
  return tab;
});

ipcMain.on('set-active-tab', (_event, { tabId }: { tabId: string }) => {
  if (viewManager) {
    viewManager.setActiveTab(tabId);
    const tabState = {
      tabs: viewManager.getTabs(),
      activeTabId: viewManager.getActiveTabId(),
    };
    mainWindow?.webContents.send('tabs-updated', tabState);
  }
});

ipcMain.on('close-tab', (_event, { tabId }: { tabId: string }) => {
  if (viewManager) {
    const result = viewManager.closeTab(tabId);
    if (result === 'last-tab') {
      app.quit();
    } else {
      sendTabUpdate();
    }
  }
});

ipcMain.on('set-bottom-height', (_event, { height }: { height: number }) => {
  if (viewManager) {
    viewManager.setBottomHeight(height);
  }
});

ipcMain.handle('get-share-links', () => {
  if (!viewManager) return [];
  return viewManager.getShareLinks();
});

ipcMain.on('hide-all-views', () => {
  if (viewManager) {
    viewManager.hideAllViews();
  }
});

ipcMain.on('show-all-views', () => {
  if (viewManager) {
    viewManager.showActiveTabViews();
  }
});

// Compare responses
async function callClaudeAPI(responses: ExtractedResponse[]): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const apiKey = store.get('preferences').claudeApiKey;
  if (!apiKey) {
    throw new Error('Claude API key not configured. Click the ··· button next to Compare to add your key.');
  }

  const client = new Anthropic({ apiKey });

  const responseSummary = responses
    .map(r => {
      if (r.text) return `--- ${r.aiName} ---\n${r.text}`;
      return `--- ${r.aiName} ---\n[Failed to extract: ${r.error}]`;
    })
    .join('\n\n');

  const systemPrompt = `You are a response comparison analyst. The user asked the same question to multiple AI assistants and received the following responses. Your job is to:
1. Identify factual discrepancies between the responses
2. Note any contradictions
3. Highlight areas where the AIs agree
4. Flag any response that seems incorrect or unsupported
Be concise and structured. Use markdown formatting.`;

  const userPrompt = `Compare these AI responses and identify discrepancies:\n\n${responseSummary}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  return textBlock?.text || 'No analysis returned.';
}

ipcMain.handle('compare-responses', async (): Promise<ComparisonResult> => {
  if (!viewManager) {
    return { status: 'error', responses: [], analysis: null, error: 'App not ready', timestamp: Date.now() };
  }

  try {
    const responses = await viewManager.extractResponses();
    const successCount = responses.filter(r => r.text !== null).length;

    if (successCount < 2) {
      return {
        status: 'error',
        responses,
        analysis: null,
        error: `Only ${successCount} response(s) extracted. Need at least 2 to compare.`,
        timestamp: Date.now(),
      };
    }

    const analysis = await callClaudeAPI(responses);

    return {
      status: successCount === responses.length ? 'success' : 'partial',
      responses,
      analysis,
      timestamp: Date.now(),
    };
  } catch (err: any) {
    return {
      status: 'error',
      responses: [],
      analysis: null,
      error: err.message || 'Comparison failed',
      timestamp: Date.now(),
    };
  }
});

ipcMain.handle('has-claude-api-key', () => {
  return !!store.get('preferences').claudeApiKey;
});

ipcMain.handle('get-masked-claude-api-key', () => {
  const key = store.get('preferences').claudeApiKey;
  if (!key) return '';
  // Show first 10 chars, mask the rest
  return key.slice(0, 10) + '•'.repeat(Math.max(0, key.length - 10));
});

ipcMain.on('set-claude-api-key', (_event, { apiKey }: { apiKey: string }) => {
  const prefs = store.get('preferences');
  store.set('preferences', { ...prefs, claudeApiKey: apiKey });
  mainWindow?.webContents.send('preferences-updated', store.get('preferences'));
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
