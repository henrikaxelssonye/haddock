import { describe, it, expect } from 'vitest';
import { RelationshipDetector } from './RelationshipDetector';
import type { TableSchema, Relationship } from '../types';

describe('RelationshipDetector', () => {
  const detector = new RelationshipDetector();

  describe('detectRelationships', () => {
    it('should detect relationship from TableNameID to Table.ID', () => {
      const tables: TableSchema[] = [
        {
          name: 'Orders',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
            { name: 'CustomerID', type: 'INTEGER', nullable: false },
            { name: 'Amount', type: 'DECIMAL', nullable: false },
          ],
          rowCount: 100,
        },
        {
          name: 'Customers',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
            { name: 'Name', type: 'VARCHAR', nullable: false },
          ],
          rowCount: 50,
        },
      ];

      const relationships = detector.detectRelationships(tables);

      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toMatchObject({
        fromTable: 'Orders',
        fromColumn: 'CustomerID',
        toTable: 'Customers',
        toColumn: 'ID',
      });
    });

    it('should detect relationship with underscore naming (customer_id)', () => {
      const tables: TableSchema[] = [
        {
          name: 'Sales',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'product_id', type: 'INTEGER', nullable: false },
          ],
          rowCount: 100,
        },
        {
          name: 'Products',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'name', type: 'VARCHAR', nullable: false },
          ],
          rowCount: 50,
        },
      ];

      const relationships = detector.detectRelationships(tables);

      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toMatchObject({
        fromTable: 'Sales',
        fromColumn: 'product_id',
        toTable: 'Products',
        toColumn: 'id',
      });
    });

    it('should detect multiple relationships', () => {
      const tables: TableSchema[] = [
        {
          name: 'OrderItems',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
            { name: 'OrderID', type: 'INTEGER', nullable: false },
            { name: 'ProductID', type: 'INTEGER', nullable: false },
          ],
          rowCount: 500,
        },
        {
          name: 'Orders',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
            { name: 'CustomerID', type: 'INTEGER', nullable: false },
          ],
          rowCount: 100,
        },
        {
          name: 'Products',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
            { name: 'Name', type: 'VARCHAR', nullable: false },
          ],
          rowCount: 50,
        },
        {
          name: 'Customers',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
            { name: 'Name', type: 'VARCHAR', nullable: false },
          ],
          rowCount: 30,
        },
      ];

      const relationships = detector.detectRelationships(tables);

      expect(relationships.length).toBeGreaterThanOrEqual(3);

      // Check OrderItems -> Orders
      expect(relationships).toContainEqual(
        expect.objectContaining({
          fromTable: 'OrderItems',
          fromColumn: 'OrderID',
          toTable: 'Orders',
          toColumn: 'ID',
        })
      );

      // Check OrderItems -> Products
      expect(relationships).toContainEqual(
        expect.objectContaining({
          fromTable: 'OrderItems',
          fromColumn: 'ProductID',
          toTable: 'Products',
          toColumn: 'ID',
        })
      );

      // Check Orders -> Customers
      expect(relationships).toContainEqual(
        expect.objectContaining({
          fromTable: 'Orders',
          fromColumn: 'CustomerID',
          toTable: 'Customers',
          toColumn: 'ID',
        })
      );
    });

    it('should not create duplicate relationships', () => {
      const tables: TableSchema[] = [
        {
          name: 'Orders',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
            { name: 'CustomerID', type: 'INTEGER', nullable: false },
          ],
          rowCount: 100,
        },
        {
          name: 'Customers',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
          ],
          rowCount: 50,
        },
      ];

      const relationships = detector.detectRelationships(tables);

      // Should have exactly 1 relationship, not duplicated
      const filtered = relationships.filter(
        r => r.fromColumn === 'CustomerID' || r.toColumn === 'CustomerID'
      );
      expect(filtered).toHaveLength(1);
    });

    it('should return empty array for unrelated tables', () => {
      const tables: TableSchema[] = [
        {
          name: 'Users',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
            { name: 'Email', type: 'VARCHAR', nullable: false },
          ],
          rowCount: 100,
        },
        {
          name: 'Products',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
            { name: 'Name', type: 'VARCHAR', nullable: false },
          ],
          rowCount: 50,
        },
      ];

      const relationships = detector.detectRelationships(tables);
      expect(relationships).toHaveLength(0);
    });

    it('should assign high confidence when types match and target is ID', () => {
      const tables: TableSchema[] = [
        {
          name: 'Orders',
          columns: [
            { name: 'CustomerID', type: 'INTEGER', nullable: false },
          ],
          rowCount: 100,
        },
        {
          name: 'Customers',
          columns: [
            { name: 'ID', type: 'INTEGER', nullable: false },
          ],
          rowCount: 50,
        },
      ];

      const relationships = detector.detectRelationships(tables);
      expect(relationships[0].confidence).toBe('high');
    });
  });

  describe('findConnectedTables', () => {
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

    it('should find all connected tables from a starting table', () => {
      const connected = detector.findConnectedTables('Customers', relationships);

      expect(connected).toContain('Customers');
      expect(connected).toContain('Orders');
      expect(connected).toContain('OrderItems');
      expect(connected).toContain('Products');
      expect(connected.size).toBe(4);
    });

    it('should find connected tables from middle of chain', () => {
      const connected = detector.findConnectedTables('Orders', relationships);

      expect(connected.size).toBe(4);
      expect(connected).toContain('Orders');
      expect(connected).toContain('Customers');
      expect(connected).toContain('OrderItems');
      expect(connected).toContain('Products');
    });

    it('should return only the starting table if no relationships', () => {
      const connected = detector.findConnectedTables('Customers', []);

      expect(connected.size).toBe(1);
      expect(connected).toContain('Customers');
    });
  });

  describe('findPath', () => {
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

    it('should find direct path between adjacent tables', () => {
      const path = detector.findPath('Orders', 'Customers', relationships);

      expect(path).not.toBeNull();
      expect(path).toHaveLength(1);
      expect(path![0]).toMatchObject({
        fromTable: 'Orders',
        toTable: 'Customers',
      });
    });

    it('should find multi-hop path', () => {
      const path = detector.findPath('Customers', 'Products', relationships);

      expect(path).not.toBeNull();
      expect(path!.length).toBe(3); // Customers -> Orders -> OrderItems -> Products
    });

    it('should return empty array for same table', () => {
      const path = detector.findPath('Orders', 'Orders', relationships);

      expect(path).toEqual([]);
    });

    it('should return null for unconnected tables', () => {
      const path = detector.findPath('Orders', 'Unrelated', relationships);

      expect(path).toBeNull();
    });

    it('should find shortest path', () => {
      // Add an alternative longer path
      const extendedRels = [
        ...relationships,
        {
          id: 'Products.CategoryID->Categories.ID',
          fromTable: 'Products',
          fromColumn: 'CategoryID',
          toTable: 'Categories',
          toColumn: 'ID',
          confidence: 'high' as const,
        },
      ];

      const path = detector.findPath('Orders', 'Customers', extendedRels);

      // Should still be direct path, not going through OrderItems -> Products -> Categories
      expect(path).toHaveLength(1);
    });
  });
});
