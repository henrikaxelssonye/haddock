import { useState, useCallback, useRef } from 'react';
import { useCanvasStore } from '../../stores';
import type { CanvasTableObject } from '../../types';
import { CanvasTable } from './CanvasTable';
import { ColumnPicker } from './ColumnPicker';

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
  const bringToFront = useCanvasStore((s) => s.bringToFront);

  const [showColumnPicker, setShowColumnPicker] = useState(false);
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
        <span className="text-sm font-medium truncate">{obj.tableName}</span>
        <div className="flex items-center gap-1 relative">
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
          {showColumnPicker && (
            <ColumnPicker
              tableName={obj.tableName}
              selectedColumns={obj.selectedColumns}
              onChangeColumns={(cols) => setSelectedColumns(obj.id, cols)}
              onClose={() => setShowColumnPicker(false)}
            />
          )}
        </div>
      </div>

      {/* Table content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CanvasTable
          tableName={obj.tableName}
          selectedColumns={obj.selectedColumns}
        />
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
