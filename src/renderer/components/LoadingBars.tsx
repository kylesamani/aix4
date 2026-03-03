import { LoadingState, AIProvider, AI_CONFIGS, ViewMode } from '../../shared/types';

interface LoadingBarsProps {
  loadingState: LoadingState;
  aiOrder: AIProvider[];
  viewMode: ViewMode;
  focusedAI: AIProvider | null;
}

export function LoadingBars({ loadingState, aiOrder, viewMode, focusedAI }: LoadingBarsProps) {
  // In focus mode, only show loading bar for the focused AI
  if (viewMode === 'focus') {
    const focused = focusedAI || aiOrder[0];
    const state = loadingState[focused];
    if (!state?.isLoading) return null;

    const config = AI_CONFIGS[focused];
    return (
      <div className="absolute left-1 right-1 top-0 h-[3px] z-50">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${state.progress}%`,
            backgroundColor: config.color,
          }}
        />
      </div>
    );
  }

  // Grid mode: 2x2 layout
  if (viewMode === 'grid') {
    return (
      <div className="absolute inset-0 pointer-events-none z-50">
        {aiOrder.map((aiId, index) => {
          const state = loadingState[aiId];
          if (!state?.isLoading) return null;

          const config = AI_CONFIGS[aiId];
          const col = index % 2;
          const row = Math.floor(index / 2);

          return (
            <div
              key={aiId}
              className="absolute h-[3px]"
              style={{
                left: col === 0 ? '4px' : '50%',
                right: col === 0 ? '50%' : '4px',
                top: row === 0 ? '0' : '50%',
                marginLeft: col === 1 ? '2px' : 0,
                marginRight: col === 0 ? '2px' : 0,
              }}
            >
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{
                  width: `${state.progress}%`,
                  backgroundColor: config.color,
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Column mode: 4 side-by-side
  if (viewMode === 'column') {
    return (
      <div className="absolute inset-0 pointer-events-none z-50">
        {aiOrder.map((aiId, index) => {
          const state = loadingState[aiId];
          if (!state?.isLoading) return null;

          const config = AI_CONFIGS[aiId];
          const widthPercent = 100 / aiOrder.length;

          return (
            <div
              key={aiId}
              className="absolute h-[3px] top-0"
              style={{
                left: `calc(${index * widthPercent}% + 4px)`,
                width: `calc(${widthPercent}% - 8px)`,
              }}
            >
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{
                  width: `${state.progress}%`,
                  backgroundColor: config.color,
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
