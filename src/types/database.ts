import type * as duckdb from '@duckdb/duckdb-wasm';

export interface DatabaseConnection {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
}

export interface DatabaseFile {
  name: string;
  size: number;
  buffer: ArrayBuffer;
}

export type DuckDBValue = string | number | boolean | bigint | null | Date;

export interface QueryResult {
  columns: string[];
  rows: Record<string, DuckDBValue>[];
  rowCount: number;
}
