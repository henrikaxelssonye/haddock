import { useState, useRef, useEffect } from 'react';
import { useSchemaStore, useCanvasStore } from '../../stores';

export function CanvasToolbar() {
  const tables = useSchemaStore((state) => state.tables);
  const addTableObject = useCanvasStore((s) => s.addTableObject);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const handleAddTable = (tableName: string) => {
    const table = tables.find((t) => t.name === tableName);
    if (!table) return;
    addTableObject(
      tableName,
      table.columns.map((c) => c.name)
    );
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Table
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
            {tables.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">No tables available</div>
            )}
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => handleAddTable(t.name)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="truncate">{t.name}</span>
                <span className="text-xs text-gray-400 ml-2">{t.columns.length} cols</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
