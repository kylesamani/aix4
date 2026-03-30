import { BrowserWindow, BrowserView, session } from 'electron';
import { AIProvider, AI_CONFIGS, ViewMode, Tab, ExtractedResponse } from '../shared/types';

// Layout constants
const TOP_HEIGHT = 55;      // Combined menu bar + tab bar in single row
const DEFAULT_BOTTOM_HEIGHT = 110;  // Default prompt input area at bottom
const GAP = 4;              // Gap between panels
const LOADING_BAR_HEIGHT = 3; // Thin loading bar at top of each panel

export interface LoadingState {
  [aiId: string]: {
    isLoading: boolean;
    progress: number; // 0-100
  };
}

interface TabViews {
  tab: Tab;
  views: Map<AIProvider, BrowserView>;
  loadingStates: Map<AIProvider, { isLoading: boolean; progress: number }>;
}

interface BrowserViewManagerOptions {
  aiOrder: AIProvider[];
  viewMode: ViewMode;
  focusedAI: AIProvider | null;
}

export class BrowserViewManager {
  private window: BrowserWindow;
  private tabs: Map<string, TabViews> = new Map();
  private activeTabId: string | null = null;
  private order: AIProvider[];
  private viewMode: ViewMode = 'grid';
  private focusedAI: AIProvider | null = null;
  private tabCounter = 0;
  private initializedSessions: Set<string> = new Set();
  private loadingUpdateCallback: ((tabId: string, loadingState: LoadingState) => void) | null = null;
  private bottomHeight: number = DEFAULT_BOTTOM_HEIGHT;

  constructor(window: BrowserWindow, options: BrowserViewManagerOptions) {
    this.window = window;
    this.order = options.aiOrder;
    this.viewMode = options.viewMode;
    this.focusedAI = options.focusedAI;

    // Create initial tab
    this.createTab();
  }

