import type {
  FieldSelection,
  FieldState,
  SelectionState,
  Relationship,
  DuckDBValue
} from '../types';
import { QueryBuilder } from './QueryBuilder';

type QueryExecutor = (sql: string) => Promise<{ rows: Record<string, DuckDBValue>[] }>;

export class StateCalculator {
  private queryBuilder = new QueryBuilder();

  /**
   * Calculate the selection state for all values in all fields
   */
  async calculateFieldStates(
    tables: { name: string; columns: { name: string }[] }[],
    selections: FieldSelection[],
    relationships: Relationship[],
    executeQuery: QueryExecutor
  ): Promise<FieldState[]> {
    const fieldStates: FieldState[] = [];

    // If no selections, everything is "possible"
    if (selections.length === 0) {
      return fieldStates;
    }

    // Calculate states for each field in each table
    for (const table of tables) {
      for (const column of table.columns) {
        const fieldState = await this.calculateFieldState(
          table.name,
          column.name,
          selections,
          relationships,
          executeQuery
        );
        fieldStates.push(fieldState);
      }
    }

    return fieldStates;
  }

  /**
   * Calculate the selection state for all values in a single field
   */
  async calculateFieldState(
    tableName: string,
    columnName: string,
    selections: FieldSelection[],
    relationships: Relationship[],
    executeQuery: QueryExecutor
  ): Promise<FieldState> {
    const valueStates = new Map<DuckDBValue, SelectionState>();

    // Check if this field has a selection
    const fieldSelection = selections.find(
      s => s.table === tableName && s.column === columnName
    );

    if (fieldSelection) {
      // This field has selections - mark selected values
      for (const value of fieldSelection.values) {
        valueStates.set(value, 'selected');
      }

      // Get all values in this field to mark alternatives
      const allValuesQuery = `SELECT DISTINCT "${columnName}" FROM loaded_db."${tableName}"`;
      const allValuesResult = await executeQuery(allValuesQuery);

      for (const row of allValuesResult.rows) {
        const value = row[columnName];
        if (!valueStates.has(value)) {
          valueStates.set(value, 'alternative');
        }
      }
    } else {
      // This field doesn't have a selection - compute possible values
      const possibleQuery = this.queryBuilder.buildPossibleValuesQuery(
        tableName,
        columnName,
        selections,
        relationships
      );

      try {
        const possibleResult = await executeQuery(possibleQuery);
        const possibleValues = new Set(
          possibleResult.rows.map(row => row[columnName])
        );

        // Get all values to determine excluded ones
        const allValuesQuery = `SELECT DISTINCT "${columnName}" FROM loaded_db."${tableName}"`;
        const allValuesResult = await executeQuery(allValuesQuery);

        for (const row of allValuesResult.rows) {
          const value = row[columnName];
          if (possibleValues.has(value)) {
            valueStates.set(value, 'possible');
          } else {
            valueStates.set(value, 'excluded');
          }
        }
      } catch (error) {
        // If query fails (e.g., no relationship path), mark all as possible
        console.warn(
          `Failed to calculate possible values for ${tableName}.${columnName}:`,
          error
        );
      }
    }

    return {
      table: tableName,
      column: columnName,
      valueStates,
    };
  }
}
