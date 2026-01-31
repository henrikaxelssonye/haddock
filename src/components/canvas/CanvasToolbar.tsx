import { useState, useRef, useEffect } from 'react';
import { useSchemaStore, useCanvasStore } from '../../stores';
import { CompositeColumnPicker } from './CompositeColumnPicker';
import type { ColumnSelection } from '../../types';

export function CanvasToolbar() {
  const tables = useSchemaStore((state) => state.tables);
  const addTableObject = useCanvasStore((s) => s.addTableObject);
  const addCompositeTableObject = useCanvasStore((s) => s.addCompositeTableObject);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setShowQuickAdd(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const handleQuickAddTable = (tableName: string) => {
    const table = tables.find((t) => t.name === tableName);
    if (!table) return;
    addTableObject(
      tableName,
      table.columns.map((c) => c.name)
    );
    setShowQuickAdd(false);
  };

  const handleAddComposite = (columnSelections: ColumnSelection[]) => {
    addCompositeTableObject(columnSelections);
    setShowColumnPicker(false);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
      {/* Quick add single table */}
      <div ref={quickAddRef} className="relative">
        <button
          onClick={() => setShowQuickAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Quick Add
        </button>
        {showQuickAdd && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
            {tables.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">No tables available</div>
            )}
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => handleQuickAddTable(t.name)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="truncate">{t.name}</span>
                <span className="text-xs text-gray-400 ml-2">{t.columns.length} cols</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add composite table with column picker */}
      <div className="relative">
        <button
          onClick={() => setShowColumnPicker((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          Add Columns
        </button>
        {showColumnPicker && (
          <CompositeColumnPicker
            onAddTable={handleAddComposite}
            onClose={() => setShowColumnPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