  private getOrCreateSession(aiId: AIProvider): Electron.Session {
    // Use shared persistent session for each AI (shared across all tabs and app restarts)
    const partitionName = `persist:${aiId}`;
    const ses = session.fromPartition(partitionName);

    // Only setup permissions once per session
    if (!this.initializedSessions.has(partitionName)) {
      ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
        callback(true);
      });

      ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
        return true;
      });

      ses.setDevicePermissionHandler((details) => {
        return true;
      });

      this.initializedSessions.add(partitionName);
    }

    return ses;
  }

  createTab(): Tab {
    this.tabCounter++;
    const tabId = `tab-${Date.now()}-${this.tabCounter}`;
    const tab: Tab = {
      id: tabId,
      title: `Tab ${this.tabCounter}`,
    };

    const views = new Map<AIProvider, BrowserView>();
    const loadingStates = new Map<AIProvider, { isLoading: boolean; progress: number }>();

    for (const aiId of this.order) {
      const config = AI_CONFIGS[aiId];

      // Initialize loading state
      loadingStates.set(aiId, { isLoading: true, progress: 0 });

      // Get shared session for this AI (persists across tabs and app restarts)
      const ses = this.getOrCreateSession(aiId);

      const view = new BrowserView({
        webPreferences: {
          session: ses,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          allowRunningInsecureContent: false,
          webSecurity: true,
        },
      });

      this.window.addBrowserView(view);

      view.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('accounts.google.com') ||
            url.includes('appleid.apple.com') ||
            url.includes('auth0.com') ||
            url.includes('login') ||
            url.includes('oauth') ||
            url.includes('signin')) {
          return { action: 'allow' };
        }
        view.webContents.loadURL(url);
        return { action: 'deny' };
      });

      // Set up loading event listeners
      view.webContents.on('did-start-loading', () => {
        loadingStates.set(aiId, { isLoading: true, progress: 10 });
        this.sendLoadingUpdate(tabId);
      });

      view.webContents.on('did-stop-loading', () => {
        loadingStates.set(aiId, { isLoading: false, progress: 100 });
        this.sendLoadingUpdate(tabId);
      });

      view.webContents.on('did-finish-load', () => {
        loadingStates.set(aiId, { isLoading: false, progress: 100 });
        this.sendLoadingUpdate(tabId);
      });

      view.webContents.on('did-fail-load', () => {
        loadingStates.set(aiId, { isLoading: false, progress: 100 });
        this.sendLoadingUpdate(tabId);
      });

      // Track loading progress (approximate via DOM ready state)
      view.webContents.on('dom-ready', () => {
        const current = loadingStates.get(aiId);
        if (current?.isLoading) {
          loadingStates.set(aiId, { isLoading: true, progress: 70 });
          this.sendLoadingUpdate(tabId);
        }
      });

      view.webContents.loadURL(config.url);

      view.webContents.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Initially hide all views (will be shown when tab is activated)
      view.setBounds({ x: -10000, y: -10000, width: 100, height: 100 });

      views.set(aiId, view);
    }

    this.tabs.set(tabId, { tab, views, loadingStates });

    // Always switch to the newly created tab
    this.setActiveTab(tabId);

    return tab;
  }

  private sendLoadingUpdate(tabId: string) {
    if (!this.loadingUpdateCallback) return;

    const tabViews = this.tabs.get(tabId);
    if (!tabViews) return;

    const loadingState: LoadingState = {};
    tabViews.loadingStates.forEach((state, aiId) => {
      loadingState[aiId] = state;
    });

    this.loadingUpdateCallback(tabId, loadingState);
  }

  onLoadingUpdate(callback: (tabId: string, loadingState: LoadingState) => void) {
    this.loadingUpdateCallback = callback;
  }

  getLoadingState(tabId: string): LoadingState {
    const tabViews = this.tabs.get(tabId);
    if (!tabViews) return {};

    const loadingState: LoadingState = {};
    tabViews.loadingStates.forEach((state, aiId) => {
      loadingState[aiId] = state;
    });

    return loadingState;
  }

  closeTab(tabId: string): 'closed' | 'last-tab' | 'not-found' {
    const tabViews = this.tabs.get(tabId);
    if (!tabViews) return 'not-found';

    // If this is the last tab, signal to quit the app
    if (this.tabs.size <= 1) return 'last-tab';

    // Get ordered list of tab IDs to find the left neighbor
    const tabIds = Array.from(this.tabs.keys());
    const closingIndex = tabIds.indexOf(tabId);

    // Remove all views for this tab
    for (const view of tabViews.views.values()) {
      this.window.removeBrowserView(view);
    }
    tabViews.views.clear();
    tabViews.loadingStates.clear();
    this.tabs.delete(tabId);

    // If we closed the active tab, switch to the appropriate one
    if (this.activeTabId === tabId) {
      const remainingTabIds = Array.from(this.tabs.keys());
      if (remainingTabIds.length > 0) {
        // Switch to the tab to the left, or the new left-most if we closed the left-most
        const newIndex = Math.max(0, closingIndex - 1);
        const newActiveId = remainingTabIds[Math.min(newIndex, remainingTabIds.length - 1)];
        this.setActiveTab(newActiveId);
      }
    }

    return 'closed';
  }

  nextTab() {
    const tabIds = Array.from(this.tabs.keys());
    if (tabIds.length <= 1 || !this.activeTabId) return;

    const currentIndex = tabIds.indexOf(this.activeTabId);
    const nextIndex = (currentIndex + 1) % tabIds.length;
    this.setActiveTab(tabIds[nextIndex]);
  }

  previousTab() {
    const tabIds = Array.from(this.tabs.keys());
    if (tabIds.length <= 1 || !this.activeTabId) return;

    const currentIndex = tabIds.indexOf(this.activeTabId);
    const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
    this.setActiveTab(tabIds[prevIndex]);
  }

  setActiveTab(tabId: string) {
    if (!this.tabs.has(tabId)) return;

    // Hide views of previously active tab
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      const prevTabViews = this.tabs.get(this.activeTabId)!;
      for (const view of prevTabViews.views.values()) {
        view.setBounds({ x: -10000, y: -10000, width: 100, height: 100 });
      }
    }

    this.activeTabId = tabId;
    this.updateLayout();
  }

  getTabs(): Tab[] {
    return Array.from(this.tabs.values()).map(tv => tv.tab);
  }

  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  setBottomHeight(height: number) {
    this.bottomHeight = Math.max(DEFAULT_BOTTOM_HEIGHT, height);
    this.updateLayout();
  }

  updateLayout() {
    if (!this.activeTabId) return;

    const tabViews = this.tabs.get(this.activeTabId);
    if (!tabViews) return;

    const [windowWidth, windowHeight] = this.window.getSize();
    const availableHeight = windowHeight - TOP_HEIGHT - this.bottomHeight;
    const availableWidth = windowWidth;

    switch (this.viewMode) {
      case 'grid':
        this.layoutGrid(availableWidth, availableHeight, tabViews.views);
        break;
      case 'column':
        this.layoutColumns(availableWidth, availableHeight, tabViews.views);
        break;
      case 'focus':
        this.layoutFocus(availableWidth, availableHeight, tabViews.views);
        break;
    }
  }

  private layoutGrid(width: number, height: number, views: Map<AIProvider, BrowserView>) {
    const cols = 2;
    const rows = 2;
    const cellWidth = Math.floor((width - GAP * 3) / cols);
    const cellHeight = Math.floor((height - GAP * 3) / rows);

    this.order.forEach((aiId, index) => {
      const view = views.get(aiId);
      if (!view) return;

      const col = index % cols;
      const row = Math.floor(index / cols);

      view.setBounds({
        x: GAP + col * (cellWidth + GAP),
        y: TOP_HEIGHT + GAP + row * (cellHeight + GAP),
        width: cellWidth,
        height: cellHeight,
      });
    });
  }

  private layoutColumns(width: number, height: number, views: Map<AIProvider, BrowserView>) {
    const count = this.order.length;
    const cellWidth = Math.floor((width - GAP * (count + 1)) / count);

    this.order.forEach((aiId, index) => {
      const view = views.get(aiId);
      if (!view) return;

      view.setBounds({
        x: GAP + index * (cellWidth + GAP),
        y: TOP_HEIGHT + GAP,
        width: cellWidth,
        height: height - GAP * 2,
      });
    });
  }

  private layoutFocus(width: number, height: number, views: Map<AIProvider, BrowserView>) {
    const focused = this.focusedAI || this.order[0];

    // Focused view takes the entire area
    const focusedView = views.get(focused);
    if (focusedView) {
      focusedView.setBounds({
        x: GAP,
        y: TOP_HEIGHT + GAP,
        width: width - GAP * 2,
        height: height - GAP * 2,
      });
    }

    // Hide other views by moving them off-screen
    this.order.forEach((aiId) => {
      if (aiId !== focused) {
        const view = views.get(aiId);
        if (view) {
          view.setBounds({
            x: -10000,
            y: -10000,
            width: 100,
            height: 100,
          });
        }
      }
    });
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    this.updateLayout();
  }

  setFocusedAI(ai: AIProvider | null) {
    this.focusedAI = ai;
    if (this.viewMode === 'focus') {
      this.updateLayout();
    }
  }

  reorder(newOrder: AIProvider[]) {
    this.order = newOrder;
    this.updateLayout();
  }

  async injectPrompt(prompt: string) {
    if (!this.activeTabId) return;

    const tabViews = this.tabs.get(this.activeTabId);
    if (!tabViews) return;

    const escapedPrompt = prompt
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    for (const [aiId, view] of tabViews.views) {
      const script = this.getInjectionScript(aiId, escapedPrompt);

      try {
        await view.webContents.executeJavaScript(script);
        console.log(`Injected prompt into ${aiId}`);
      } catch (error) {
        console.error(`Failed to inject prompt into ${aiId}:`, error);
      }
    }
  }

  private getInjectionScript(aiId: AIProvider, prompt: string): string {
    switch (aiId) {
      case 'chatgpt':
        return `
          (async function() {
            const text = \`${prompt}\`;
            let editor = document.querySelector('#prompt-textarea');
            if (!editor) editor = document.querySelector('[data-testid="text-input"]');
            if (!editor) editor = document.querySelector('div[contenteditable="true"]');
            if (!editor) editor = document.querySelector('textarea');
            if (!editor) { console.log('ChatGPT: No input found'); return; }
            editor.focus();
            if (editor.contentEditable === 'true' || editor.getAttribute('contenteditable') === 'true') {
              editor.innerHTML = '';
              const p = document.createElement('p');
              p.textContent = text;
              editor.appendChild(p);
              editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
            } else {
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
              nativeSetter.call(editor, text);
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
            await new Promise(r => setTimeout(r, 300));
            let sendBtn = document.querySelector('[data-testid="send-button"]');
            if (!sendBtn) sendBtn = document.querySelector('button[aria-label*="Send"]');
            if (!sendBtn) sendBtn = document.querySelector('form button[type="submit"]');
            if (!sendBtn) {
              const buttons = document.querySelectorAll('button');
              for (const btn of buttons) {
                if (btn.querySelector('svg') && btn.closest('form')) { sendBtn = btn; break; }
              }
            }
            if (sendBtn && !sendBtn.disabled) { sendBtn.click(); console.log('ChatGPT: Clicked send'); }
          })();
        `;

      case 'claude':
        return `
          (async function() {
            const text = \`${prompt}\`;
            let editor = document.querySelector('div[contenteditable="true"].ProseMirror');
            if (!editor) editor = document.querySelector('div.ProseMirror[contenteditable="true"]');
            if (!editor) editor = document.querySelector('[contenteditable="true"]');
            if (!editor) { console.log('Claude: No editor found'); return; }
            editor.focus();
            editor.innerHTML = '<p>' + text + '</p>';
            editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
            editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
            editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
            editor.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
            await new Promise(r => setTimeout(r, 500));
            let sendBtn = document.querySelector('button[aria-label="Send Message"]');
            if (!sendBtn) sendBtn = document.querySelector('button[aria-label*="Send"]');
            if (!sendBtn) sendBtn = document.querySelector('[data-testid="send-button"]');
            if (!sendBtn) {
              const buttons = document.querySelectorAll('button');
              for (const btn of buttons) {
                const rect = btn.getBoundingClientRect();
                const editorRect = editor.getBoundingClientRect();
                if (btn.querySelector('svg') && Math.abs(rect.bottom - editorRect.bottom) < 100) { sendBtn = btn; break; }
              }
            }
            if (sendBtn && !sendBtn.disabled) { sendBtn.click(); console.log('Claude: Clicked send'); }
          })();
        `;

      case 'gemini':
        return `
          (async function() {
            const text = \`${prompt}\`;
            let inputArea = document.querySelector('.ql-editor[contenteditable="true"]');
            if (!inputArea) inputArea = document.querySelector('rich-textarea .ql-editor');
            if (!inputArea) inputArea = document.querySelector('div.ql-editor');
            if (!inputArea) inputArea = document.querySelector('[contenteditable="true"][data-placeholder]');
            if (!inputArea) inputArea = document.querySelector('rich-textarea [contenteditable="true"]');
            if (!inputArea) {
              const rt = document.querySelector('rich-textarea');
              if (rt) { rt.click(); await new Promise(r => setTimeout(r, 300)); inputArea = document.querySelector('.ql-editor[contenteditable="true"]'); }
            }
            if (!inputArea) { console.log('Gemini: No input found'); return; }
            inputArea.focus();
            await new Promise(r => setTimeout(r, 100));
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            try {
              await navigator.clipboard.writeText(text);
              document.execCommand('paste');
              console.log('Gemini: Used clipboard paste');
            } catch (clipboardErr) {
              const dt = new DataTransfer();
              dt.setData('text/plain', text);
              const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
              inputArea.dispatchEvent(pasteEvent);
              if (!inputArea.textContent || inputArea.textContent.trim() === '') {
                document.execCommand('insertText', false, text);
              }
            }
            inputArea.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: text }));
            await new Promise(r => setTimeout(r, 800));
            let sendBtn = null;
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              const tooltip = (btn.getAttribute('mattooltip') || '').toLowerCase();
              const dataTooltip = (btn.getAttribute('data-tooltip') || '').toLowerCase();
              if (aria.includes('send') || tooltip.includes('send') || dataTooltip.includes('send')) { sendBtn = btn; break; }
            }
            if (!sendBtn) sendBtn = document.querySelector('.send-button');
            if (!sendBtn) sendBtn = document.querySelector('button.mdc-icon-button[aria-label*="end"]');
            if (!sendBtn) {
              const container = inputArea.closest('.input-area-container') || inputArea.closest('.chat-input') || inputArea.closest('form') || inputArea.parentElement?.parentElement?.parentElement;
              if (container) { sendBtn = container.querySelector('button[aria-label*="end"]') || container.querySelector('button:not([disabled])'); }
            }
            if (sendBtn && !sendBtn.disabled) { sendBtn.click(); console.log('Gemini: Clicked send button'); }
            else {
              const enterEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13, view: window });
              inputArea.dispatchEvent(enterEvent);
            }
          })();
        `;

      case 'grok':
        return `
          (async function() {
            const text = \`${prompt}\`;
            // Grok's input lives inside div.absolute.bottom-0 and may be textarea or contenteditable
            const bottomBar = document.querySelector('div.absolute.bottom-0');
            let input = null;
            if (bottomBar) {
              input = bottomBar.querySelector('textarea') || bottomBar.querySelector('[contenteditable="true"]');
            }
            if (!input) input = document.querySelector('textarea[placeholder*="Ask"]');
            if (!input) input = document.querySelector('textarea[placeholder*="message"]');
            if (!input) input = document.querySelector('textarea');
            if (!input) input = document.querySelector('[contenteditable="true"]');
            if (!input) { console.log('Grok: No input found'); return; }
            input.focus();
            await new Promise(r => setTimeout(r, 100));
            if (input.tagName === 'TEXTAREA') {
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
              nativeSetter.call(input, text);
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              // contenteditable element - clear and use execCommand for React state sync
              input.focus();
              document.execCommand('selectAll', false, null);
              document.execCommand('delete', false, null);
              document.execCommand('insertText', false, text);
              input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
            }
            await new Promise(r => setTimeout(r, 500));
            // Find send button - try aria-label first, then type=submit, then form fallback
            let sendBtn = null;
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              if (aria.includes('send')) { sendBtn = btn; break; }
            }
            if (!sendBtn) sendBtn = document.querySelector('button[type="submit"]');
            if (!sendBtn) sendBtn = document.querySelector('[data-testid="send-button"]');
            if (!sendBtn) {
              const form = input.closest('form');
              if (form) { sendBtn = form.querySelector('button:not([disabled])'); }
            }
            if (sendBtn && !sendBtn.disabled) { sendBtn.click(); console.log('Grok: Clicked send'); }
            else {
              // Fallback: try Enter key
              input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
              console.log('Grok: Used Enter key fallback');
            }
          })();
        `;

      default:
        return '';
    }
  }

  async extractResponses(): Promise<ExtractedResponse[]> {
    if (!this.activeTabId) return [];
    const tabViews = this.tabs.get(this.activeTabId);
    if (!tabViews) return [];

    const promises = this.order.map(async (aiId): Promise<ExtractedResponse> => {
      const view = tabViews.views.get(aiId);
      if (!view) {
        return { aiId, aiName: AI_CONFIGS[aiId].name, text: null, error: 'View not found' };
      }
      try {
        const script = this.getExtractionScript(aiId);
        const text = await view.webContents.executeJavaScript(script);
        return {
          aiId,
          aiName: AI_CONFIGS[aiId].name,
          text: typeof text === 'string' && text.trim() ? text.trim() : null,
          error: (!text || !text.trim()) ? 'No response found' : undefined,
        };
      } catch (err: any) {
        return { aiId, aiName: AI_CONFIGS[aiId].name, text: null, error: err.message || 'Extraction failed' };
      }
    });

    return Promise.all(promises);
  }

  private getExtractionScript(aiId: AIProvider): string {
    switch (aiId) {
      case 'chatgpt':
        return `
          (function() {
            let msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('article[data-testid^="conversation-turn"] .markdown.prose');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('main .markdown');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            return null;
          })();
        `;

      case 'claude':
        return `
          (function() {
            let msgs = document.querySelectorAll('.font-claude-message');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('[data-is-streaming]');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('.prose');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('div[class*="message"] div[class*="prose"]');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            return null;
          })();
        `;

      case 'gemini':
        return `
          (function() {
            let msgs = document.querySelectorAll('model-response');
            if (msgs.length > 0) {
              var last = msgs[msgs.length - 1];
              var content = last.querySelector('.model-response-text') || last.querySelector('.markdown') || last;
              return content.innerText;
            }
            msgs = document.querySelectorAll('.response-container .message-content');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('.markdown-main-panel');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('message-content');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            return null;
          })();
        `;

      case 'grok':
        return `
          (function() {
            let msgs = document.querySelectorAll('div[class*="message"] div[class*="markdown"]');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('[data-testid="message-text"]');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('.markdown-content');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            msgs = document.querySelectorAll('.prose, .markdown');
            if (msgs.length > 0) return msgs[msgs.length - 1].innerText;
            return null;
          })();
        `;

      default:
        return 'null';
    }
  }

  getShareLinks(): { aiId: AIProvider; name: string; url: string }[] {
    if (!this.activeTabId) return [];
    const tabViews = this.tabs.get(this.activeTabId);
    if (!tabViews) return [];

    return this.order.map(aiId => {
      const view = tabViews.views.get(aiId);
      return {
        aiId,
        name: AI_CONFIGS[aiId].name,
        url: view ? view.webContents.getURL() : AI_CONFIGS[aiId].url,
      };
    });
  }

  hideAllViews() {
    if (!this.activeTabId) return;
    const tabViews = this.tabs.get(this.activeTabId);
    if (!tabViews) return;

    for (const view of tabViews.views.values()) {
      view.setBounds({ x: -10000, y: -10000, width: 100, height: 100 });
    }
  }

  showActiveTabViews() {
    this.updateLayout();
  }

  destroy() {
    for (const tabViews of this.tabs.values()) {
      for (const view of tabViews.views.values()) {
        this.window.removeBrowserView(view);
      }
      tabViews.views.clear();
    }
    this.tabs.clear();
  }
}
