import { useState, useEffect, useCallback, useRef } from 'react';
import { useDatabaseStore, useSelectionStore, useSchemaStore } from '../stores';
import { QueryBuilder } from '../engine';
import type { DuckDBValue, ColumnSelection } from '../types';

const queryBuilder = new QueryBuilder();

interface CompositeTableData {
  // Column names as they appear in the result (may be "Table.Column" format)
  columns: string[];
  // Mapping from result column name to original table.column
  columnMapping: Map<string, { table: string; column: string }>;
  rows: Record<string, DuckDBValue>[];
  isLoading: boolean;
  error: string | null;
}

export function useCompositeTableData(
  columnSelections: ColumnSelection[],
  limit = 1000
): CompositeTableData {
  const [data, setData] = useState<CompositeTableData>({
    columns: [],
    columnMapping: new Map(),
    rows: [],
    isLoading: false,
    error: null,
  });

  const executeQuery = useDatabaseStore((state) => state.executeQuery);
  const selections = useSelectionStore((state) => state.selections);
  const relationships = useSchemaStore((state) => state.relationships);

  // Track previous query to avoid unnecessary re-fetches
  const prevQueryRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    if (columnSelections.length === 0) {
      setData({
        columns: [],
        columnMapping: new Map(),
        rows: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    const { query, columnMapping } = queryBuilder.buildCompositeTableQuery(
      columnSelections,
      selections,
      relationships,
      limit
    );

    // Skip if query hasn't changed
    if (query === prevQueryRef.current) {
      return;
    }
    prevQueryRef.current = query;

    setData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await executeQuery(query);

      // Extract column names from first row or from columnMapping
      const columns =
        result.rows.length > 0
          ? Object.keys(result.rows[0])
          : Array.from(columnMapping.keys());

      setData({
        columns,
        columnMapping,
        rows: result.rows,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      }));
    }
  }, [columnSelections, selections, relationships, executeQuery, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return data;
}
