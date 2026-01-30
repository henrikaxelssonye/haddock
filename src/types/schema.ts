export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface Relationship {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface SchemaInfo {
  tables: TableSchema[];
  relationships: Relationship[];
}
