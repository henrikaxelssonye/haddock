import { useMemo, useState } from 'react';
import { useSchemaStore } from '../../stores';
import type { BarChartAggregation, BarChartConfig } from '../../types';

interface BarChartConfigEditorProps {
  initialConfig: BarChartConfig;
  onSubmit: (config: BarChartConfig) => void;
  onClose: () => void;
  submitLabel: string;
}

const AGGREGATIONS: BarChartAggregation[] = ['count', 'sum', 'avg', 'min', 'max'];

function toColumnKey(table: string, column: string): string {
  return `${table}.${column}`;
}

function parseColumnKey(
  value: string
): { table: string; column: string } | null {
  const separatorIndex = value.lastIndexOf('.');
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) {
    return null;
  }
  return {
    table: value.slice(0, separatorIndex),
    column: value.slice(separatorIndex + 1),
  };
}

export function BarChartConfigEditor({
  initialConfig,
  onSubmit,
  onClose,
  submitLabel,
}: BarChartConfigEditorProps) {
  const tables = useSchemaStore((state) => state.tables);
  const [categoryKey, setCategoryKey] = useState(
    toColumnKey(initialConfig.category.table, initialConfig.category.column)
  );
  const [measureKey, setMeasureKey] = useState(
    initialConfig.measure
      ? toColumnKey(initialConfig.measure.table, initialConfig.measure.column)
      : ''
  );
  const [aggregation, setAggregation] = useState<BarChartAggregation>(
    initialConfig.aggregation
  );
  const [limitText, setLimitText] = useState(
    initialConfig.limit ? String(initialConfig.limit) : ''
  );
  const [error, setError] = useState<string | null>(null);

  const groupedColumns = useMemo(
    () =>
      tables.map((table) => ({
        table: table.name,
        columns: table.columns.map((column) => column.name),
      })),
    [tables]
  );

  const handleSubmit = () => {
    const parsedCategory = parseColumnKey(categoryKey);
    if (!parsedCategory) {
      setError('Select a category column.');
      return;
    }

    const parsedMeasure = parseColumnKey(measureKey);
    if (aggregation !== 'count' && !parsedMeasure) {
      setError('Select a measure column for this aggregation.');
      return;
    }

    const parsedLimit = limitText.trim() ? Number(limitText) : null;
    if (parsedLimit !== null && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      setError('Top N must be a positive number.');
      return;
    }

    setError(null);
    onSubmit({
      category: parsedCategory,
      measure: parsedMeasure,
      aggregation,
      limit: parsedLimit ? Math.floor(parsedLimit) : null,
    });
  };

  return (
    <div className="w-80 bg-white text-gray-900 border border-gray-200 rounded-lg shadow-xl p-3 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
        <select
          value={categoryKey}
          onChange={(event) => setCategoryKey(event.target.value)}
          className="w-full border border-gray-300 bg-white text-gray-900 rounded px-2 py-1.5 text-sm"
        >
          <option value="">Select category column</option>
          {groupedColumns.map((table) => (
            <optgroup key={table.table} label={table.table}>
              {table.columns.map((column) => (
                <option key={`${table.table}.${column}`} value={`${table.table}.${column}`}>
                  {column}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Aggregation</label>
        <select
          value={aggregation}
          onChange={(event) => setAggregation(event.target.value as BarChartAggregation)}
          className="w-full border border-gray-300 bg-white text-gray-900 rounded px-2 py-1.5 text-sm"
        >
          {AGGREGATIONS.map((value) => (
            <option key={value} value={value}>
              {value.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Measure {aggregation === 'count' ? '(optional)' : ''}
        </label>
        <select
          value={measureKey}
          onChange={(event) => setMeasureKey(event.target.value)}
          className="w-full border border-gray-300 bg-white text-gray-900 rounded px-2 py-1.5 text-sm"
        >
          <option value="">None</option>
          {groupedColumns.map((table) => (
            <optgroup key={table.table} label={table.table}>
              {table.columns.map((column) => (
                <option key={`${table.table}.${column}`} value={`${table.table}.${column}`}>
                  {column}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Top N (optional)</label>
        <input
          type="number"
          min={1}
          value={limitText}
          onChange={(event) => setLimitText(event.target.value)}
          className="w-full border border-gray-300 bg-white text-gray-900 rounded px-2 py-1.5 text-sm"
          placeholder="No limit"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
