export interface CanvasObjectPosition {
  x: number;
  y: number;
}

export interface CanvasObjectSize {
  width: number;
  height: number;
}

export interface ColumnSelection {
  table: string;
  column: string;
}

export interface CanvasTableObject {
  id: string;
  // New: array of table.column selections for composite tables
  columnSelections: ColumnSelection[];
  position: CanvasObjectPosition;
  size: CanvasObjectSize;
  zIndex: number;
  // Legacy fields for backward compatibility (derived from columnSelections)
  tableName?: string;
  selectedColumns?: string[];
}

/**
 * Get the primary table name from column selections.
 * This is the first table that has selected columns.
 */
export function getPrimaryTable(columnSelections: ColumnSelection[]): string | null {
  if (columnSelections.length === 0) return null;
  return columnSelections[0].table;
}

/**
 * Get all unique tables from column selections
 */
export function getTablesFromSelections(columnSelections: ColumnSelection[]): string[] {
  return [...new Set(columnSelections.map((cs) => cs.table))];
}

/**
 * Convert legacy tableName/selectedColumns to columnSelections format
 */
export function toColumnSelections(
  tableName: string,
  selectedColumns: string[]
): ColumnSelection[] {
  return selectedColumns.map((column) => ({ table: tableName, column }));
}

/**
 * Get selected columns for a specific table from columnSelections
 */
export function getColumnsForTable(
  columnSelections: ColumnSelection[],
  tableName: string
): string[] {
  return columnSelections
    .filter((cs) => cs.table === tableName)
    .map((cs) => cs.column);
}
