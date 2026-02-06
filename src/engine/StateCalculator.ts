import type {
  FieldSelection,
  FieldState,
  SelectionState,
  Relationship,
  DuckDBValue,
  ColumnSelection
} from '../types';
import { QueryBuilder, toSqlTableRef } from './QueryBuilder';

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
    executeQuery: QueryExecutor,
    targetFields?: ColumnSelection[]
  ): Promise<FieldState[]> {
    // If no selections, everything is "possible"
    if (selections.length === 0) {
      return [];
    }

    const selectedFieldKeys = new Set(
      selections.map((s) => `${s.table}.${s.column}`)
    );
    const targetFieldKeys = new Set<string>();
    for (const sf of selectedFieldKeys) {
      targetFieldKeys.add(sf);
    }
    if (targetFields) {
      for (const field of targetFields) {
        targetFieldKeys.add(`${field.table}.${field.column}`);
      }
    }

    const fieldsToCalculate: Array<{ tableName: string; columnName: string }> = [];
    const shouldCalculateAll = !targetFields || targetFields.length === 0;

    // Calculate states only for needed fields.
    for (const table of tables) {
      for (const column of table.columns) {
        if (shouldCalculateAll || targetFieldKeys.has(`${table.name}.${column.name}`)) {
          fieldsToCalculate.push({ tableName: table.name, columnName: column.name });
        }
      }
    }

    return Promise.all(
      fieldsToCalculate.map(({ tableName, columnName }) =>
        this.calculateFieldState(
          tableName,
          columnName,
          selections,
          relationships,
          executeQuery
        )
      )
    );
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
      const allValuesQuery = `SELECT DISTINCT "${columnName}" FROM ${toSqlTableRef(tableName)}`;
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
        const allValuesQuery = `SELECT DISTINCT "${columnName}" FROM ${toSqlTableRef(tableName)}`;
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
