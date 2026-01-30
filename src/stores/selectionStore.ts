import { create } from 'zustand';
import type {
  FieldSelection,
  FieldState,
  SelectionSnapshot,
  CellIdentifier,
  DuckDBValue,
  SelectionState
} from '../types';

interface SelectionStore {
  // Current selections (what the user has clicked)
  selections: FieldSelection[];

  // Computed states for all fields (selected/possible/excluded)
  fieldStates: Map<string, FieldState>;

  // History for back/forward navigation
  history: SelectionSnapshot[];
  historyIndex: number;

  // Actions
  selectValue: (cell: CellIdentifier, multiSelect?: boolean) => void;
  clearSelection: (table?: string, column?: string) => void;
  clearAllSelections: () => void;
  setFieldStates: (states: FieldState[]) => void;
  getValueState: (table: string, column: string, value: DuckDBValue) => SelectionState;
  getSelectionKey: (table: string, column: string) => string;

  // History navigation
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
}

const createFieldKey = (table: string, column: string) => `${table}.${column}`;

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selections: [],
  fieldStates: new Map(),
  history: [],
  historyIndex: -1,

  selectValue: (cell: CellIdentifier, multiSelect = false) => {
    set((state) => {
      const { table, column, value } = cell;

      // Find existing selection for this field
      const existingIndex = state.selections.findIndex(
        s => s.table === table && s.column === column
      );

      let newSelections: FieldSelection[];

      if (existingIndex >= 0) {
        const existing = state.selections[existingIndex];
        const newValues = new Set(existing.values);

        if (multiSelect) {
          // Toggle value in multi-select mode
          if (newValues.has(value)) {
            newValues.delete(value);
          } else {
            newValues.add(value);
          }
        } else {
          // Single select: if clicking same value, clear; otherwise replace
          if (newValues.size === 1 && newValues.has(value)) {
            newValues.clear();
          } else {
            newValues.clear();
            newValues.add(value);
          }
        }

        if (newValues.size === 0) {
          // Remove the selection entirely
          newSelections = state.selections.filter((_, i) => i !== existingIndex);
        } else {
          newSelections = state.selections.map((s, i) =>
            i === existingIndex ? { ...s, values: newValues } : s
          );
        }
      } else {
        // New selection for this field
        newSelections = [
          ...state.selections,
          { table, column, values: new Set([value]) }
        ];
      }

      // Save to history
      const snapshot: SelectionSnapshot = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        selections: newSelections,
      };

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);

      return {
        selections: newSelections,
        fieldStates: new Map(),
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  },

  clearSelection: (table?: string, column?: string) => {
    set((state) => {
      let newSelections: FieldSelection[];

      if (table && column) {
        newSelections = state.selections.filter(
          s => !(s.table === table && s.column === column)
        );
      } else if (table) {
        newSelections = state.selections.filter(s => s.table !== table);
      } else {
        newSelections = [];
      }

      return { selections: newSelections, fieldStates: new Map() };
    });
  },

  clearAllSelections: () => {
    set({
      selections: [],
      fieldStates: new Map(),
    });
  },

  setFieldStates: (states: FieldState[]) => {
    const newFieldStates = new Map<string, FieldState>();
    for (const fs of states) {
      const key = createFieldKey(fs.table, fs.column);
      newFieldStates.set(key, fs);
    }
    set({ fieldStates: newFieldStates });
  },

  getValueState: (table: string, column: string, value: DuckDBValue): SelectionState => {
    const { fieldStates, selections } = get();
    const key = createFieldKey(table, column);
    const fieldState = fieldStates.get(key);

    // Check if this value is selected
    const selection = selections.find(s => s.table === table && s.column === column);
    if (selection?.values.has(value)) {
      return 'selected';
    }

    // Check computed states
    if (fieldState?.valueStates.has(value)) {
      return fieldState.valueStates.get(value)!;
    }

    // Default to possible if no selections, otherwise excluded
    return selections.length === 0 ? 'possible' : 'excluded';
  },

  getSelectionKey: (table: string, column: string) => createFieldKey(table, column),

  goBack: () => {
    set((state) => {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];
      return {
        historyIndex: newIndex,
        selections: snapshot.selections,
        fieldStates: new Map(),
      };
    });
  },

  goForward: () => {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const snapshot = state.history[newIndex];
      return {
        historyIndex: newIndex,
        selections: snapshot.selections,
        fieldStates: new Map(),
      };
    });
  },

  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => get().historyIndex < get().history.length - 1,
}));
