import { create } from 'zustand';
import * as duckdb from '@duckdb/duckdb-wasm';
import type { DatabaseConnection, QueryResult, DuckDBValue } from '../types';

interface DatabaseState {
  connection: DatabaseConnection | null;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
  fileName: string | null;

  initialize: () => Promise<void>;
  loadFile: (file: File) => Promise<void>;
  executeQuery: (sql: string) => Promise<QueryResult>;
  close: () => Promise<void>;
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  connection: null,
  isInitializing: false,
  isLoading: false,
  error: null,
  fileName: null,

  initialize: async () => {
    if (get().connection || get().isInitializing) return;

    set({ isInitializing: true, error: null });

    try {
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

      const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
      );

      const worker = new Worker(worker_url);
      const logger = new duckdb.ConsoleLogger();
      const db = new duckdb.AsyncDuckDB(logger, worker);

      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(worker_url);

      const conn = await db.connect();

      set({
        connection: { db, conn },
        isInitializing: false
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to initialize DuckDB',
        isInitializing: false
      });
    }
  },

  loadFile: async (file: File) => {
    const { connection } = get();
    if (!connection) {
      throw new Error('Database not initialized');
    }

    set({ isLoading: true, error: null });

    try {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // Register the file with DuckDB
      await connection.db.registerFileBuffer(file.name, uint8Array);

      // Attach the database
      await connection.conn.query(`ATTACH '${file.name}' AS loaded_db`);

      set({ fileName: file.name, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load database file',
        isLoading: false
      });
      throw err;
    }
  },

  executeQuery: async (sql: string): Promise<QueryResult> => {
    const { connection } = get();
    if (!connection) {
      throw new Error('Database not initialized');
    }

    const result = await connection.conn.query(sql);
    const columns = result.schema.fields.map(f => f.name);
    const rows: Record<string, DuckDBValue>[] = [];

    for (const row of result) {
      const rowObj: Record<string, DuckDBValue> = {};
      for (let i = 0; i < columns.length; i++) {
        const value = row[columns[i]];
        // Convert BigInt to number for display if within safe range
        if (typeof value === 'bigint') {
          rowObj[columns[i]] = Number.isSafeInteger(Number(value)) ? Number(value) : value;
        } else if (value !== null && value !== undefined && typeof value === 'object' && !(value instanceof Date)) {
          // Convert Arrow-specific types (Decimal128, Uint32Array, etc.) to JS number
          const num = Number(value);
          rowObj[columns[i]] = isNaN(num) ? String(value) : num;
        } else {
          rowObj[columns[i]] = value as DuckDBValue;
        }
      }
      rows.push(rowObj);
    }

    return {
      columns,
      rows,
      rowCount: rows.length,
    };
  },

  close: async () => {
    const { connection } = get();
    if (connection) {
      await connection.conn.close();
      await connection.db.terminate();
      set({ connection: null, fileName: null });
    }
  },
}));
