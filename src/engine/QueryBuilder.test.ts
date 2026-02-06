import { describe, it, expect } from 'vitest';
import { QueryBuilder } from './QueryBuilder';
import type { FieldSelection, Relationship, ColumnSelection } from '../types';

describe('QueryBuilder', () => {
  const queryBuilder = new QueryBuilder();

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
    {
      id: 'OrderItems.ProductID->Products.ID',
      fromTable: 'OrderItems',
      fromColumn: 'ProductID',
      toTable: 'Products',
      toColumn: 'ID',
      confidence: 'high',
    },
  ];

  describe('buildTableQuery', () => {
    it('should build simple SELECT when no selections', () => {
      const query = queryBuilder.buildTableQuery('Orders', [], relationships);

      expect(query).toBe('SELECT * FROM loaded_db."Orders" LIMIT 1000');
    });

    it('should build WHERE clause for single selection in same table', () => {
      const selections: FieldSelection[] = [
        { table: 'Orders', column: 'Status', values: new Set(['Pending']) },
      ];

      const query = queryBuilder.buildTableQuery('Orders', selections, relationships);

      expect(query).toContain('WHERE');
      expect(query).toContain('loaded_db."Orders"."Status" IN');
      expect(query).toContain("'Pending'");
    });

    it('should handle multiple values in selection', () => {
      const selections: FieldSelection[] = [
        { table: 'Orders', column: 'Status', values: new Set(['Pending', 'Shipped']) },
      ];

      const query = queryBuilder.buildTableQuery('Orders', selections, relationships);

      expect(query).toContain("'Pending'");
      expect(query).toContain("'Shipped'");
    });

    it('should build JOIN when selection is in related table', () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const query = queryBuilder.buildTableQuery('Orders', selections, relationships);

      expect(query).toContain('JOIN');
      expect(query).toContain('"Customers"');
      expect(query).toContain("'Alice'");
    });

    it('should build multiple JOINs for distant tables', () => {
      const selections: FieldSelection[] = [
        { table: 'Products', column: 'Name', values: new Set(['Widget']) },
      ];

      const query = queryBuilder.buildTableQuery('Customers', selections, relationships);

      // Path: Customers -> Orders -> OrderItems -> Products
      expect(query).toContain('"Orders"');
      expect(query).toContain('"OrderItems"');
      expect(query).toContain('"Products"');
    });

    it('should combine selections from multiple tables', () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
        { table: 'Orders', column: 'Status', values: new Set(['Pending']) },
      ];

      const query = queryBuilder.buildTableQuery('Orders', selections, relationships);

      expect(query).toContain("'Alice'");
      expect(query).toContain("'Pending'");
      expect(query).toContain('AND');
    });

    it('should escape single quotes in string values', () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(["O'Brien"]) },
      ];

      const query = queryBuilder.buildTableQuery('Customers', selections, relationships);

      expect(query).toContain("'O''Brien'");
    });

    it('should format numeric values without quotes', () => {
      const selections: FieldSelection[] = [
        { table: 'Orders', column: 'Amount', values: new Set([100, 200]) },
      ];

      const query = queryBuilder.buildTableQuery('Orders', selections, relationships);

      expect(query).toContain('100');
      expect(query).toContain('200');
      expect(query).not.toContain("'100'");
    });

    it('should format boolean values as TRUE/FALSE', () => {
      const selections: FieldSelection[] = [
        { table: 'Orders', column: 'IsActive', values: new Set([true]) },
      ];

      const query = queryBuilder.buildTableQuery('Orders', selections, relationships);

      expect(query).toContain('TRUE');
    });

    it('should format null as NULL', () => {
      const selections: FieldSelection[] = [
        { table: 'Orders', column: 'Notes', values: new Set([null]) },
      ];

      const query = queryBuilder.buildTableQuery('Orders', selections, relationships);

      expect(query).toContain('NULL');
    });

    it('should use DISTINCT when JOINs are involved', () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const query = queryBuilder.buildTableQuery('Orders', selections, relationships);

      expect(query).toContain('SELECT DISTINCT');
    });

    it('should respect custom limit', () => {
      const query = queryBuilder.buildTableQuery('Orders', [], relationships, 500);

      expect(query).toContain('LIMIT 500');
    });
  });

  describe('buildPossibleValuesQuery', () => {
    it('should build simple DISTINCT query when no selections', () => {
      const query = queryBuilder.buildPossibleValuesQuery(
        'Orders',
        'Status',
        [],
        relationships
      );

      expect(query).toBe('SELECT DISTINCT "Status" FROM loaded_db."Orders"');
    });

    it('should exclude selections from the same field', () => {
      const selections: FieldSelection[] = [
        { table: 'Orders', column: 'Status', values: new Set(['Pending']) },
      ];

      // Querying possible values for the same field that has a selection
      const query = queryBuilder.buildPossibleValuesQuery(
        'Orders',
        'Status',
        selections,
        relationships
      );

      // Should return all values, not filter by the existing selection
      expect(query).toBe('SELECT DISTINCT "Status" FROM loaded_db."Orders"');
    });

    it('should filter by selections from other fields in same table', () => {
      const selections: FieldSelection[] = [
        { table: 'Orders', column: 'CustomerID', values: new Set([1, 2]) },
      ];

      const query = queryBuilder.buildPossibleValuesQuery(
        'Orders',
        'Status',
        selections,
        relationships
      );

      expect(query).toContain('WHERE');
      expect(query).toContain('"CustomerID"');
    });

    it('should build JOINs for selections from related tables', () => {
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const query = queryBuilder.buildPossibleValuesQuery(
        'Orders',
        'Status',
        selections,
        relationships
      );

      expect(query).toContain('JOIN');
      expect(query).toContain('"Customers"');
    });
  });

  describe('buildCompositeTableQuery', () => {
    it('should apply cross-table selections for single-table composite queries', () => {
      const columnSelections: ColumnSelection[] = [
        { table: 'Orders', column: 'ID' },
        { table: 'Orders', column: 'CustomerID' },
      ];
      const selections: FieldSelection[] = [
        { table: 'Customers', column: 'Name', values: new Set(['Alice']) },
      ];

      const { query } = queryBuilder.buildCompositeTableQuery(
        columnSelections,
        selections,
        relationships
      );

      expect(query).toContain('FROM (SELECT DISTINCT t.* FROM loaded_db."Orders" t');
      expect(query).toContain('JOIN loaded_db."Customers"');
      expect(query).toContain("'Alice'");
    });

    it('should prefer existing joined tables for filter paths when duplicate relationship chains exist', () => {
      const duplicateRelationships: Relationship[] = [
        {
          id: 'large_sales.ProductID->products.ID',
          fromTable: 'large_sales',
          fromColumn: 'ProductID',
          toTable: 'products',
          toColumn: 'ID',
          confidence: 'high',
        },
        {
          id: 'sales.ProductID->products.ID',
          fromTable: 'sales',
          fromColumn: 'ProductID',
          toTable: 'products',
          toColumn: 'ID',
          confidence: 'high',
        },
        {
          id: 'large_sales.CustomerID->customers.ID',
          fromTable: 'large_sales',
          fromColumn: 'CustomerID',
          toTable: 'customers',
          toColumn: 'ID',
          confidence: 'high',
        },
        {
          id: 'main_main.sales.ProductID->products.ID',
          fromTable: 'main_main.sales',
          fromColumn: 'ProductID',
          toTable: 'products',
          toColumn: 'ID',
          confidence: 'high',
        },
        {
          id: 'main_main.sales.CustomerID->customers.ID',
          fromTable: 'main_main.sales',
          fromColumn: 'CustomerID',
          toTable: 'customers',
          toColumn: 'ID',
          confidence: 'high',
        },
        {
          id: 'sales.CustomerID->customers.ID',
          fromTable: 'sales',
          fromColumn: 'CustomerID',
          toTable: 'customers',
          toColumn: 'ID',
          confidence: 'high',
        },
      ];

      const columnSelections: ColumnSelection[] = [
        { table: 'products', column: 'Name' },
        { table: 'sales', column: 'CustomerID' },
      ];
      const selections: FieldSelection[] = [
        { table: 'customers', column: 'Name', values: new Set(['Karin Olsen']) },
      ];

      const { query } = queryBuilder.buildCompositeTableQuery(
        columnSelections,
        selections,
        duplicateRelationships
      );

      expect(query).toContain('LEFT JOIN loaded_db."sales" t1 ON t."ID" = t1."ProductID"');
      expect(query).toContain('JOIN loaded_db."customers" t2 ON t1."CustomerID" = t2."ID"');
      expect(query).not.toContain('large_sales');
      expect(query).not.toContain('main_main');
    });
  });
});
