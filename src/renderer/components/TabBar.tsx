import { Tab } from '../../shared/types';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onShare: (tabId: string) => void;
  isDark: boolean;
  compareActive: boolean;
  hasComparison: boolean;
  onCompareTabSelect: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onShare,
  isDark,
  compareActive,
  hasComparison,
  onCompareTabSelect,
}: TabBarProps) {
  return (
    <div
      className={`
        flex items-end gap-0.5 px-2 pt-1 pb-0 overflow-x-auto flex-1 min-w-0
      `}
    >
      {/* Compare Tab - shown when a comparison exists */}
      {hasComparison && (
        <div
          onClick={onCompareTabSelect}
          className={`
            no-drag group relative flex items-center gap-1.5 px-4 py-2 cursor-pointer
            transition-all min-w-[120px] max-w-[200px]
            ${compareActive
              ? isDark
                ? 'bg-gray-800 text-purple-400'
                : 'bg-white text-purple-600'
              : isDark
                ? 'bg-gray-800/40 text-gray-400 hover:bg-gray-800/70 hover:text-purple-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-50 hover:text-purple-500'
            }
          `}
          style={{
            borderTopLeftRadius: '10px',
            borderTopRightRadius: '10px',
            marginBottom: compareActive ? '-1px' : '0',
            zIndex: compareActive ? 10 : 1,
            boxShadow: compareActive
              ? isDark
                ? '0 -1px 3px rgba(0,0,0,0.3)'
                : '0 -1px 3px rgba(0,0,0,0.08)'
              : 'none',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.389zm1.088-6.858A7 7 0 004.688 7.576l.312.311H2.567a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V5.003a.75.75 0 00-1.5 0v2.033l-.312-.311A5.5 5.5 0 0114.862 4.955a.75.75 0 001.449.389z" clipRule="evenodd" />
          </svg>
          <span className="truncate text-sm font-medium">Compare</span>
        </div>
      )}

      {tabs.map((tab, index) => {
        const isActive = activeTabId === tab.id && !compareActive;

        return (
          <div
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
            className={`
              no-drag group relative flex items-center gap-2 px-4 py-2 cursor-pointer
              transition-all min-w-[120px] max-w-[200px]
              ${isActive
                ? isDark
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-900'
                : isDark
                  ? 'bg-gray-800/40 text-gray-400 hover:bg-gray-800/70 hover:text-gray-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
            style={{
              borderTopLeftRadius: '10px',
              borderTopRightRadius: '10px',
              marginBottom: isActive ? '-1px' : '0',
              zIndex: isActive ? 10 : 1,
              boxShadow: isActive
                ? isDark
                  ? '0 -1px 3px rgba(0,0,0,0.3)'
                  : '0 -1px 3px rgba(0,0,0,0.08)'
                : 'none',
            }}
          >
            {/* Tab title */}
            <span className="truncate text-sm font-medium flex-1">{tab.title}</span>

            {/* Share button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(tab.id);
              }}
              title="Copy share links for all 4 AIs"
              className={`
                flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                transition-all
                ${isActive
                  ? 'opacity-60 hover:opacity-100'
                  : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
                }
                ${isDark
                  ? 'hover:bg-gray-600 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'
                }
              `}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3 h-3"
              >
                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
              </svg>
            </button>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className={`
                flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                transition-all
                ${isActive || tabs.length === 1
                  ? 'opacity-60 hover:opacity-100'
                  : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
                }
                ${isDark
                  ? 'hover:bg-gray-600 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'
                }
              `}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3 h-3"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        );
      })}

      {/* New Tab Button */}
      <button
        onClick={onNewTab}
        className={`
          no-drag flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
          transition-colors mb-1 ml-1
          ${isDark
            ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          }
        `}
        title="New Tab (Cmd+T)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
      </button>

      {/* Fill remaining space with the bar background that connects to active tab */}
      <div className="flex-1" />
    </div>
  );
}
