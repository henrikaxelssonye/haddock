import { describe, it, expect, vi } from 'vitest';
import { StateCalculator } from './StateCalculator';
import type { FieldSelection, Relationship, DuckDBValue } from '../types';

describe('StateCalculator', () => {
  const stateCalculator = new StateCalculator();

  const relationships: Relationship[] = [
    {
      id: 'Orders.CustomerID->Customers.ID',
      fromTable: 'Orders',
      fromColumn: 'CustomerID',
      toTable: 'Customers',
      toColumn: 'ID',
      confidence: 'high',
    },
  ];

  const tables = [
    { name: 'Orders', columns: [{ name: 'ID' }, { name: 'CustomerID' }, { name: 'Status' }] },
    { name: 'Customers', columns: [{ name: 'ID' }, { name: 'Name' }] },
  ];

  describe('calculateFieldStates', () => {
    it('should return empty array when no selections', async () => {
      const executeQuery = vi.fn();

      const states = await stateCalculator.calculateFieldStates(
        tables,
        [],
        relationships,
        executeQuery
      );

      expect(states).toEqual([]);
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it('should calculate states for all fields when selections exist', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const executeQuery = vi.fn().mockImplementation((sql: string) => {
        // Mock different responses based on query
        if (sql.includes('SELECT DISTINCT "Name"')) {
          return Promise.resolve({ rows: [{ Name: 'Alice' }, { Name: 'Bob' }] });
        }
        if (sql.includes('SELECT DISTINCT "ID"')) {
          return Promise.resolve({ rows: [{ ID: 1 }, { ID: 2 }, { ID: 3 }] });
        }
        if (sql.includes('SELECT DISTINCT "Status"')) {
          return Promise.resolve({ rows: [{ Status: 'Pending' }, { Status: 'Shipped' }] });
        }
        if (sql.includes('SELECT DISTINCT "CustomerID"')) {
          return Promise.resolve({ rows: [{ CustomerID: 1 }, { CustomerID: 2 }] });
        }
        // For possible values queries with JOINs, return subset
        if (sql.includes('JOIN') && sql.includes('"Status"')) {
          return Promise.resolve({ rows: [{ Status: 'Pending' }] });
        }
        if (sql.includes('JOIN') && sql.includes('"CustomerID"')) {
          return Promise.resolve({ rows: [{ CustomerID: 1 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const states = await stateCalculator.calculateFieldStates(
        tables,
        selections,
        relationships,
        executeQuery
      );

      // Should have a state for each field in each table
      expect(states.length).toBe(5); // 3 fields in Orders + 2 in Customers
    });
  });

  describe('calculateFieldState', () => {
    it('should mark selected values as "selected"', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const executeQuery = vi.fn().mockResolvedValue({
        rows: [{ Name: 'Alice' }, { Name: 'Bob' }, { Name: 'Charlie' }],
      });

      const state = await stateCalculator.calculateFieldState(
        'Customers',
        'Name',
        selections,
        relationships,
        executeQuery
      );

      expect(state.valueStates.get('Alice')).toBe('selected');
    });

    it('should mark non-selected values in same field as "alternative"', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const executeQuery = vi.fn().mockResolvedValue({
        rows: [{ Name: 'Alice' }, { Name: 'Bob' }, { Name: 'Charlie' }],
      });

      const state = await stateCalculator.calculateFieldState(
        'Customers',
        'Name',
        selections,
        relationships,
        executeQuery
      );

      expect(state.valueStates.get('Bob')).toBe('alternative');
      expect(state.valueStates.get('Charlie')).toBe('alternative');
    });

    it('should mark values as "possible" when in possible values result', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      // Mock: querying possible values for Orders.Status
      // First call: possible values query (with JOIN to Customers)
      // Second call: all values query
      const executeQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [{ Status: 'Pending' }] }) // Possible
        .mockResolvedValueOnce({ rows: [{ Status: 'Pending' }, { Status: 'Shipped' }] }); // All

      const state = await stateCalculator.calculateFieldState(
        'Orders',
        'Status',
        selections,
        relationships,
        executeQuery
      );

      expect(state.valueStates.get('Pending')).toBe('possible');
      expect(state.valueStates.get('Shipped')).toBe('excluded');
    });

    it('should mark values as "excluded" when not in possible values', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const executeQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [{ Status: 'Pending' }] }) // Possible values (filtered)
        .mockResolvedValueOnce({
          rows: [
            { Status: 'Pending' },
            { Status: 'Shipped' },
            { Status: 'Cancelled' },
          ],
        }); // All values

      const state = await stateCalculator.calculateFieldState(
        'Orders',
        'Status',
        selections,
        relationships,
        executeQuery
      );

      expect(state.valueStates.get('Shipped')).toBe('excluded');
      expect(state.valueStates.get('Cancelled')).toBe('excluded');
    });

    it('should handle multiple selected values', async () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice', 'Bob']) },
      ];

      const executeQuery = vi.fn().mockResolvedValue({
        rows: [{ Name: 'Alice' }, { Name: 'Bob' }, { Name: 'Charlie' }],
      });

      const state = await stateCalculator.calculateFieldState(
        'Customers',
        'Name',
        selections,
        relationships,
        executeQuery
      );

      expect(state.valueStates.get('Alice')).toBe('selected');
      expect(state.valueStates.get('Bob')).toBe('selected');
      expect(state.valueStates.get('Charlie')).toBe('alternative');
    });

    it('should return correct table and column in state', async () => {
      const executeQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const state = await stateCalculator.calculateFieldState(
        'Orders',
        'Status',
        [{ table: 'Customers', column: 'Name', values: new Set(['Alice']) }],
        relationships,
        executeQuery
      );

      expect(state.table).toBe('Orders');
      expect(state.column).toBe('Status');
    });
  });
});
