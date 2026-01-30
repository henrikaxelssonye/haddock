import type { TableSchema, Relationship, ColumnInfo } from '../types';

export class RelationshipDetector {
  /**
   * Auto-detect relationships between tables based on column naming conventions.
   * Looks for patterns like:
   * - TableName.ID -> OtherTable.TableNameID
   * - TableName.ID -> OtherTable.TableName_ID
   * - TableName.ID -> OtherTable.fk_TableName
   */
  detectRelationships(tables: TableSchema[]): Relationship[] {
    const relationships: Relationship[] = [];
    const tableMap = new Map(tables.map(t => [t.name.toLowerCase(), t]));

    for (const table of tables) {
      for (const column of table.columns) {
        const detected = this.detectColumnRelationship(
          table.name,
          column,
          tables,
          tableMap
        );
        if (detected) {
          // Avoid duplicate relationships
          const exists = relationships.some(
            r =>
              (r.fromTable === detected.fromTable &&
                r.fromColumn === detected.fromColumn &&
                r.toTable === detected.toTable &&
                r.toColumn === detected.toColumn) ||
              (r.fromTable === detected.toTable &&
                r.fromColumn === detected.toColumn &&
                r.toTable === detected.fromTable &&
                r.toColumn === detected.fromColumn)
          );
          if (!exists) {
            relationships.push(detected);
          }
        }
      }
    }

    return relationships;
  }

  private detectColumnRelationship(
    tableName: string,
    column: ColumnInfo,
    tables: TableSchema[],
    tableMap: Map<string, TableSchema>
  ): Relationship | null {
    const colNameLower = column.name.toLowerCase();

    // Pattern 1: ColumnName ends with "id" (e.g., CustomerID, customer_id)
    if (colNameLower.endsWith('id') && colNameLower !== 'id') {
      // Extract potential table name
      const potentialTableName = colNameLower
        .replace(/_?id$/i, '')
        .replace(/_/g, '');

      // Look for matching table
      for (const [tblNameLower, tbl] of tableMap) {
        const normalizedTblName = tblNameLower.replace(/_/g, '');

        if (
          normalizedTblName === potentialTableName ||
          normalizedTblName === potentialTableName + 's' ||
          normalizedTblName + 's' === potentialTableName
        ) {
          // Found potential target table, look for ID column
          const idColumn = tbl.columns.find(
            c => c.name.toLowerCase() === 'id' || c.name.toLowerCase() === tbl.name.toLowerCase() + 'id'
          );

          if (idColumn && tbl.name !== tableName) {
            return {
              id: `${tableName}.${column.name}->${tbl.name}.${idColumn.name}`,
              fromTable: tableName,
              fromColumn: column.name,
              toTable: tbl.name,
              toColumn: idColumn.name,
              confidence: this.calculateConfidence(column, idColumn),
            };
          }
        }
      }
    }

    // Pattern 2: Column named "id" in a table that might be referenced elsewhere
    if (colNameLower === 'id') {
      // Look for FK columns in other tables
      for (const otherTable of tables) {
        if (otherTable.name === tableName) continue;

        for (const otherCol of otherTable.columns) {
          const otherColLower = otherCol.name.toLowerCase();
          const expectedFkName = tableName.toLowerCase() + 'id';
          const expectedFkNameUnderscore = tableName.toLowerCase() + '_id';

          if (
            otherColLower === expectedFkName ||
            otherColLower === expectedFkNameUnderscore ||
            otherColLower.replace(/_/g, '') === expectedFkName
          ) {
            return {
              id: `${otherTable.name}.${otherCol.name}->${tableName}.${column.name}`,
              fromTable: otherTable.name,
              fromColumn: otherCol.name,
              toTable: tableName,
              toColumn: column.name,
              confidence: this.calculateConfidence(otherCol, column),
            };
          }
        }
      }
    }

    return null;
  }

  private calculateConfidence(
    fromCol: ColumnInfo,
    toCol: ColumnInfo
  ): 'high' | 'medium' | 'low' {
    // High confidence if types match and naming is clear
    const typesMatch = this.areTypesCompatible(fromCol.type, toCol.type);
    const toColIsId = toCol.name.toLowerCase() === 'id';

    if (typesMatch && toColIsId) {
      return 'high';
    } else if (typesMatch) {
      return 'medium';
    }
    return 'low';
  }

  private areTypesCompatible(type1: string, type2: string): boolean {
    const numericTypes = ['integer', 'bigint', 'smallint', 'int', 'int4', 'int8'];
    const stringTypes = ['varchar', 'text', 'char', 'string'];

    const t1 = type1.toLowerCase();
    const t2 = type2.toLowerCase();

    if (t1 === t2) return true;
    if (numericTypes.some(t => t1.includes(t)) && numericTypes.some(t => t2.includes(t))) {
      return true;
    }
    if (stringTypes.some(t => t1.includes(t)) && stringTypes.some(t => t2.includes(t))) {
      return true;
    }
    return false;
  }

  /**
   * Find all tables reachable from a given table through relationships
   */
  findConnectedTables(
    startTable: string,
    relationships: Relationship[]
  ): Set<string> {
    const visited = new Set<string>();
    const queue = [startTable];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all directly connected tables
      for (const rel of relationships) {
        if (rel.fromTable === current && !visited.has(rel.toTable)) {
          queue.push(rel.toTable);
        }
        if (rel.toTable === current && !visited.has(rel.fromTable)) {
          queue.push(rel.fromTable);
        }
      }
    }

    return visited;
  }

  /**
   * Find the shortest path between two tables
   */
  findPath(
    fromTable: string,
    toTable: string,
    relationships: Relationship[]
  ): Relationship[] | null {
    if (fromTable === toTable) return [];

    const visited = new Set<string>();
    const queue: { table: string; path: Relationship[] }[] = [
      { table: fromTable, path: [] }
    ];

    while (queue.length > 0) {
      const { table, path } = queue.shift()!;

      if (visited.has(table)) continue;
      visited.add(table);

      for (const rel of relationships) {
        let nextTable: string | null = null;

        if (rel.fromTable === table && !visited.has(rel.toTable)) {
          nextTable = rel.toTable;
        } else if (rel.toTable === table && !visited.has(rel.fromTable)) {
          nextTable = rel.fromTable;
        }

        if (nextTable) {
          const newPath = [...path, rel];
          if (nextTable === toTable) {
            return newPath;
          }
          queue.push({ table: nextTable, path: newPath });
        }
      }
    }

    return null;
  }
}
