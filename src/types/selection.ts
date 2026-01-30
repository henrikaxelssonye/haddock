import type { DuckDBValue } from './database';

export type SelectionState = 'selected' | 'possible' | 'alternative' | 'excluded';

export interface FieldSelection {
  table: string;
  column: string;
  values: Set<DuckDBValue>;
}

export interface FieldState {
  table: string;
  column: string;
  valueStates: Map<DuckDBValue, SelectionState>;
}

export interface SelectionSnapshot {
  id: string;
  timestamp: number;
  selections: FieldSelection[];
}

export interface CellIdentifier {
  table: string;
  column: string;
  value: DuckDBValue;
}
