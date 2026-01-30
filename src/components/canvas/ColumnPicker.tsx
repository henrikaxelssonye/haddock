import { useEffect, useRef } from 'react';
import { useSchemaStore } from '../../stores';

interface ColumnPickerProps {
  tableName: string;
  selectedColumns: string[];
  onChangeColumns: (columns: string[]) => void;
  onClose: () => void;
}

export function ColumnPicker({
  tableName,
  selectedColumns,
  onChangeColumns,
  onClose,
}: ColumnPickerProps) {
  const tables = useSchemaStore((state) => state.tables);
  const ref = useRef<HTMLDivElement>(null);

  const tableSchema = tables.find((t) => t.name === tableName);
  const allColumns = tableSchema?.columns ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [onClose]);

  const toggleColumn = (colName: string) => {
    if (selectedColumns.includes(colName)) {
      if (selectedColumns.length <= 1) return;
      onChangeColumns(selectedColumns.filter((c) => c !== colName));
    } else {
      onChangeColumns([...selectedColumns, colName]);
    }
  };

  const selectAll = () => {
    onChangeColumns(allColumns.map((c) => c.name));
  };

  const selectMinimal = () => {
    onChangeColumns([allColumns[0]?.name].filter(Boolean));
  };

  return (
    <div
      ref={ref}
      className="absolute top-8 right-0 z-50 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">Columns</span>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            All
          </button>
          <button
            onClick={selectMinimal}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Minimal
          </button>
        </div>
      </div>
      <ul className="max-h-60 overflow-y-auto py-1">
        {allColumns.map((col) => {
          const checked = selectedColumns.includes(col.name);
          const isLast = selectedColumns.length === 1 && checked;
          return (
            <li key={col.name}>
              <label
                className={`flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer ${
                  isLast ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isLast}
                  onChange={() => toggleColumn(col.name)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate flex-1 text-gray-800">{col.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{col.type}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
