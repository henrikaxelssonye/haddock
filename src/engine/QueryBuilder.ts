import type { FieldSelection, Relationship, DuckDBValue, ColumnSelection } from '../types';
import { RelationshipDetector } from './RelationshipDetector';
import { getTablesFromSelections, getPrimaryTable } from '../types/canvas';

/**
 * Convert a table name (which may include schema prefix) to proper SQL syntax.
 * - "customers" -> loaded_db."customers"
 * - "staging.customers" -> loaded_db."staging"."customers"
 */
export function toSqlTableRef(tableName: string): string {
  if (tableName.includes('.')) {
    const [schema, table] = tableName.split('.', 2);
    return `loaded_db."${schema}"."${table}"`;
  }
  return `loaded_db."${tableName}"`;
}

export class QueryBuilder {
  private relationshipDetector = new RelationshipDetector();
  private getRelationshipPriority(
    relationship: Relationship,
    preferredTables: Set<string>
  ): number {
    let score = 0;
    if (preferredTables.has(relationship.fromTable)) score += 2;
    if (preferredTables.has(relationship.toTable)) score += 2;
    if (!relationship.fromTable.includes('.')) score += 1;
    if (!relationship.toTable.includes('.')) score += 1;
    if (!relationship.fromTable.includes('_')) score += 1;
    if (!relationship.toTable.includes('_')) score += 1;
    return score;
  }

