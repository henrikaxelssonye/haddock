import { useSelectionStore } from '../../stores';
import type { DuckDBValue } from '../../types';

export function SelectionBar() {
  const selections = useSelectionStore(state => state.selections);
  const clearSelection = useSelectionStore(state => state.clearSelection);
  const clearAllSelections = useSelectionStore(state => state.clearAllSelections);
  const goBack = useSelectionStore(state => state.goBack);
  const goForward = useSelectionStore(state => state.goForward);
  const canGoBack = useSelectionStore(state => state.canGoBack());
  const canGoForward = useSelectionStore(state => state.canGoForward());

  if (selections.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* History navigation */}
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className={`p-1.5 rounded ${
              canGoBack
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            title="Previous selection"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            className={`p-1.5 rounded ${
              canGoForward
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            title="Next selection"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="h-5 w-px bg-gray-300 mx-1" />

          <span className="text-sm text-gray-500 mr-2">Selections:</span>

          {/* Selection pills */}
          <div className="flex flex-wrap gap-2">
            {selections.map((sel) => (
              <div
                key={`${sel.table}.${sel.column}`}
                className="inline-flex items-center gap-1.5 bg-selection-selected/20 text-green-800 px-3 py-1 rounded-full text-sm"
              >
                <span className="font-medium">{sel.table}.{sel.column}</span>
                <span className="text-green-600">=</span>
                <span className="max-w-32 truncate">
                  {formatSelectionValues(sel.values)}
                </span>
                <button
                  onClick={() => clearSelection(sel.table, sel.column)}
                  className="ml-1 p-0.5 rounded-full hover:bg-green-200"
                  title="Clear this selection"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Clear all button */}
        <button
          onClick={clearAllSelections}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded hover:bg-gray-100"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

function formatSelectionValues(values: Set<DuckDBValue>): string {
  const arr = Array.from(values);
  if (arr.length === 1) {
    return formatValue(arr[0]);
  }
  return `${formatValue(arr[0])} +${arr.length - 1}`;
}

function formatValue(value: DuckDBValue): string {
  if (value === null || value === undefined) {
    return '(null)';
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  return String(value);
}
