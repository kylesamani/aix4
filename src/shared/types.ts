export type AIProvider = 'chatgpt' | 'claude' | 'gemini' | 'grok';

export interface AIConfig {
  id: AIProvider;
  name: string;
  url: string;
  inputSelector: string;
  submitSelector: string;
  color: string;
}

export const AI_CONFIGS: Record<AIProvider, AIConfig> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
    inputSelector: '#prompt-textarea',
    submitSelector: '[data-testid="send-button"]',
    color: '#10a37f',
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    inputSelector: '[contenteditable="true"]',
    submitSelector: 'button[aria-label="Send Message"]',
    color: '#d97706',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    inputSelector: 'rich-textarea',
    submitSelector: 'button[aria-label="Send message"]',
    color: '#4285f4',
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com',
    inputSelector: 'textarea',
    submitSelector: 'button[type="submit"]',
    color: '#1da1f2',
  },
};

export type ViewMode = 'grid' | 'column' | 'focus';
export type Theme = 'light' | 'dark' | 'system';

export interface Tab {
  id: string;
  title: string;
}

export interface UserPreferences {
  theme: Theme;
  viewMode: ViewMode;
  aiOrder: AIProvider[];
  focusedAI: AIProvider | null;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  claudeApiKey?: string;
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string;
}

export interface LoadingState {
  [aiId: string]: {
    isLoading: boolean;
    progress: number; // 0-100
  };
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  viewMode: 'grid',
  aiOrder: ['chatgpt', 'claude', 'gemini', 'grok'],
  focusedAI: null,
};

export interface ExtractedResponse {
  aiId: AIProvider;
  aiName: string;
  text: string | null;
  error?: string;
}

export interface ComparisonResult {
  status: 'success' | 'error' | 'partial';
  responses: ExtractedResponse[];
  analysis: string | null;
  error?: string;
  timestamp: number;
}

export type ComparisonState =
  | { phase: 'idle' }
  | { phase: 'extracting' }
  | { phase: 'analyzing' }
  | { phase: 'done'; result: ComparisonResult }
  | { phase: 'error'; message: string };

export interface IPCChannels {
  'send-prompt': { prompt: string };
  'set-view-mode': { mode: ViewMode };
  'set-theme': { theme: Theme };
  'reorder-ais': { order: AIProvider[] };
  'set-focus': { ai: AIProvider | null };
  'get-preferences': void;
  'preferences-updated': UserPreferences;
  'ai-loading': { ai: AIProvider; loading: boolean };
}
