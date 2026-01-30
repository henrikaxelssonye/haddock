import type { FieldSelection, Relationship, DuckDBValue } from '../types';
import { RelationshipDetector } from './RelationshipDetector';

export class QueryBuilder {
  private relationshipDetector = new RelationshipDetector();

  /**
   * Build a SQL query to get filtered data for a table based on current selections
   */
  buildTableQuery(
    targetTable: string,
    selections: FieldSelection[],
    relationships: Relationship[],
    limit = 1000
  ): string {
    if (selections.length === 0) {
      return `SELECT * FROM loaded_db."${targetTable}" LIMIT ${limit}`;
    }

    // Group selections by table
    const selectionsByTable = new Map<string, FieldSelection[]>();
    for (const sel of selections) {
      const existing = selectionsByTable.get(sel.table) || [];
      existing.push(sel);
      selectionsByTable.set(sel.table, existing);
    }

    // If selections are only in the target table, simple WHERE clause
    if (selectionsByTable.size === 1 && selectionsByTable.has(targetTable)) {
      const whereClause = this.buildWhereClause(
        selectionsByTable.get(targetTable)!,
        targetTable
      );
      return `SELECT * FROM loaded_db."${targetTable}" WHERE ${whereClause} LIMIT ${limit}`;
    }

    // Need JOINs to filter from other tables
    // Use table aliases to avoid DuckDB schema.table.* syntax issues
    const tableAliases = new Map<string, string>();
    tableAliases.set(targetTable, 't');
    let aliasCounter = 1;

    const joins: string[] = [];
    const whereConditions: string[] = [];
    const joinedTables = new Set<string>([targetTable]);

    for (const [sourceTable, tableSelections] of selectionsByTable) {
      if (sourceTable === targetTable) {
        // Direct filter on target table
        whereConditions.push(this.buildWhereClauseWithAlias(tableSelections, 't'));
        continue;
      }

      // Find path from target to source table
      const path = this.relationshipDetector.findPath(
        targetTable,
        sourceTable,
        relationships
      );

      if (!path || path.length === 0) {
        // No path found - skip this selection
        console.warn(`No relationship path from ${targetTable} to ${sourceTable}`);
        continue;
      }

      // Build JOINs along the path
      let currentTable = targetTable;
      for (const rel of path) {
        const nextTable = rel.fromTable === currentTable ? rel.toTable : rel.fromTable;

        if (!joinedTables.has(nextTable)) {
          const nextAlias = `t${aliasCounter++}`;
          tableAliases.set(nextTable, nextAlias);

          const currentAlias = tableAliases.get(currentTable)!;
          const joinCol = rel.fromTable === currentTable ? rel.fromColumn : rel.toColumn;
          const targetCol = rel.fromTable === currentTable ? rel.toColumn : rel.fromColumn;

          joins.push(
            `JOIN loaded_db."${nextTable}" ${nextAlias} ON ${currentAlias}."${joinCol}" = ${nextAlias}."${targetCol}"`
          );
          joinedTables.add(nextTable);
        }

        currentTable = nextTable;
      }

      // Add WHERE condition for this source table
      const sourceAlias = tableAliases.get(sourceTable)!;
      whereConditions.push(this.buildWhereClauseWithAlias(tableSelections, sourceAlias));
    }

    const joinClause = joins.length > 0 ? joins.join('\n') : '';
    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    return `SELECT DISTINCT t.* FROM loaded_db."${targetTable}" t
${joinClause}
${whereClause}
LIMIT ${limit}`;
  }

  /**
   * Build a query to get possible values for a field given current selections
   */
  buildPossibleValuesQuery(
    targetTable: string,
    targetColumn: string,
    selections: FieldSelection[],
    relationships: Relationship[]
  ): string {
    // Filter out selections from the same field (those are "alternative", not filters)
    const relevantSelections = selections.filter(
      s => !(s.table === targetTable && s.column === targetColumn)
    );

    if (relevantSelections.length === 0) {
      return `SELECT DISTINCT "${targetColumn}" FROM loaded_db."${targetTable}"`;
    }

    // Group selections by table
    const selectionsByTable = new Map<string, FieldSelection[]>();
    for (const sel of relevantSelections) {
      const existing = selectionsByTable.get(sel.table) || [];
      existing.push(sel);
      selectionsByTable.set(sel.table, existing);
    }

    // Use table aliases to avoid DuckDB schema.table.column syntax issues
    const tableAliases = new Map<string, string>();
    tableAliases.set(targetTable, 't');
    let aliasCounter = 1;

    const joins: string[] = [];
    const whereConditions: string[] = [];
    const joinedTables = new Set<string>([targetTable]);

    for (const [sourceTable, tableSelections] of selectionsByTable) {
      if (sourceTable === targetTable) {
        whereConditions.push(this.buildWhereClauseWithAlias(tableSelections, 't'));
        continue;
      }

      const path = this.relationshipDetector.findPath(
        targetTable,
        sourceTable,
        relationships
      );

      if (!path || path.length === 0) {
        continue;
      }

      let currentTable = targetTable;
      for (const rel of path) {
        const nextTable = rel.fromTable === currentTable ? rel.toTable : rel.fromTable;

        if (!joinedTables.has(nextTable)) {
          const nextAlias = `t${aliasCounter++}`;
          tableAliases.set(nextTable, nextAlias);

          const currentAlias = tableAliases.get(currentTable)!;
          const joinCol = rel.fromTable === currentTable ? rel.fromColumn : rel.toColumn;
          const targetCol = rel.fromTable === currentTable ? rel.toColumn : rel.fromColumn;

          joins.push(
            `JOIN loaded_db."${nextTable}" ${nextAlias} ON ${currentAlias}."${joinCol}" = ${nextAlias}."${targetCol}"`
          );
          joinedTables.add(nextTable);
        }

        currentTable = nextTable;
      }

      const sourceAlias = tableAliases.get(sourceTable)!;
      whereConditions.push(this.buildWhereClauseWithAlias(tableSelections, sourceAlias));
    }

    const joinClause = joins.length > 0 ? joins.join('\n') : '';
    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    return `SELECT DISTINCT t."${targetColumn}" FROM loaded_db."${targetTable}" t
${joinClause}
${whereClause}`;
  }

  /**
   * Build WHERE clause for selections in a table (using full schema.table.column)
   */
  private buildWhereClause(
    selections: FieldSelection[],
    tableName: string
  ): string {
    const conditions = selections.map(sel => {
      const values = Array.from(sel.values);
      const formattedValues = values.map(v => this.formatValue(v)).join(', ');
      return `loaded_db."${tableName}"."${sel.column}" IN (${formattedValues})`;
    });

    return conditions.join(' AND ');
  }

  /**
   * Build WHERE clause using table alias
   */
  private buildWhereClauseWithAlias(
    selections: FieldSelection[],
    alias: string
  ): string {
    const conditions = selections.map(sel => {
      const values = Array.from(sel.values);
      const formattedValues = values.map(v => this.formatValue(v)).join(', ');
      return `${alias}."${sel.column}" IN (${formattedValues})`;
    });

    return conditions.join(' AND ');
  }

  /**
   * Format a value for SQL
   */
  private formatValue(value: DuckDBValue): string {
    if (value === null) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }
    return String(value);
  }
}
