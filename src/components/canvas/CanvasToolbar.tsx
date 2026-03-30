import { useState, useRef, useEffect } from 'react';
import { useSchemaStore, useCanvasStore } from '../../stores';
import { CompositeColumnPicker } from './CompositeColumnPicker';
import { BarChartConfigEditor } from './BarChartConfigEditor';
import { PieChartConfigEditor } from './PieChartConfigEditor';
import type { ColumnSelection, BarChartConfig, PieChartConfig, TableSchema } from '../../types';

function isNumericType(type: string): boolean {
  const normalized = type.toLowerCase();
  return (
    normalized.includes('int') ||
    normalized.includes('decimal') ||
    normalized.includes('numeric') ||
    normalized.includes('double') ||
    normalized.includes('float') ||
    normalized.includes('real')
  );
}

function getDefaultPieChartConfig(tables: TableSchema[]): PieChartConfig | null {
  const firstTable = tables[0];
  const firstColumn = firstTable?.columns[0];
  if (!firstTable || !firstColumn) {
    return null;
  }

  let measure: { table: string; column: string } | null = null;
  for (const table of tables) {
    const numericColumn = table.columns.find((column) => isNumericType(column.type));
    if (numericColumn) {
      measure = { table: table.name, column: numericColumn.name };
      break;
    }
  }

  return {
    category: { table: firstTable.name, column: firstColumn.name },
    measure,
    aggregation: measure ? 'sum' : 'count',
    limit: 10,
  };
}

function getDefaultBarChartConfig(tables: TableSchema[]): BarChartConfig | null {
  const firstTable = tables[0];
  const firstColumn = firstTable?.columns[0];
  if (!firstTable || !firstColumn) {
    return null;
  }

  let measure: { table: string; column: string } | null = null;
  for (const table of tables) {
    const numericColumn = table.columns.find((column) => isNumericType(column.type));
    if (numericColumn) {
      measure = { table: table.name, column: numericColumn.name };
      break;
    }
  }

  return {
    category: { table: firstTable.name, column: firstColumn.name },
    measure,
    aggregation: measure ? 'sum' : 'count',
    limit: 10,
  };
}

export function CanvasToolbar() {
  const tables = useSchemaStore((state) => state.tables);
  const addTableObject = useCanvasStore((s) => s.addTableObject);
  const addCompositeTableObject = useCanvasStore((s) => s.addCompositeTableObject);
  const addBarChartObject = useCanvasStore((s) => s.addBarChartObject);
  const addPieChartObject = useCanvasStore((s) => s.addPieChartObject);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showBarChartEditor, setShowBarChartEditor] = useState(false);
  const [showPieChartEditor, setShowPieChartEditor] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setShowQuickAdd(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barChartRef.current && !barChartRef.current.contains(e.target as Node)) {
        setShowBarChartEditor(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pieChartRef.current && !pieChartRef.current.contains(e.target as Node)) {
        setShowPieChartEditor(false);
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

  const defaultBarChartConfig = getDefaultBarChartConfig(tables);
  const defaultPieChartConfig = getDefaultPieChartConfig(tables);

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

      <div ref={barChartRef} className="relative">
        <button
          onClick={() => setShowBarChartEditor((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:bg-gray-300"
          disabled={!defaultBarChartConfig}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 3v18m0 0h14M9 17V9m4 8V5m4 12v-6"
            />
          </svg>
          Add Bar Chart
        </button>
        {showBarChartEditor && defaultBarChartConfig && (
          <div
            className="absolute top-full left-0 mt-1 z-50"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <BarChartConfigEditor
              initialConfig={defaultBarChartConfig}
              onSubmit={(config) => {
                addBarChartObject(config);
                setShowBarChartEditor(false);
              }}
              onClose={() => setShowBarChartEditor(false)}
              submitLabel="Add"
            />
          </div>
        )}
      </div>

      <div ref={pieChartRef} className="relative">
        <button
          onClick={() => setShowPieChartEditor((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:bg-gray-300"
          disabled={!defaultPieChartConfig}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
            />
          </svg>
          Add Pie Chart
        </button>
        {showPieChartEditor && defaultPieChartConfig && (
          <div
            className="absolute top-full left-0 mt-1 z-50"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <PieChartConfigEditor
              initialConfig={defaultPieChartConfig}
              onSubmit={(config) => {
                addPieChartObject(config);
                setShowPieChartEditor(false);
              }}
              onClose={() => setShowPieChartEditor(false)}
              submitLabel="Add"
            />
          </div>
        )}
      </div>
    </div>
  );
}
