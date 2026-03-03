import { contextBridge, ipcRenderer } from 'electron';
import { AIProvider, ViewMode, Theme, UserPreferences, Tab, TabState, LoadingState, ComparisonResult } from '../shared/types';

const electronAPI = {
  sendPrompt: (prompt: string) => ipcRenderer.send('send-prompt', { prompt }),
  setViewMode: (mode: ViewMode) => ipcRenderer.send('set-view-mode', { mode }),
  setTheme: (theme: Theme) => ipcRenderer.send('set-theme', { theme }),
  reorderAIs: (order: AIProvider[]) => ipcRenderer.send('reorder-ais', { order }),
  setFocus: (ai: AIProvider | null) => ipcRenderer.send('set-focus', { ai }),
  getPreferences: (): Promise<UserPreferences> => ipcRenderer.invoke('get-preferences'),
  onPreferencesUpdated: (callback: (prefs: UserPreferences) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, prefs: UserPreferences) => callback(prefs);
    ipcRenderer.on('preferences-updated', handler);
    return () => ipcRenderer.removeListener('preferences-updated', handler);
  },

  // Tab management
  getTabs: (): Promise<TabState & { loadingState?: LoadingState }> => ipcRenderer.invoke('get-tabs'),
  createTab: (): Promise<Tab> => ipcRenderer.invoke('create-tab'),
  setActiveTab: (tabId: string) => ipcRenderer.send('set-active-tab', { tabId }),
  closeTab: (tabId: string) => ipcRenderer.send('close-tab', { tabId }),
  onTabsUpdated: (callback: (tabState: TabState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tabState: TabState) => callback(tabState);
    ipcRenderer.on('tabs-updated', handler);
    return () => ipcRenderer.removeListener('tabs-updated', handler);
  },

  // Loading state
  getLoadingState: (): Promise<LoadingState> => ipcRenderer.invoke('get-loading-state'),
  onLoadingStateUpdated: (callback: (loadingState: LoadingState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, loadingState: LoadingState) => callback(loadingState);
    ipcRenderer.on('loading-state-updated', handler);
    return () => ipcRenderer.removeListener('loading-state-updated', handler);
  },

  // Layout
  setBottomHeight: (height: number) => ipcRenderer.send('set-bottom-height', { height }),

  // View visibility
  hideAllViews: () => ipcRenderer.send('hide-all-views'),
  showAllViews: () => ipcRenderer.send('show-all-views'),

  // Compare responses
  compareResponses: (): Promise<ComparisonResult> => ipcRenderer.invoke('compare-responses'),
  setClaudeApiKey: (apiKey: string) => ipcRenderer.send('set-claude-api-key', { apiKey }),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
