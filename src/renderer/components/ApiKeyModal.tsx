import { useState } from 'react';

interface ApiKeyModalProps {
  isDark: boolean;
  onSave: (apiKey: string) => void;
  onClose: () => void;
  currentKey?: string;
}

export function ApiKeyModal({ isDark, onSave, onClose, currentKey }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState(currentKey || '');

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`
          w-[480px] rounded-2xl shadow-2xl p-6
          ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
        `}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-1">Claude API Key</h2>
        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          The Compare feature uses the Claude API to analyze responses. Enter your API key from{' '}
          <span className="font-medium">console.anthropic.com</span>.
        </p>

        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="sk-ant-..."
          autoFocus
          className={`
            w-full px-4 py-3 rounded-xl border-2 text-sm font-mono outline-none transition-colors
            ${isDark
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-purple-500'
              : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-400'
            }
          `}
        />

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className={`
              px-5 py-2 rounded-xl text-sm font-medium transition-colors
              ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className={`
              px-5 py-2 rounded-xl text-sm font-semibold transition-all
              ${apiKey.trim()
                ? 'bg-purple-500 text-white hover:bg-purple-600 active:scale-95 shadow-md'
                : isDark
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Save
          </button>
        </div>

        <p className={`text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Your key is stored locally on this device and never sent anywhere except the Anthropic API.
        </p>
      </div>
    </div>
  );
}
