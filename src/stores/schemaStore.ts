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
      const tablesResult = await executeQuery(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_catalog = 'loaded_db'
          AND table_type = 'BASE TABLE'
      `);

      const tables: TableSchema[] = [];

      for (const row of tablesResult.rows) {
        const tableName = row.table_name as string;

        // Get column information
        const columnsResult = await executeQuery(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_catalog = 'loaded_db' AND table_name = '${tableName}'
          ORDER BY ordinal_position
        `);

        // Get row count
        const countResult = await executeQuery(
          `SELECT COUNT(*) as cnt FROM loaded_db."${tableName}"`
        );

        tables.push({
          name: tableName,
          columns: columnsResult.rows.map(col => ({
            name: col.column_name as string,
            type: col.data_type as string,
            nullable: col.is_nullable === 'YES',
          })),
          rowCount: Number(countResult.rows[0]?.cnt ?? 0),
        });
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
