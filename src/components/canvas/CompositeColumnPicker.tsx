import { useState, useEffect, useRef, useMemo } from 'react';
import { useSchemaStore } from '../../stores';
import { RelationshipDetector } from '../../engine/RelationshipDetector';
import type { ColumnSelection } from '../../types';

interface CompositeColumnPickerProps {
  onAddTable: (columnSelections: ColumnSelection[]) => void;
  onClose: () => void;
}

const relationshipDetector = new RelationshipDetector();

export function CompositeColumnPicker({
  onAddTable,
  onClose,
}: CompositeColumnPickerProps) {
  const tables = useSchemaStore((state) => state.tables);
  const relationships = useSchemaStore((state) => state.relationships);
  const ref = useRef<HTMLDivElement>(null);

  const [selectedColumns, setSelectedColumns] = useState<ColumnSelection[]>([]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [onClose]);

  // Check if there are any unreachable tables in the selection
  const unreachableTables = useMemo((): string[] => {
    if (selectedColumns.length === 0) {
      return [];
    }

    const selectedTables = [...new Set(selectedColumns.map((cs) => cs.table))];
    if (selectedTables.length <= 1) {
      return [];
    }

    const primaryTable = selectedTables[0];
    const unreachable: string[] = [];

    for (let i = 1; i < selectedTables.length; i++) {
      const table = selectedTables[i];
      const path = relationshipDetector.findPath(
        primaryTable,
        table,
        relationships
      );
      if (!path || path.length === 0) {
        unreachable.push(table);
      }
    }

    return unreachable;
  }, [selectedColumns, relationships]);

  const toggleTableExpand = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const toggleColumn = (table: string, column: string) => {
    setSelectedColumns((prev) => {
      const exists = prev.some(
        (cs) => cs.table === table && cs.column === column
      );
      if (exists) {
        return prev.filter(
          (cs) => !(cs.table === table && cs.column === column)
        );
      }
      return [...prev, { table, column }];
    });
  };

  const isColumnSelected = (table: string, column: string) => {
    return selectedColumns.some(
      (cs) => cs.table === table && cs.column === column
    );
  };

  const selectAllFromTable = (tableName: string) => {
    const table = tables.find((t) => t.name === tableName);
    if (!table) return;

    const existingOtherTables = selectedColumns.filter(
      (cs) => cs.table !== tableName
    );
    const newFromTable = table.columns.map((c) => ({
      table: tableName,
      column: c.name,
    }));
    setSelectedColumns([...existingOtherTables, ...newFromTable]);
  };

  const clearTableSelection = (tableName: string) => {
    setSelectedColumns((prev) =>
      prev.filter((cs) => cs.table !== tableName)
    );
  };

  const getSelectedCountForTable = (tableName: string) => {
    return selectedColumns.filter((cs) => cs.table === tableName).length;
  };

  const handleAddToCanvas = () => {
    if (selectedColumns.length === 0) return;
    // Filter out unreachable columns
    const validSelections = selectedColumns.filter(
      (cs) =>
        unreachableTables.length === 0 || !unreachableTables.includes(cs.table)
    );
    if (validSelections.length > 0) {
      onAddTable(validSelections);
    }
  };

  const removeSelectedColumn = (table: string, column: string) => {
    setSelectedColumns((prev) =>
      prev.filter((cs) => !(cs.table === table && cs.column === column))
    );
  };

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[500px] flex flex-col"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800">
            Select Columns
          </span>
          <span className="text-xs text-gray-400">
            {selectedColumns.length} selected
          </span>
        </div>
      </div>

      {/* Selected columns as tags */}
      {selectedColumns.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 shrink-0">
          <div className="flex flex-wrap gap-1">
            {selectedColumns.map((cs) => {
              const isUnreachable = unreachableTables.includes(cs.table);
              return (
                <span
                  key={`${cs.table}.${cs.column}`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                    isUnreachable
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  <span className="truncate max-w-[120px]">
                    {cs.table}.{cs.column}
                  </span>
                  <button
                    onClick={() => removeSelectedColumn(cs.table, cs.column)}
                    className="hover:text-blue-900"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Warning for unreachable tables */}
      {unreachableTables.length > 0 && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-amber-500 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="text-xs text-amber-700">
              <p className="font-medium">No relationship path found</p>
              <p>
                Tables {unreachableTables.join(', ')} cannot be joined to the
                selected columns. They will be excluded.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tables list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tables.map((table) => {
          const isExpanded = expandedTables.has(table.name);
          const selectedCount = getSelectedCountForTable(table.name);
          const isUnreachable = unreachableTables.includes(table.name);

          return (
            <div
              key={table.name}
              className={`border-b border-gray-100 last:border-b-0 ${
                isUnreachable ? 'opacity-50' : ''
              }`}
            >
              {/* Table header */}
              <div
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleTableExpand(table.name)}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">
                    {table.name}
                  </span>
                  {selectedCount > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {selectedCount}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {table.columns.length} cols
                </span>
              </div>

              {/* Columns list */}
              {isExpanded && (
                <div className="bg-gray-50 px-3 py-1">
                  <div className="flex justify-end gap-2 mb-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAllFromTable(table.name);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Select all
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearTableSelection(table.name);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="space-y-0.5">
                    {table.columns.map((col) => {
                      const checked = isColumnSelected(table.name, col.name);
                      return (
                        <li key={col.name}>
                          <label className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-100 rounded px-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleColumn(table.name, col.name)
                              }
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 truncate flex-1">
                              {col.name}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0">
                              {col.type}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer with Add button */}
      <div className="px-3 py-2 border-t border-gray-200 shrink-0">
        <button
          onClick={handleAddToCanvas}
          disabled={selectedColumns.length === 0}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Add to Canvas
        </button>
      </div>
    </div>
  );
}
