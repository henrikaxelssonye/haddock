import { create } from 'zustand';
import type {
  CanvasTableObject,
  CanvasObjectPosition,
  CanvasObjectSize,
} from '../types';

interface CanvasState {
  objects: CanvasTableObject[];
  isCanvasMode: boolean;
  nextZIndex: number;

  setCanvasMode: (enabled: boolean) => void;
  addTableObject: (tableName: string, columns: string[]) => void;
  removeObject: (id: string) => void;
  updatePosition: (id: string, position: CanvasObjectPosition) => void;
  updateSize: (id: string, size: CanvasObjectSize) => void;
  setSelectedColumns: (id: string, columns: string[]) => void;
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

    const newObject: CanvasTableObject = {
      id: crypto.randomUUID(),
      tableName,
      position: { x: 20 + offset, y: 20 + offset },
      size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      selectedColumns: [...columns],
      zIndex: nextZIndex,
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
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, selectedColumns: columns } : obj
      ),
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
