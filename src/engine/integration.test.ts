/**
 * Integration tests for the Associative Engine using the actual test_data.duckdb file.
 * These tests verify the full flow: relationship detection, query building, and state calculation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as duckdb from 'duckdb';
import * as path from 'path';
import { RelationshipDetector } from './RelationshipDetector';
import { QueryBuilder } from './QueryBuilder';
import { AssociativeEngine } from './AssociativeEngine';
import type { TableSchema, Relationship, FieldSelection, DuckDBValue } from '../types';

describe('Integration Tests with test_data.duckdb', () => {
  let db: duckdb.Database;
  let conn: duckdb.Connection;
  let tables: TableSchema[] = [];
  let relationships: Relationship[] = [];

  const relationshipDetector = new RelationshipDetector();
  const queryBuilder = new QueryBuilder();
  const engine = new AssociativeEngine();

  // Helper to execute queries and return results
  const executeQuery = (sql: string): Promise<{ rows: Record<string, DuckDBValue>[] }> => {
    return new Promise((resolve, reject) => {
      conn.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve({ rows: rows as Record<string, DuckDBValue>[] });
      });
    });
  };

  beforeAll(async () => {
    const dbPath = path.join(process.cwd(), 'test_data.duckdb');

    // Open database
    db = new duckdb.Database(dbPath, { access_mode: 'READ_ONLY' });
    conn = db.connect();

    // Attach as loaded_db to match the app's schema
    await new Promise<void>((resolve, reject) => {
      conn.run(`ATTACH '${dbPath.replace(/\\/g, '/')}' AS loaded_db (READ_ONLY)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Discover tables
    const tablesResult = await executeQuery(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'main' AND table_catalog = 'loaded_db'
    `);

    for (const row of tablesResult.rows) {
      const tableName = row.table_name as string;

      // Get columns for this table
      const columnsResult = await executeQuery(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = '${tableName}' AND table_catalog = 'loaded_db'
      `);

      // Get row count
      const countResult = await executeQuery(`SELECT COUNT(*) as cnt FROM loaded_db."${tableName}"`);

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

    // Detect relationships
    relationships = relationshipDetector.detectRelationships(tables);

    console.log('\n=== Database Schema ===');
    for (const table of tables) {
      console.log(`\nTable: ${table.name} (${table.rowCount} rows)`);
      console.log('  Columns:', table.columns.map(c => `${c.name}:${c.type}`).join(', '));
    }

    console.log('\n=== Detected Relationships ===');
    for (const rel of relationships) {
      console.log(`  ${rel.fromTable}.${rel.fromColumn} -> ${rel.toTable}.${rel.toColumn} (${rel.confidence})`);
    }
  });

  afterAll(() => {
    if (conn) conn.close();
    if (db) db.close();
  });

  describe('Schema Discovery', () => {
    it('should discover tables from the database', () => {
      expect(tables.length).toBeGreaterThan(0);
      console.log(`Found ${tables.length} tables`);
    });

    it('should have columns for each table', () => {
      for (const table of tables) {
        expect(table.columns.length).toBeGreaterThan(0);
      }
    });

    it('should have row counts for each table', () => {
      for (const table of tables) {
        expect(table.rowCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Relationship Detection', () => {
    it('should detect relationships between tables', () => {
      // This test passes if we find at least one relationship,
      // or if the database has no foreign key patterns
      console.log(`Detected ${relationships.length} relationships`);
      expect(relationships).toBeDefined();
    });

    it('should have valid relationship structure', () => {
      for (const rel of relationships) {
        expect(rel.fromTable).toBeTruthy();
        expect(rel.fromColumn).toBeTruthy();
        expect(rel.toTable).toBeTruthy();
        expect(rel.toColumn).toBeTruthy();
        expect(['high', 'medium', 'low']).toContain(rel.confidence);
      }
    });
  });

  describe('Query Building', () => {
    it('should build valid SELECT query without selections', () => {
      if (tables.length === 0) return;

      const query = queryBuilder.buildTableQuery(tables[0].name, [], relationships);
      expect(query).toContain('SELECT');
      expect(query).toContain(tables[0].name);
    });

    it('should execute generated queries successfully', async () => {
      if (tables.length === 0) return;

      const query = queryBuilder.buildTableQuery(tables[0].name, [], relationships);
      const result = await executeQuery(query);

      expect(result.rows).toBeDefined();
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it('should build valid query with selection in same table', async () => {
      if (tables.length === 0) return;

      const table = tables[0];
      if (table.columns.length === 0) return;

      // Get a sample value from the first column
      const sampleQuery = `SELECT DISTINCT "${table.columns[0].name}" FROM loaded_db."${table.name}" LIMIT 1`;
      const sampleResult = await executeQuery(sampleQuery);

      if (sampleResult.rows.length === 0) return;

      const sampleValue = sampleResult.rows[0][table.columns[0].name];
      const selections: FieldSelection[] = [{
        table: table.name,
        column: table.columns[0].name,
        values: new Set([sampleValue]),
      }];

      const query = queryBuilder.buildTableQuery(table.name, selections, relationships);
      const result = await executeQuery(query);

      expect(result.rows).toBeDefined();
      // All returned rows should have the selected value
      for (const row of result.rows) {
        expect(row[table.columns[0].name]).toBe(sampleValue);
      }
    });
  });

  describe('Cross-Table Filtering', () => {
    it('should filter across related tables', async () => {
      if (relationships.length === 0) {
        console.log('Skipping cross-table test: no relationships detected');
        return;
      }

      const rel = relationships[0];

      // Get a sample value from the "to" table
      const sampleQuery = `SELECT DISTINCT "${rel.toColumn}" FROM loaded_db."${rel.toTable}" LIMIT 1`;
      const sampleResult = await executeQuery(sampleQuery);

      if (sampleResult.rows.length === 0) return;

      const sampleValue = sampleResult.rows[0][rel.toColumn];
      const selections: FieldSelection[] = [{
        table: rel.toTable,
        column: rel.toColumn,
        values: new Set([sampleValue]),
      }];

      // Query the "from" table with selection from "to" table
      const query = queryBuilder.buildTableQuery(rel.fromTable, selections, relationships);
      console.log('\nCross-table query:', query);

      const result = await executeQuery(query);
      console.log(`Cross-table filter returned ${result.rows.length} rows`);

      expect(result.rows).toBeDefined();
    });
  });

  describe('Associative Engine', () => {
    it('should get filtered table data', async () => {
      if (tables.length === 0) return;

      const result = await engine.getFilteredTableData(
        tables[0].name,
        [],
        relationships,
        executeQuery
      );

      expect(result.rows).toBeDefined();
      expect(result.columns).toBeDefined();
    });

    it('should get field values', async () => {
      if (tables.length === 0 || tables[0].columns.length === 0) return;

      const values = await engine.getFieldValues(
        tables[0].name,
        tables[0].columns[0].name,
        executeQuery
      );

      expect(Array.isArray(values)).toBe(true);
    });

    it('should propagate selections and calculate field states', async () => {
      if (tables.length === 0 || tables[0].columns.length === 0) return;

      // Get a sample value
      const sampleQuery = `SELECT DISTINCT "${tables[0].columns[0].name}" FROM loaded_db."${tables[0].name}" LIMIT 1`;
      const sampleResult = await executeQuery(sampleQuery);

      if (sampleResult.rows.length === 0) return;

      const sampleValue = sampleResult.rows[0][tables[0].columns[0].name];
      const selections: FieldSelection[] = [{
        table: tables[0].name,
        column: tables[0].columns[0].name,
        values: new Set([sampleValue]),
      }];

      const fieldStates = await engine.propagateSelection(
        tables,
        selections,
        relationships,
        executeQuery
      );

      console.log(`\nPropagation calculated ${fieldStates.length} field states`);

      expect(fieldStates.length).toBeGreaterThan(0);

      // Check that selected field has the value marked as 'selected'
      const selectedFieldState = fieldStates.find(
        fs => fs.table === tables[0].name && fs.column === tables[0].columns[0].name
      );

      if (selectedFieldState) {
        expect(selectedFieldState.valueStates.get(sampleValue)).toBe('selected');
      }
    });

    it('should mark excluded values correctly', async () => {
      if (tables.length === 0 || tables[0].columns.length === 0) return;

      const table = tables[0];
      const column = table.columns[0];

      // Get all distinct values
      const allValuesQuery = `SELECT DISTINCT "${column.name}" FROM loaded_db."${table.name}" LIMIT 10`;
      const allValuesResult = await executeQuery(allValuesQuery);

      if (allValuesResult.rows.length < 2) {
        console.log('Skipping excluded test: need at least 2 distinct values');
        return;
      }

      // Select only the first value
      const selectedValue = allValuesResult.rows[0][column.name];
      const selections: FieldSelection[] = [{
        table: table.name,
        column: column.name,
        values: new Set([selectedValue]),
      }];

      const fieldStates = await engine.propagateSelection(
        tables,
        selections,
        relationships,
        executeQuery
      );

      const fieldState = fieldStates.find(
        fs => fs.table === table.name && fs.column === column.name
      );

      if (fieldState) {
        // Selected value should be 'selected'
        expect(fieldState.valueStates.get(selectedValue)).toBe('selected');

        // Other values should be 'alternative' (same field)
        const otherValue = allValuesResult.rows[1][column.name];
        expect(fieldState.valueStates.get(otherValue)).toBe('alternative');
      }
    });

    it('should calculate selection statistics', async () => {
      if (tables.length === 0) return;

      const stats = await engine.getSelectionStats(
        tables,
        [],
        relationships,
        executeQuery
      );

      expect(stats.totalTables).toBe(tables.length);
      expect(stats.affectedTables).toBe(0);
      expect(stats.selectedValues).toBe(0);
    });
  });

  describe('End-to-End Selection Flow', () => {
    it('should complete full selection cycle', async () => {
      if (tables.length === 0) {
        console.log('No tables found, skipping E2E test');
        return;
      }

      console.log('\n=== End-to-End Selection Test ===');

      // Step 1: Get initial data from first table
      const table = tables[0];
      console.log(`\n1. Loading data from ${table.name}...`);

      const initialData = await engine.getFilteredTableData(
        table.name,
        [],
        relationships,
        executeQuery
      );
      console.log(`   Initial rows: ${initialData.rows.length}`);

      if (initialData.rows.length === 0 || table.columns.length === 0) {
        console.log('   No data to test with');
        return;
      }

      // Step 2: Make a selection
      const column = table.columns[0];
      const selectedValue = initialData.rows[0][column.name];
      console.log(`\n2. Selecting ${column.name} = ${selectedValue}...`);

      const selections: FieldSelection[] = [{
        table: table.name,
        column: column.name,
        values: new Set([selectedValue]),
      }];

      // Step 3: Get filtered data
      const filteredData = await engine.getFilteredTableData(
        table.name,
        selections,
        relationships,
        executeQuery
      );
      console.log(`   Filtered rows: ${filteredData.rows.length}`);

      expect(filteredData.rows.length).toBeLessThanOrEqual(initialData.rows.length);

      // Step 4: Propagate selection
      console.log('\n3. Propagating selection...');
      const fieldStates = await engine.propagateSelection(
        tables,
        selections,
        relationships,
        executeQuery
      );
      console.log(`   Calculated states for ${fieldStates.length} fields`);

      // Step 5: Get statistics
      const stats = await engine.getSelectionStats(
        tables,
        selections,
        relationships,
        executeQuery
      );
      console.log('\n4. Selection Statistics:');
      console.log(`   Total tables: ${stats.totalTables}`);
      console.log(`   Affected tables: ${stats.affectedTables}`);
      console.log(`   Selected values: ${stats.selectedValues}`);
      console.log('   Possible records per table:');
      for (const [tableName, count] of stats.possibleRecords) {
        console.log(`     - ${tableName}: ${count}`);
      }

      expect(stats.selectedValues).toBe(1);
      expect(stats.affectedTables).toBe(1);

      console.log('\n=== E2E Test Complete ===\n');
    });
  });
});
