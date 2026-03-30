import { useState, useEffect } from 'react';
import { TabBar } from './components/TabBar';
import { MenuBar } from './components/MenuBar';
import { PromptInput } from './components/PromptInput';
import { LoadingBars } from './components/LoadingBars';
import { ComparisonPanel } from './components/ComparisonPanel';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AIProvider, ViewMode, Theme, UserPreferences, DEFAULT_PREFERENCES, Tab, TabState, LoadingState, ComparisonState } from '../shared/types';

function App() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isDark, setIsDark] = useState(false);
  const [tabState, setTabState] = useState<TabState>({ tabs: [], activeTabId: null });
  const [loadingState, setLoadingState] = useState<LoadingState>({});
  const [comparisonState, setComparisonState] = useState<ComparisonState>({ phase: 'idle' });
  const [compareActive, setCompareActive] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [pendingCompare, setPendingCompare] = useState(false);

  useEffect(() => {
    // Load initial preferences
    window.electronAPI?.getPreferences().then(setPreferences);

    // Load initial tabs and loading state
    window.electronAPI?.getTabs().then((state) => {
      setTabState(state);
      if (state.loadingState) {
        setLoadingState(state.loadingState);
      }
    });

    // Listen for preference updates
    const unsubscribePrefs = window.electronAPI?.onPreferencesUpdated(setPreferences);

    // Listen for tab updates
    const unsubscribeTabs = window.electronAPI?.onTabsUpdated(setTabState);

    // Listen for loading state updates
    const unsubscribeLoading = window.electronAPI?.onLoadingStateUpdated(setLoadingState);

    return () => {
      unsubscribePrefs?.();
      unsubscribeTabs?.();
      unsubscribeLoading?.();
    };
  }, []);

  useEffect(() => {
    // Handle theme
    const updateTheme = () => {
      if (preferences.theme === 'system') {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      } else {
        setIsDark(preferences.theme === 'dark');
      }
    };

    updateTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const handleSendPrompt = (prompt: string) => {
    window.electronAPI?.sendPrompt(prompt);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    window.electronAPI?.setViewMode(mode);
  };

  const handleThemeChange = (theme: Theme) => {
    window.electronAPI?.setTheme(theme);
  };

  const handleReorder = (newOrder: AIProvider[]) => {
    window.electronAPI?.reorderAIs(newOrder);
  };

  const handleFocusChange = (ai: AIProvider | null) => {
    window.electronAPI?.setFocus(ai);
  };

  const handleTabSelect = (tabId: string) => {
    if (compareActive) {
      setCompareActive(false);
      window.electronAPI?.showAllViews();
    }
    window.electronAPI?.setActiveTab(tabId);
  };

  const handleTabClose = (tabId: string) => {
    window.electronAPI?.closeTab(tabId);
  };

  const handleNewTab = () => {
    window.electronAPI?.createTab();
  };

  const handleShare = async (tabId: string) => {
    // Make sure this tab is active so we get its links
    if (tabId !== tabState.activeTabId) {
      window.electronAPI?.setActiveTab(tabId);
      // Small delay to let the tab activate
      await new Promise(r => setTimeout(r, 100));
    }
    const links = await window.electronAPI?.getShareLinks();
    if (links && links.length > 0) {
      const text = links.map(l => `${l.name}\n${l.url}`).join('\n\n');
      await navigator.clipboard.writeText(text);
    }
  };

  const runCompare = async () => {
    setCompareActive(true);
    window.electronAPI?.hideAllViews();
    setComparisonState({ phase: 'extracting' });
    try {
      setTimeout(() => {
        setComparisonState(prev =>
          prev.phase === 'extracting' ? { phase: 'analyzing' } : prev
        );
      }, 1500);

      const result = await window.electronAPI?.compareResponses();
      if (result) {
        setComparisonState({ phase: 'done', result });
      } else {
        setComparisonState({ phase: 'error', message: 'No result returned' });
      }
    } catch (err: any) {
      setComparisonState({ phase: 'error', message: err.message || 'Comparison failed' });
    }
  };

  const handleCompare = async () => {
    const hasKey = await window.electronAPI?.hasClaudeApiKey();
    if (!hasKey) {
      setPendingCompare(true);
      setShowApiKeyModal(true);
      return;
    }
    runCompare();
  };

  const handleSaveApiKey = (apiKey: string) => {
    window.electronAPI?.setClaudeApiKey(apiKey);
    setShowApiKeyModal(false);
    if (pendingCompare) {
      setPendingCompare(false);
      // Small delay to let the key persist before comparing
      setTimeout(() => runCompare(), 100);
    }
  };

  const handleOpenApiKeySettings = () => {
    setPendingCompare(false);
    setShowApiKeyModal(true);
  };

  const handleCompareTabSelect = () => {
    setCompareActive(true);
    window.electronAPI?.hideAllViews();
  };

  const handleCloseComparison = () => {
    setCompareActive(false);
    setComparisonState({ phase: 'idle' });
    window.electronAPI?.showAllViews();
  };

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Combined Tab Bar and Menu Bar in single row */}
      <div
        className={`drag-region flex items-end ${isDark ? 'bg-gray-900' : 'bg-gray-200'}`}
        style={{ paddingLeft: '80px' }}
      >
        <MenuBar
          viewMode={preferences.viewMode}
          theme={preferences.theme}
          aiOrder={preferences.aiOrder}
          focusedAI={preferences.focusedAI}
          onViewModeChange={handleViewModeChange}
          onThemeChange={handleThemeChange}
          onReorder={handleReorder}
          onFocusChange={handleFocusChange}
          isDark={isDark}
        />
        <TabBar
          tabs={tabState.tabs}
          activeTabId={tabState.activeTabId}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onNewTab={handleNewTab}
          onShare={handleShare}
          isDark={isDark}
          compareActive={compareActive}
          hasComparison={comparisonState.phase !== 'idle'}
          onCompareTabSelect={handleCompareTabSelect}
        />
      </div>

      {/* Middle: Space for BrowserViews or Compare panel */}
      <div className="flex-1 relative">
        {compareActive ? (
          <ComparisonPanel
            comparisonState={comparisonState}
            onClose={handleCloseComparison}
            isDark={isDark}
          />
        ) : (
          <LoadingBars
            loadingState={loadingState}
            aiOrder={preferences.aiOrder}
            viewMode={preferences.viewMode}
            focusedAI={preferences.focusedAI}
          />
        )}
      </div>

      {/* Bottom: Prompt Input with visual separation */}
      <div className={`
        border-t-2 shadow-lg
        ${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'}
      `}>
        <PromptInput
          onSubmit={handleSendPrompt}
          onCompare={handleCompare}
          onOpenApiKeySettings={handleOpenApiKeySettings}
          isComparing={comparisonState.phase !== 'idle' && comparisonState.phase !== 'done'}
          isDark={isDark}
        />
      </div>

      {showApiKeyModal && (
        <ApiKeyModal
          isDark={isDark}
          onSave={handleSaveApiKey}
          onClose={() => { setShowApiKeyModal(false); setPendingCompare(false); }}
        />
      )}
    </div>
  );
}

export default App;
