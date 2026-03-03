import { useState, useRef, useCallback, useEffect } from 'react';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  onCompare: () => void;
  isComparing: boolean;
  isDark: boolean;
}

// Constants for sizing - padding includes py-4 (16px * 2) + p-3 (12px * 2) + hint text (~24px)
const CONTAINER_PADDING = 76;
const LINE_HEIGHT = 24;
const MIN_TEXTAREA_HEIGHT = 44;
const MAX_ROWS = 10;
const MAX_TEXTAREA_HEIGHT = LINE_HEIGHT * MAX_ROWS;
const DEFAULT_BOTTOM_HEIGHT = 110;

export function PromptInput({ onSubmit, onCompare, isComparing, isDark }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const notifyHeightChange = useCallback((textareaHeight: number) => {
    // Calculate total container height: textarea + padding
    const totalHeight = textareaHeight + CONTAINER_PADDING;
    window.electronAPI?.setBottomHeight(totalHeight);
  }, []);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset to minimum to get accurate scrollHeight
    textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;

    // Get the actual content height
    const scrollHeight = textarea.scrollHeight;

    // Calculate new height, clamped between min and max
    const newHeight = Math.max(MIN_TEXTAREA_HEIGHT, Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT));

    // Set the height
    textarea.style.height = `${newHeight}px`;

    // Set overflow based on whether content exceeds max
    textarea.style.overflowY = scrollHeight > MAX_TEXTAREA_HEIGHT ? 'scroll' : 'hidden';

    // Notify main process about height change
    notifyHeightChange(newHeight);
  }, [notifyHeightChange]);

  // Set initial height on mount
  useEffect(() => {
    notifyHeightChange(MIN_TEXTAREA_HEIGHT);
  }, [notifyHeightChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(adjustHeight);
  };

  const handleSubmit = () => {
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    onSubmit(prompt.trim());

    // Reset after brief delay
    setTimeout(() => {
      setPrompt('');
      setIsSubmitting(false);
      // Reset height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
        textareaRef.current.style.overflowY = 'hidden';
        notifyHeightChange(MIN_TEXTAREA_HEIGHT);
      }
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle paste events
  const handlePaste = () => {
    // Delay to allow paste content to be inserted
    setTimeout(adjustHeight, 0);
  };

  return (
    <div className="px-6 py-4">
      <div
        className={`
          flex items-end gap-3 rounded-2xl border-2 p-3 shadow-sm
          ${isDark
            ? 'bg-gray-700 border-gray-600 focus-within:border-blue-500 focus-within:shadow-blue-500/20'
            : 'bg-white border-gray-300 focus-within:border-blue-400 focus-within:shadow-blue-400/20'
          }
          transition-all focus-within:shadow-md
        `}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Send a message to all 4 AIs simultaneously..."
          rows={1}
          style={{
            minHeight: `${MIN_TEXTAREA_HEIGHT}px`,
            height: `${MIN_TEXTAREA_HEIGHT}px`,
            lineHeight: `${LINE_HEIGHT}px`,
          }}
          className={`
            no-drag flex-1 resize-none outline-none bg-transparent px-3 py-2 text-base
            ${isDark ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}
          `}
          disabled={isSubmitting}
        />
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isSubmitting}
          className={`
            no-drag px-6 py-2.5 rounded-xl font-semibold transition-all text-sm flex-shrink-0
            ${prompt.trim() && !isSubmitting
              ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95 shadow-md hover:shadow-lg'
              : isDark
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
              Sending
            </span>
          ) : (
            'Send to All'
          )}
        </button>
        <button
          onClick={onCompare}
          disabled={isComparing}
          className={`
            no-drag px-5 py-2.5 rounded-xl font-semibold transition-all text-sm flex-shrink-0
            ${!isComparing
              ? 'bg-purple-500 text-white hover:bg-purple-600 active:scale-95 shadow-md hover:shadow-lg'
              : isDark
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isComparing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
              Comparing
            </span>
          ) : (
            'Compare'
          )}
        </button>
      </div>
      <p className={`text-xs mt-2 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
