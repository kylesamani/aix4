import ReactMarkdown from 'react-markdown';
import { ComparisonState, ComparisonResult, AI_CONFIGS } from '../../shared/types';

interface ComparisonPanelProps {
  comparisonState: ComparisonState;
  onClose: () => void;
  isDark: boolean;
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function ResultDisplay({ result, isDark }: { result: ComparisonResult; isDark: boolean }) {
  return (
    <div className="space-y-4">
      {/* Extraction status badges */}
      <div className="flex flex-wrap gap-2">
        {result.responses.map((r) => {
          const config = AI_CONFIGS[r.aiId];
          const success = r.text !== null;
          return (
            <div
              key={r.aiId}
              className={`
                flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                ${success
                  ? isDark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800'
                  : isDark ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-800'
                }
              `}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              {r.aiName}
              <span>{success ? '\u2713' : '\u2717'}</span>
            </div>
          );
        })}
      </div>

      {result.status === 'partial' && (
        <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
          Some responses could not be extracted. Analysis is based on available responses.
        </p>
      )}

      {/* Analysis content */}
      {result.analysis && (
        <div
          className={`
            rounded-xl p-5 text-sm leading-relaxed prose max-w-none
            ${isDark ? 'bg-gray-700/50 prose-invert' : 'bg-gray-50'}
          `}
        >
          <ReactMarkdown>{result.analysis}</ReactMarkdown>
        </div>
      )}

      {result.error && (
        <div className={`rounded-xl p-4 text-sm ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
          {result.error}
        </div>
      )}
    </div>
  );
}

export function ComparisonPanel({ comparisonState, onClose, isDark }: ComparisonPanelProps) {
  if (comparisonState.phase === 'idle') return null;

  return (
    <div className={`absolute inset-0 overflow-y-auto p-6 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 max-w-4xl mx-auto">
        <h2 className="text-lg font-bold">Response Comparison</h2>
        <button
          onClick={onClose}
          className={`
            p-1.5 rounded-lg transition-colors
            ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}
          `}
          title="Close comparison"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Loading states */}
        {comparisonState.phase === 'extracting' && (
          <div className="flex items-center gap-3 py-16 justify-center">
            <Spinner />
            <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
              Extracting responses from AI panels...
            </span>
          </div>
        )}

        {comparisonState.phase === 'analyzing' && (
          <div className="flex items-center gap-3 py-16 justify-center">
            <Spinner />
            <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
              Analyzing responses with Claude...
            </span>
          </div>
        )}

        {/* Error state */}
        {comparisonState.phase === 'error' && (
          <div className={`rounded-xl p-4 text-sm ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
            {comparisonState.message}
          </div>
        )}

        {/* Results */}
        {comparisonState.phase === 'done' && (
          <ResultDisplay result={comparisonState.result} isDark={isDark} />
        )}
      </div>
    </div>
  );
}