  private findPreferredPath(
    fromTable: string,
    toTable: string,
    relationships: Relationship[],
    preferredTables: Set<string>
  ): Relationship[] | null {
    const prioritizedRelationships = [...relationships].sort(
      (a, b) =>
        this.getRelationshipPriority(b, preferredTables) -
        this.getRelationshipPriority(a, preferredTables)
    );
    return this.relationshipDetector.findPath(
      fromTable,
      toTable,
      prioritizedRelationships
    );
  }

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
      return `SELECT * FROM ${toSqlTableRef(targetTable)} LIMIT ${limit}`;
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
      return `SELECT * FROM ${toSqlTableRef(targetTable)} WHERE ${whereClause} LIMIT ${limit}`;
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
      const path = this.findPreferredPath(
        targetTable,
        sourceTable,
        relationships,
        joinedTables
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
            `JOIN ${toSqlTableRef(nextTable)} ${nextAlias} ON ${currentAlias}."${joinCol}" = ${nextAlias}."${targetCol}"`
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

    return `SELECT DISTINCT t.* FROM ${toSqlTableRef(targetTable)} t
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
      return `SELECT DISTINCT "${targetColumn}" FROM ${toSqlTableRef(targetTable)}`;
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

      const path = this.findPreferredPath(
        targetTable,
        sourceTable,
        relationships,
        joinedTables
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
            `JOIN ${toSqlTableRef(nextTable)} ${nextAlias} ON ${currentAlias}."${joinCol}" = ${nextAlias}."${targetCol}"`
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

    return `SELECT DISTINCT t."${targetColumn}" FROM ${toSqlTableRef(targetTable)} t
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
      return `${toSqlTableRef(tableName)}."${sel.column}" IN (${formattedValues})`;
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

  /**
   * Build a SQL query for a composite table that selects columns from multiple related tables.
   * This joins tables based on relationships and selects specific columns from each.
   */
  buildCompositeTableQuery(
    columnSelections: ColumnSelection[],
    selections: FieldSelection[],
    relationships: Relationship[],
    limit = 1000
  ): { query: string; columnMapping: Map<string, { table: string; column: string }> } {
    if (columnSelections.length === 0) {
      return { query: 'SELECT 1 WHERE FALSE', columnMapping: new Map() };
    }

    // Get unique tables from column selections
    const tables = getTablesFromSelections(columnSelections);
    const primaryTable = getPrimaryTable(columnSelections);

    if (!primaryTable) {
      return { query: 'SELECT 1 WHERE FALSE', columnMapping: new Map() };
    }

    // If only one table, use simple query
    if (tables.length === 1) {
      const cols = columnSelections.map((cs) => cs.column);
      const selectClause = cols.map((c) => `"${c}"`).join(', ');

      // Build column mapping (alias -> original table.column)
      const columnMapping = new Map<string, { table: string; column: string }>();
      for (const cs of columnSelections) {
        columnMapping.set(cs.column, { table: cs.table, column: cs.column });
      }

      const baseQuery = this.buildTableQuery(
        primaryTable,
        selections,
        relationships,
        limit
      );
      return {
        query: `SELECT ${selectClause} FROM (${baseQuery}) t`,
        columnMapping,
      };
    }

    // Multiple tables: need JOINs
    const tableAliases = new Map<string, string>();
    tableAliases.set(primaryTable, 't');
    let aliasCounter = 1;

    const joins: string[] = [];
    const joinedTables = new Set<string>([primaryTable]);
    const unreachableTables: string[] = [];

    // Find JOIN path to all required tables
    for (const table of tables) {
      if (table === primaryTable) continue;

      const path = this.findPreferredPath(
        primaryTable,
        table,
        relationships,
        joinedTables
      );
      if (!path || path.length === 0) {
        unreachableTables.push(table);
        continue;
      }

      // Build JOINs along the path
      let currentTable = primaryTable;
      for (const rel of path) {
        const nextTable = rel.fromTable === currentTable ? rel.toTable : rel.fromTable;

        if (!joinedTables.has(nextTable)) {
          const nextAlias = `t${aliasCounter++}`;
          tableAliases.set(nextTable, nextAlias);

          const currentAlias = tableAliases.get(currentTable)!;
          const joinCol = rel.fromTable === currentTable ? rel.fromColumn : rel.toColumn;
          const targetCol = rel.fromTable === currentTable ? rel.toColumn : rel.fromColumn;

          joins.push(
            `LEFT JOIN ${toSqlTableRef(nextTable)} ${nextAlias} ON ${currentAlias}."${joinCol}" = ${nextAlias}."${targetCol}"`
          );
          joinedTables.add(nextTable);
        }

        currentTable = nextTable;
      }
    }

    // Build SELECT clause with aliased column names
    // Format: alias."Column" AS "Table.Column"
    const selectParts: string[] = [];
    const columnMapping = new Map<string, { table: string; column: string }>();

    for (const cs of columnSelections) {
      if (unreachableTables.includes(cs.table)) continue;

      const alias = tableAliases.get(cs.table);
      if (!alias) continue;

      const outputName = `${cs.table}.${cs.column}`;
      selectParts.push(`${alias}."${cs.column}" AS "${outputName}"`);
      columnMapping.set(outputName, { table: cs.table, column: cs.column });
    }

    if (selectParts.length === 0) {
      return { query: 'SELECT 1 WHERE FALSE', columnMapping: new Map() };
    }

    // Build WHERE clause from selections (filter conditions)
    const whereConditions: string[] = [];

    // Group selections by table
    const selectionsByTable = new Map<string, FieldSelection[]>();
    for (const sel of selections) {
      const existing = selectionsByTable.get(sel.table) || [];
      existing.push(sel);
      selectionsByTable.set(sel.table, existing);
    }

    for (const [sourceTable, tableSelections] of selectionsByTable) {
      const sourceAlias = tableAliases.get(sourceTable);
      if (sourceAlias) {
        // Table is already in our JOIN chain
        whereConditions.push(this.buildWhereClauseWithAlias(tableSelections, sourceAlias));
      } else {
        // Need to add JOIN for this filter table
        const path = this.findPreferredPath(
          primaryTable,
          sourceTable,
          relationships,
          joinedTables
        );
        if (!path || path.length === 0) continue;

        let currentTable = primaryTable;
        for (const rel of path) {
          const nextTable = rel.fromTable === currentTable ? rel.toTable : rel.fromTable;

          if (!joinedTables.has(nextTable)) {
            const nextAlias = `t${aliasCounter++}`;
            tableAliases.set(nextTable, nextAlias);

            const currentAlias = tableAliases.get(currentTable)!;
            const joinCol = rel.fromTable === currentTable ? rel.fromColumn : rel.toColumn;
            const targetCol = rel.fromTable === currentTable ? rel.toColumn : rel.fromColumn;

            joins.push(
              `JOIN ${toSqlTableRef(nextTable)} ${nextAlias} ON ${currentAlias}."${joinCol}" = ${nextAlias}."${targetCol}"`
            );
            joinedTables.add(nextTable);
          }

          currentTable = nextTable;
        }

        const filterAlias = tableAliases.get(sourceTable)!;
        whereConditions.push(this.buildWhereClauseWithAlias(tableSelections, filterAlias));
      }
    }

    const selectClause = selectParts.join(', ');
    const joinClause = joins.length > 0 ? joins.join('\n') : '';
    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `SELECT DISTINCT ${selectClause}
FROM ${toSqlTableRef(primaryTable)} t
${joinClause}
${whereClause}
LIMIT ${limit}`;

    return { query, columnMapping };
  }
}
