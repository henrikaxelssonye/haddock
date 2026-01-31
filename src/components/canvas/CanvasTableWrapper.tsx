import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useCanvasStore, useSchemaStore } from '../../stores';
import type { CanvasTableObject, ColumnSelection } from '../../types';
import { getTablesFromSelections } from '../../types/canvas';
import { CanvasTable } from './CanvasTable';
import { ColumnPicker } from './ColumnPicker';
import { RelationshipDetector } from '../../engine/RelationshipDetector';

const relationshipDetector = new RelationshipDetector();

interface CanvasTableWrapperProps {
  obj: CanvasTableObject;
}

const MIN_WIDTH = 250;
const MIN_HEIGHT = 200;

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const cursorMap: Record<ResizeDirection, string> = {
  n: 'cursor-n-resize',
  s: 'cursor-s-resize',
  e: 'cursor-e-resize',
  w: 'cursor-w-resize',
  ne: 'cursor-ne-resize',
  nw: 'cursor-nw-resize',
  se: 'cursor-se-resize',
  sw: 'cursor-sw-resize',
};

export function CanvasTableWrapper({ obj }: CanvasTableWrapperProps) {
  const updatePosition = useCanvasStore((s) => s.updatePosition);
  const updateSize = useCanvasStore((s) => s.updateSize);
  const removeObject = useCanvasStore((s) => s.removeObject);
  const setSelectedColumns = useCanvasStore((s) => s.setSelectedColumns);
  const setColumnSelections = useCanvasStore((s) => s.setColumnSelections);
  const bringToFront = useCanvasStore((s) => s.bringToFront);

  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Determine if this is a composite table (columns from multiple tables)
  const isComposite = useMemo(
    () => getTablesFromSelections(obj.columnSelections).length > 1,
    [obj.columnSelections]
  );

  // Build display title for header
  const displayTitle = useMemo(() => {
    const tables = getTablesFromSelections(obj.columnSelections);
    if (tables.length === 0) return 'Empty';
    if (tables.length === 1) return tables[0];
    return `${tables[0]} + ${tables.length - 1} more`;
  }, [obj.columnSelections]);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{
    dir: ResizeDirection;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      bringToFront(obj.id);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: obj.position.x,
        origY: obj.position.y,
      };
    },
    [obj.id, obj.position.x, obj.position.y, bringToFront]
  );

  const handleDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      updatePosition(obj.id, {
        x: Math.max(0, dragRef.current.origX + dx),
        y: Math.max(0, dragRef.current.origY + dy),
      });
    },
    [obj.id, updatePosition]
  );

  const handleDragPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleResizePointerDown = useCallback(
    (dir: ResizeDirection, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      bringToFront(obj.id);
      resizeRef.current = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        origX: obj.position.x,
        origY: obj.position.y,
        origW: obj.size.width,
        origH: obj.size.height,
      };
    },
    [obj.id, obj.position.x, obj.position.y, obj.size.width, obj.size.height, bringToFront]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const r = resizeRef.current;
      if (!r) return;

      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;

      let newX = r.origX;
      let newY = r.origY;
      let newW = r.origW;
      let newH = r.origH;

      if (r.dir.includes('e')) newW = Math.max(MIN_WIDTH, r.origW + dx);
      if (r.dir.includes('w')) {
        newW = Math.max(MIN_WIDTH, r.origW - dx);
        newX = r.origX + (r.origW - newW);
      }
      if (r.dir.includes('s')) newH = Math.max(MIN_HEIGHT, r.origH + dy);
      if (r.dir.includes('n')) {
        newH = Math.max(MIN_HEIGHT, r.origH - dy);
        newY = r.origY + (r.origH - newH);
      }

      updatePosition(obj.id, { x: Math.max(0, newX), y: Math.max(0, newY) });
      updateSize(obj.id, { width: newW, height: newH });
    },
    [obj.id, updatePosition, updateSize]
  );

  const handleResizePointerUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  const resizeHandles: { dir: ResizeDirection; className: string }[] = [
    { dir: 'n', className: 'top-0 left-2 right-2 h-1.5 -translate-y-1/2' },
    { dir: 's', className: 'bottom-0 left-2 right-2 h-1.5 translate-y-1/2' },
    { dir: 'e', className: 'right-0 top-2 bottom-2 w-1.5 translate-x-1/2' },
    { dir: 'w', className: 'left-0 top-2 bottom-2 w-1.5 -translate-x-1/2' },
    { dir: 'nw', className: 'top-0 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2' },
    { dir: 'ne', className: 'top-0 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2' },
    { dir: 'sw', className: 'bottom-0 left-0 w-3 h-3 -translate-x-1/2 translate-y-1/2' },
    { dir: 'se', className: 'bottom-0 right-0 w-3 h-3 translate-x-1/2 translate-y-1/2' },
  ];

  return (
    <div
      className="absolute border border-gray-300 rounded-lg overflow-hidden bg-white shadow-md flex flex-col"
      style={{
        left: obj.position.x,
        top: obj.position.y,
        width: obj.size.width,
        height: obj.size.height,
        zIndex: obj.zIndex,
      }}
      onPointerDown={() => bringToFront(obj.id)}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-slate-700 text-white select-none shrink-0"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{displayTitle}</span>
          {isComposite && (
            <span className="text-xs bg-slate-600 px-1.5 py-0.5 rounded">
              Composite
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 relative shrink-0">
          <button
            onClick={() => setShowColumnPicker((v) => !v)}
            className="p-1 rounded hover:bg-slate-600"
            title="Configure columns"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18"
              />
            </svg>
          </button>
          <button
            onClick={() => removeObject(obj.id)}
            className="p-1 rounded hover:bg-slate-600"
            title="Remove from canvas"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {showColumnPicker && !isComposite && obj.tableName && (
            <ColumnPicker
              tableName={obj.tableName}
              selectedColumns={obj.selectedColumns || []}
              onChangeColumns={(cols) => setSelectedColumns(obj.id, cols)}
              onClose={() => setShowColumnPicker(false)}
            />
          )}
          {showColumnPicker && isComposite && (
            <CompositeColumnPickerInline
              columnSelections={obj.columnSelections}
              onChangeColumns={(cols) => setColumnSelections(obj.id, cols)}
              onClose={() => setShowColumnPicker(false)}
            />
          )}
        </div>
      </div>

      {/* Table content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CanvasTable columnSelections={obj.columnSelections} />
      </div>

      {/* Resize handles */}
      {resizeHandles.map(({ dir, className }) => (
        <div
          key={dir}
          className={`absolute ${className} ${cursorMap[dir]} z-20`}
          onPointerDown={(e) => handleResizePointerDown(dir, e)}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />
      ))}
    </div>
  );
}

// Inline version of CompositeColumnPicker for editing existing composite tables
interface CompositeColumnPickerInlineProps {
  columnSelections: ColumnSelection[];
  onChangeColumns: (columns: ColumnSelection[]) => void;
  onClose: () => void;
}

function CompositeColumnPickerInline({
  columnSelections,
  onChangeColumns,
  onClose,
}: CompositeColumnPickerInlineProps) {
  const tables = useSchemaStore((state) => state.tables);
  const relationships = useSchemaStore((state) => state.relationships);
  const ref = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<ColumnSelection[]>([...columnSelections]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(() => {
    // Start with selected tables expanded
    return new Set(getTablesFromSelections(columnSelections));
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [onClose]);

  // Check for unreachable tables
  const unreachableTables = useMemo(() => {
    if (selected.length === 0) return [];
    const selectedTables = [...new Set(selected.map((cs) => cs.table))];
    if (selectedTables.length <= 1) return [];

    const primaryTable = selectedTables[0];
    const unreachable: string[] = [];

    for (let i = 1; i < selectedTables.length; i++) {
      const table = selectedTables[i];
      const path = relationshipDetector.findPath(primaryTable, table, relationships);
      if (!path || path.length === 0) {
        unreachable.push(table);
      }
    }

    return unreachable;
  }, [selected, relationships]);

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
    setSelected((prev) => {
      const exists = prev.some((cs) => cs.table === table && cs.column === column);
      if (exists) {
        const next = prev.filter((cs) => !(cs.table === table && cs.column === column));
        // Ensure at least one column remains
        if (next.length === 0) return prev;
        return next;
      }
      return [...prev, { table, column }];
    });
  };

  const isColumnSelected = (table: string, column: string) => {
    return selected.some((cs) => cs.table === table && cs.column === column);
  };

  const getSelectedCountForTable = (tableName: string) => {
    return selected.filter((cs) => cs.table === tableName).length;
  };

  const handleApply = () => {
    // Filter out unreachable tables
    const validSelections = selected.filter(
      (cs) => unreachableTables.length === 0 || !unreachableTables.includes(cs.table)
    );
    if (validSelections.length > 0) {
      onChangeColumns(validSelections);
    }
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute top-8 right-0 z-50 w-72 bg-white rounded-lg shadow-xl border border-gray-200 max-h-80 flex flex-col"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-gray-200 shrink-0">
        <span className="text-xs font-medium text-gray-700">
          Edit Columns ({selected.length} selected)
        </span>
      </div>

      {unreachableTables.length > 0 && (
        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 shrink-0">
          <div className="text-xs text-amber-700">
            No path to: {unreachableTables.join(', ')}
          </div>
        </div>
      )}

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
              <div
                className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleTableExpand(table.name)}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-3 h-3 text-gray-400 transition-transform ${
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
                  <span className="text-xs font-medium text-gray-700">{table.name}</span>
                  {selectedCount > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">
                      {selectedCount}
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="bg-gray-50 px-3 py-1">
                  <ul className="space-y-0.5">
                    {table.columns.map((col) => {
                      const checked = isColumnSelected(table.name, col.name);
                      return (
                        <li key={col.name}>
                          <label className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-gray-100 rounded px-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleColumn(table.name, col.name)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                            />
                            <span className="text-xs text-gray-700 truncate flex-1">
                              {col.name}
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

      <div className="px-3 py-2 border-t border-gray-200 shrink-0">
        <button
          onClick={handleApply}
          disabled={selected.length === 0}
          className="w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
