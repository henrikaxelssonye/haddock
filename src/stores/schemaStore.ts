import { create } from 'zustand';
import type { TableSchema, Relationship, SchemaInfo } from '../types';
import { useDatabaseStore } from './databaseStore';
import { RelationshipDetector } from '../engine/RelationshipDetector';

interface SchemaState {
  tables: TableSchema[];
  relationships: Relationship[];
  isLoading: boolean;
  error: string | null;
  activeTable: string | null;

  loadSchema: () => Promise<void>;
  setActiveTable: (tableName: string | null) => void;
  getSchemaInfo: () => SchemaInfo;
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  tables: [],
  relationships: [],
  isLoading: false,
  error: null,
  activeTable: null,

  loadSchema: async () => {
    set({ isLoading: true, error: null });

    try {
      const { executeQuery } = useDatabaseStore.getState();

      // Get all tables from the loaded database
      // Note: In DuckDB, attached databases are catalogs, not schemas
      // Include schema name to uniquely identify tables across schemas
      const tablesResult = await executeQuery(`
        SELECT DISTINCT table_schema, table_name
        FROM information_schema.tables
        WHERE table_catalog = 'loaded_db'
          AND table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY table_schema, table_name
      `);

      const tables: TableSchema[] = [];

      for (const row of tablesResult.rows) {
        const schemaName = row.table_schema as string;
        const rawTableName = row.table_name as string;
        // Use schema.table format for unique identification (skip 'main.' prefix for cleaner display)
        const displayName = schemaName === 'main' ? rawTableName : `${schemaName}.${rawTableName}`;

        try {
          // Get column information
          const columnsResult = await executeQuery(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_catalog = 'loaded_db'
              AND table_schema = '${schemaName}'
              AND table_name = '${rawTableName}'
            ORDER BY ordinal_position
          `);

          // Get row count - use schema-qualified name
          const countResult = await executeQuery(
            `SELECT COUNT(*) as cnt FROM loaded_db."${schemaName}"."${rawTableName}"`
          );

          tables.push({
            name: displayName,
            columns: columnsResult.rows.map(col => ({
              name: col.column_name as string,
              type: col.data_type as string,
              nullable: col.is_nullable === 'YES',
            })),
            rowCount: Number(countResult.rows[0]?.cnt ?? 0),
          });
        } catch (err) {
          // Skip tables/views that fail to load (e.g., views with invalid catalog references)
          console.warn(`Skipping ${displayName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Auto-detect relationships
      const detector = new RelationshipDetector();
      const relationships = detector.detectRelationships(tables);

      set({ tables, relationships, isLoading: false });

      // Set first table as active if none selected
      if (tables.length > 0 && !get().activeTable) {
        set({ activeTable: tables[0].name });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load schema',
        isLoading: false,
      });
    }
  },

  setActiveTable: (tableName: string | null) => {
    set({ activeTable: tableName });
  },

  getSchemaInfo: () => {
    const { tables, relationships } = get();
    return { tables, relationships };
  },
}));
