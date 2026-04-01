import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AIProvider, ViewMode, Theme, AI_CONFIGS } from '../../shared/types';

interface MenuBarProps {
  viewMode: ViewMode;
  theme: Theme;
  aiOrder: AIProvider[];
  focusedAI: AIProvider | null;
  onViewModeChange: (mode: ViewMode) => void;
  onThemeChange: (theme: Theme) => void;
  onReorder: (order: AIProvider[]) => void;
  onFocusChange: (ai: AIProvider | null) => void;
  onNavigate?: (ai: AIProvider, action: 'back' | 'forward' | 'refresh') => void;
  isDark: boolean;
}

interface SortableAIChipProps {
  ai: AIProvider;
  isFocused: boolean;
  viewMode: ViewMode;
  onFocusClick: () => void;
  onNavigate?: (action: 'back' | 'forward' | 'refresh') => void;
  isDark: boolean;
}

function SortableAIChip({ ai, isFocused, viewMode, onFocusClick, onNavigate, isDark }: SortableAIChipProps) {
  const [hovered, setHovered] = useState(false);
  const leaveTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: ai });
  const config = AI_CONFIGS[ai];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const showToolbar = viewMode === 'focus' && isFocused && hovered;

  const handleMouseEnter = () => {
    if (leaveTimeout.current) { clearTimeout(leaveTimeout.current); leaveTimeout.current = null; }
    setHovered(true);
  };

  const handleMouseLeave = () => {
    leaveTimeout.current = setTimeout(() => setHovered(false), 200);
  };

  return (
    <div
      className="flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`
          no-drag flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-grab active:cursor-grabbing
          ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}
          ${isFocused && viewMode === 'focus' ? 'ring-2 ring-blue-500' : ''}
          border ${isDark ? 'border-gray-600' : 'border-gray-200'}
          shadow-sm transition-all
        `}
        onClick={onFocusClick}
      >
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: config.color }}
        />
        <span className="text-sm font-medium">{config.name}</span>
      </div>
      {showToolbar && (
        <div className="flex items-center gap-0.5 ml-1">
          <button
            className={`no-drag px-1.5 py-1 rounded text-xs transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'}`}
            onClick={(e) => { e.stopPropagation(); onNavigate?.('back'); }}
            title="Back"
          >
            ◀
          </button>
          <button
            className={`no-drag px-1.5 py-1 rounded text-xs transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'}`}
            onClick={(e) => { e.stopPropagation(); onNavigate?.('refresh'); }}
            title="Refresh"
          >
            ↻
          </button>
          <button
            className={`no-drag px-1.5 py-1 rounded text-xs transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'}`}
            onClick={(e) => { e.stopPropagation(); onNavigate?.('forward'); }}
            title="Forward"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}

export function MenuBar({
  viewMode,
  theme,
  aiOrder,
  focusedAI,
  onViewModeChange,
  onThemeChange,
  onReorder,
  onFocusChange,
  onNavigate,
  isDark,
}: MenuBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = aiOrder.indexOf(active.id as AIProvider);
      const newIndex = aiOrder.indexOf(over.id as AIProvider);
      const newOrder = arrayMove(aiOrder, oldIndex, newIndex);
      onReorder(newOrder);
    }
  };

  const viewModes: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: 'grid', icon: '⊞', label: 'Grid' },
    { mode: 'column', icon: '⫾', label: 'Column' },
    { mode: 'focus', icon: '◱', label: 'Focus' },
  ];

  const themes: { value: Theme; icon: string; label: string }[] = [
    { value: 'light', icon: '☀️', label: 'Light' },
    { value: 'dark', icon: '🌙', label: 'Dark' },
    { value: 'system', icon: '💻', label: 'System' },
  ];

  return (
    <div
      className={`
        px-3 py-1.5 flex items-center gap-3 flex-shrink-0
      `}
    >
      {/* AI Chips - Draggable */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={aiOrder} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-2">
            {aiOrder.map((ai) => (
              <SortableAIChip
                key={ai}
                ai={ai}
                isFocused={focusedAI === ai}
                viewMode={viewMode}
                onFocusClick={() => {
                  if (viewMode === 'focus') {
                    onFocusChange(focusedAI === ai ? null : ai);
                  }
                }}
                onNavigate={(action) => onNavigate?.(ai, action)}
                isDark={isDark}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* View Mode Selector */}
      <div className="flex items-center gap-1">
        {viewModes.map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={`
              no-drag px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${viewMode === mode
                ? isDark
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white'
                : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
            title={label}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Theme Selector */}
      <div className="flex items-center gap-1">
        {themes.map(({ value, icon, label }) => (
          <button
            key={value}
            onClick={() => onThemeChange(value)}
            className={`
              no-drag px-2 py-1.5 rounded-lg text-sm transition-all
              ${theme === value
                ? isDark
                  ? 'bg-gray-600'
                  : 'bg-gray-200'
                : isDark
                  ? 'hover:bg-gray-700'
                  : 'hover:bg-gray-100'
              }
            `}
            title={label}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
