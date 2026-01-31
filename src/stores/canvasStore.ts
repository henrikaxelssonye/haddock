import { create } from 'zustand';
import type {
  CanvasTableObject,
  CanvasObjectPosition,
  CanvasObjectSize,
  ColumnSelection,
} from '../types';
import { toColumnSelections, getPrimaryTable } from '../types/canvas';

interface CanvasState {
  objects: CanvasTableObject[];
  isCanvasMode: boolean;
  nextZIndex: number;

  setCanvasMode: (enabled: boolean) => void;
  // Legacy signature for backward compatibility
  addTableObject: (tableName: string, columns: string[]) => void;
  // New signature for composite tables
  addCompositeTableObject: (columnSelections: ColumnSelection[]) => void;
  removeObject: (id: string) => void;
  updatePosition: (id: string, position: CanvasObjectPosition) => void;
  updateSize: (id: string, size: CanvasObjectSize) => void;
  // Legacy signature for single-table column updates
  setSelectedColumns: (id: string, columns: string[]) => void;
  // New signature for composite column updates
  setColumnSelections: (id: string, columnSelections: ColumnSelection[]) => void;
  bringToFront: (id: string) => void;
}

const STAGGER_OFFSET = 30;
const DEFAULT_WIDTH = 500;
const DEFAULT_HEIGHT = 350;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  objects: [],
  isCanvasMode: false,
  nextZIndex: 1,

  setCanvasMode: (enabled: boolean) => {
    set({ isCanvasMode: enabled });
  },

  addTableObject: (tableName: string, columns: string[]) => {
    const { objects, nextZIndex } = get();
    const offset = objects.length * STAGGER_OFFSET;

    // Convert legacy format to new columnSelections format
    const columnSelections = toColumnSelections(tableName, columns);

    const newObject: CanvasTableObject = {
      id: crypto.randomUUID(),
      columnSelections,
      position: { x: 20 + offset, y: 20 + offset },
      size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      zIndex: nextZIndex,
      // Keep legacy fields for backward compatibility
      tableName,
      selectedColumns: [...columns],
    };

    set({
      objects: [...objects, newObject],
      nextZIndex: nextZIndex + 1,
    });
  },

  addCompositeTableObject: (columnSelections: ColumnSelection[]) => {
    const { objects, nextZIndex } = get();
    const offset = objects.length * STAGGER_OFFSET;

    const primaryTable = getPrimaryTable(columnSelections) || 'Composite';

    const newObject: CanvasTableObject = {
      id: crypto.randomUUID(),
      columnSelections: [...columnSelections],
      position: { x: 20 + offset, y: 20 + offset },
      size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      zIndex: nextZIndex,
      // Legacy fields - use primary table for display
      tableName: primaryTable,
      selectedColumns: columnSelections.map((cs) => cs.column),
    };

    set({
      objects: [...objects, newObject],
      nextZIndex: nextZIndex + 1,
    });
  },

  removeObject: (id: string) => {
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
    }));
  },

  updatePosition: (id: string, position: CanvasObjectPosition) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, position } : obj
      ),
    }));
  },

  updateSize: (id: string, size: CanvasObjectSize) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, size } : obj
      ),
    }));
  },

  setSelectedColumns: (id: string, columns: string[]) => {
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id) return obj;
        // Get the primary table from existing columnSelections
        const primaryTable = getPrimaryTable(obj.columnSelections) || obj.tableName || '';
        const newColumnSelections = toColumnSelections(primaryTable, columns);
        return {
          ...obj,
          selectedColumns: columns,
          columnSelections: newColumnSelections,
        };
      }),
    }));
  },

  setColumnSelections: (id: string, columnSelections: ColumnSelection[]) => {
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id) return obj;
        const primaryTable = getPrimaryTable(columnSelections) || 'Composite';
        return {
          ...obj,
          columnSelections: [...columnSelections],
          // Update legacy fields
          tableName: primaryTable,
          selectedColumns: columnSelections.map((cs) => cs.column),
        };
      }),
    }));
  },

  bringToFront: (id: string) => {
    const { nextZIndex } = get();
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, zIndex: nextZIndex } : obj
      ),
      nextZIndex: nextZIndex + 1,
    }));
  },
}));
