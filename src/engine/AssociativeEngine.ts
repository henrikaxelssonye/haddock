import type { FieldSelection, FieldState, Relationship, TableSchema } from '../types';
import { QueryBuilder } from './QueryBuilder';
import { StateCalculator } from './StateCalculator';
import type { DuckDBValue } from '../types';

type QueryExecutor = (sql: string) => Promise<{ rows: Record<string, DuckDBValue>[] }>;

export class AssociativeEngine {
  private queryBuilder = new QueryBuilder();
  private stateCalculator = new StateCalculator();

  /**
   * Main entry point: propagate selections and compute all field states
   */
  async propagateSelection(
    tables: TableSchema[],
    selections: FieldSelection[],
    relationships: Relationship[],
    executeQuery: QueryExecutor
  ): Promise<FieldState[]> {
    if (selections.length === 0) {
      return [];
    }

    // Calculate field states for all fields
    const fieldStates = await this.stateCalculator.calculateFieldStates(
      tables,
      selections,
      relationships,
      executeQuery
    );

    return fieldStates;
  }

  /**
   * Get filtered data for a table based on current selections
   */
  async getFilteredTableData(
    tableName: string,
    selections: FieldSelection[],
    relationships: Relationship[],
    executeQuery: QueryExecutor,
    limit = 1000
  ): Promise<{ columns: string[]; rows: Record<string, DuckDBValue>[] }> {
    const query = this.queryBuilder.buildTableQuery(
      tableName,
      selections,
      relationships,
      limit
    );

    const result = await executeQuery(query);

    // Extract column names from first row or return empty
    const columns = result.rows.length > 0
      ? Object.keys(result.rows[0])
      : [];

    return {
      columns,
      rows: result.rows,
    };
  }

  /**
   * Get all distinct values for a field
   */
  async getFieldValues(
    tableName: string,
    columnName: string,
    executeQuery: QueryExecutor
  ): Promise<DuckDBValue[]> {
    const query = `SELECT DISTINCT "${columnName}" FROM loaded_db."${tableName}" ORDER BY "${columnName}" LIMIT 10000`;
    const result = await executeQuery(query);
    return result.rows.map(row => row[columnName]);
  }

  /**
   * Get statistics about the current selection state
   */
  async getSelectionStats(
    tables: TableSchema[],
    selections: FieldSelection[],
    relationships: Relationship[],
    executeQuery: QueryExecutor
  ): Promise<{
    totalTables: number;
    affectedTables: number;
    selectedValues: number;
    possibleRecords: Map<string, number>;
  }> {
    const stats = {
      totalTables: tables.length,
      affectedTables: 0,
      selectedValues: 0,
      possibleRecords: new Map<string, number>(),
    };

    // Count selected values
    for (const sel of selections) {
      stats.selectedValues += sel.values.size;
    }

    // Count affected tables and possible records per table
    const tablesWithSelections = new Set(selections.map(s => s.table));
    stats.affectedTables = tablesWithSelections.size;

    for (const table of tables) {
      const query = this.queryBuilder.buildTableQuery(
        table.name,
        selections,
        relationships,
        10001 // Get one more to check if there are more
      );

      try {
        const result = await executeQuery(query);
        stats.possibleRecords.set(
          table.name,
          Math.min(result.rows.length, 10000)
        );
      } catch {
        stats.possibleRecords.set(table.name, 0);
      }
    }

    return stats;
  }
}
