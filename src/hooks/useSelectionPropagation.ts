import { useEffect, useRef } from 'react';
import { useCanvasStore, useDatabaseStore, useSelectionStore, useSchemaStore } from '../stores';
import { AssociativeEngine } from '../engine';
import type { ColumnSelection, FieldState, SelectionState, DuckDBValue } from '../types';

const engine = new AssociativeEngine();

export function useSelectionPropagation() {
  const executeQuery = useDatabaseStore(state => state.executeQuery);
  const selections = useSelectionStore(state => state.selections);
  const setFieldStates = useSelectionStore(state => state.setFieldStates);
  const tables = useSchemaStore(state => state.tables);
  const relationships = useSchemaStore(state => state.relationships);
  const activeTable = useSchemaStore(state => state.activeTable);
  const viewMode = useCanvasStore(state => state.viewMode);
  const canvasObjects = useCanvasStore(state => state.objects);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const targetFieldKeys = new Set<string>();
    const targetFields: ColumnSelection[] = [];
    const addField = (table: string, column: string) => {
      const key = `${table}.${column}`;
      if (targetFieldKeys.has(key)) {
        return;
      }
      targetFieldKeys.add(key);
      targetFields.push({ table, column });
    };

    if (viewMode === 'table' && activeTable) {
      const table = tables.find(t => t.name === activeTable);
      if (table) {
        for (const column of table.columns) {
          addField(activeTable, column.name);
        }
      }
    } else if (viewMode === 'canvas') {
      for (const obj of canvasObjects) {
        for (const field of obj.columnSelections) {
          addField(field.table, field.column);
        }
      }
    }

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the propagation calculation
    debounceRef.current = setTimeout(async () => {
      if (tables.length === 0) return;

      try {
        const fieldStates: FieldState[] = [];
        const fieldsByTable = new Map<string, string[]>();
        for (const field of targetFields) {
          const existing = fieldsByTable.get(field.table) || [];
          if (!existing.includes(field.column)) {
            existing.push(field.column);
          }
          fieldsByTable.set(field.table, existing);
        }

        for (const [tableName, columns] of fieldsByTable) {
          const filteredData = await engine.getFilteredTableData(
            tableName,
            selections,
            relationships,
            executeQuery,
            10000
          );

          const distinctByColumn = new Map<string, Set<DuckDBValue>>();
          for (const column of columns) {
            distinctByColumn.set(column, new Set());
          }
          for (const row of filteredData.rows) {
            for (const column of columns) {
              distinctByColumn.get(column)!.add(row[column]);
            }
          }

          for (const column of columns) {
            const selectedField = selections.find(
              (s) => s.table === tableName && s.column === column
            );

            const valueStates = new Map<DuckDBValue, SelectionState>();
            if (selectedField) {
              for (const value of selectedField.values) {
                valueStates.set(value, 'selected');
              }

              const allValues = await engine.getFieldValues(
                tableName,
                column,
                executeQuery
              );
              for (const value of allValues) {
                if (!selectedField.values.has(value)) {
                  valueStates.set(value, 'alternative');
                }
              }
            } else {
              const possibleValues = distinctByColumn.get(column)!;
              for (const value of possibleValues) {
                valueStates.set(value, 'possible');
              }
            }

            fieldStates.push({
              table: tableName,
              column,
              valueStates,
            });
          }
        }

        // Ignore stale async responses from older selection snapshots.
        if (requestId !== requestIdRef.current) {
          return;
        }
        setFieldStates(fieldStates);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        console.error('Selection propagation failed:', err);
      }
    }, 30); // Small debounce to coalesce rapid clicks without visible lag

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    selections,
    tables,
    relationships,
    activeTable,
    viewMode,
    canvasObjects,
    executeQuery,
    setFieldStates
  ]);
}
