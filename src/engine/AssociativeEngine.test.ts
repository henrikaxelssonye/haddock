import { describe, it, expect, vi } from 'vitest';
import { AssociativeEngine } from './AssociativeEngine';
import type { FieldSelection, Relationship, TableSchema } from '../types';

describe('AssociativeEngine', () => {
  const engine = new AssociativeEngine();

  const relationships: Relationship[] = [
    {
      id: 'Orders.CustomerID->Customers.ID',
      fromTable: 'Orders',
      fromColumn: 'CustomerID',
      toTable: 'Customers',
      toColumn: 'ID',
      confidence: 'high',
    },
    {
      id: 'OrderItems.OrderID->Orders.ID',
      fromTable: 'OrderItems',
      fromColumn: 'OrderID',
      toTable: 'Orders',
      toColumn: 'ID',
      confidence: 'high',
    },
  ];

  const tables: TableSchema[] = [
    {
      name: 'Customers',
      columns: [
        { name: 'ID', type: 'INTEGER', nullable: false },
        { name: 'Name', type: 'VARCHAR', nullable: false },
      ],
      rowCount: 50,
    },
    {
      name: 'Orders',
      columns: [
        { name: 'ID', type: 'INTEGER', nullable: false },
        { name: 'CustomerID', type: 'INTEGER', nullable: false },
        { name: 'Status', type: 'VARCHAR', nullable: false },
      ],
      rowCount: 100,
    },
  ];

  describe('propagateSelection', () => {
    it('should return empty array when no selections', async () => {
      const executeQuery = vi.fn();

      const fieldStates = await engine.propagateSelection(
        tables,
        [],
        relationships,
        executeQuery
      );

      expect(fieldStates).toEqual([]);
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it('should calculate field states for all tables when selection exists', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const executeQuery = vi.fn().mockResolvedValue({
        rows: [{ ID: 1 }, { Name: 'Alice' }],
      });

      const fieldStates = await engine.propagateSelection(
        tables,
        selections,
        relationships,
        executeQuery
      );

      // Should have states for all fields across all tables
      expect(fieldStates.length).toBeGreaterThan(0);
    });
  });

  describe('getFilteredTableData', () => {
    it('should return all data when no selections', async () => {
      const mockRows = [
        { ID: 1, CustomerID: 1, Status: 'Pending' },
        { ID: 2, CustomerID: 2, Status: 'Shipped' },
      ];

      const executeQuery = vi.fn().mockResolvedValue({ rows: mockRows });

      const result = await engine.getFilteredTableData(
        'Orders',
        [],
        relationships,
        executeQuery
      );

      expect(result.rows).toEqual(mockRows);
      expect(result.columns).toEqual(['ID', 'CustomerID', 'Status']);
    });

    it('should return filtered data based on selection', async () => {
      const selections: FieldSelection[] = [
        { table: 'Orders', column: 'Status', values: new Set(['Pending']) },
      ];

      const mockRows = [{ ID: 1, CustomerID: 1, Status: 'Pending' }];
      const executeQuery = vi.fn().mockResolvedValue({ rows: mockRows });

      await engine.getFilteredTableData(
        'Orders',
        selections,
        relationships,
        executeQuery
      );

      expect(executeQuery).toHaveBeenCalled();
      const calledQuery = executeQuery.mock.calls[0][0];
      expect(calledQuery).toContain("'Pending'");
    });

    it('should handle cross-table filtering', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const executeQuery = vi.fn().mockResolvedValue({ rows: [] });

      await engine.getFilteredTableData(
        'Orders',
        selections,
        relationships,
        executeQuery
      );

      const calledQuery = executeQuery.mock.calls[0][0];
      expect(calledQuery).toContain('JOIN');
      expect(calledQuery).toContain('Customers');
    });

    it('should return empty columns for empty result', async () => {
      const executeQuery = vi.fn().mockResolvedValue({ rows: [] });

      const result = await engine.getFilteredTableData(
        'Orders',
        [],
        relationships,
        executeQuery
      );

      expect(result.columns).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const executeQuery = vi.fn().mockResolvedValue({ rows: [] });

      await engine.getFilteredTableData(
        'Orders',
        [],
        relationships,
        executeQuery,
        500
      );

      const calledQuery = executeQuery.mock.calls[0][0];
      expect(calledQuery).toContain('LIMIT 500');
    });
  });

  describe('getFieldValues', () => {
    it('should return distinct values for a field', async () => {
      const mockRows = [
        { Status: 'Pending' },
        { Status: 'Shipped' },
        { Status: 'Cancelled' },
      ];

      const executeQuery = vi.fn().mockResolvedValue({ rows: mockRows });

      const values = await engine.getFieldValues(
        'Orders',
        'Status',
        executeQuery
      );

      expect(values).toEqual(['Pending', 'Shipped', 'Cancelled']);
    });

    it('should query with ORDER BY and LIMIT', async () => {
      const executeQuery = vi.fn().mockResolvedValue({ rows: [] });

      await engine.getFieldValues('Orders', 'Status', executeQuery);

      const calledQuery = executeQuery.mock.calls[0][0];
      expect(calledQuery).toContain('ORDER BY');
      expect(calledQuery).toContain('LIMIT 10000');
    });
  });

  describe('getSelectionStats', () => {
    it('should return correct total tables count', async () => {
      const executeQuery = vi.fn().mockResolvedValue({ rows: [] });

      const stats = await engine.getSelectionStats(
        tables,
        [],
        relationships,
        executeQuery
      );

      expect(stats.totalTables).toBe(2);
    });

    it('should count selected values across all selections', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice', 'Bob']) },
        { table: 'Orders', column: 'Status', values: new Set(['Pending']) },
      ];

      const executeQuery = vi.fn().mockResolvedValue({ rows: [] });

      const stats = await engine.getSelectionStats(
        tables,
        selections,
        relationships,
        executeQuery
      );

      expect(stats.selectedValues).toBe(3); // 2 from Name + 1 from Status
    });

    it('should count affected tables correctly', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
        { table: 'Orders', column: 'Status', values: new Set(['Pending']) },
      ];

      const executeQuery = vi.fn().mockResolvedValue({ rows: [] });

      const stats = await engine.getSelectionStats(
        tables,
        selections,
        relationships,
        executeQuery
      );

      expect(stats.affectedTables).toBe(2);
    });

    it('should count possible records per table', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const executeQuery = vi.fn()
        .mockResolvedValueOnce({ rows: new Array(25).fill({}) }) // Customers
        .mockResolvedValueOnce({ rows: new Array(100).fill({}) }); // Orders

      const stats = await engine.getSelectionStats(
        tables,
        selections,
        relationships,
        executeQuery
      );

      expect(stats.possibleRecords.get('Customers')).toBe(25);
      expect(stats.possibleRecords.get('Orders')).toBe(100);
    });

    it('should cap possible records at 10000', async () => {
      const executeQuery = vi.fn().mockResolvedValue({
        rows: new Array(10001).fill({}),
      });

      const stats = await engine.getSelectionStats(
        tables,
        [{ table: 'Customers', column: 'Name', values: new Set(['Alice']) }],
        relationships,
        executeQuery
      );

      expect(stats.possibleRecords.get('Customers')).toBe(10000);
    });
  });
});
