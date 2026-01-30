import { useState, useEffect, useCallback } from 'react';
import { useDatabaseStore, useSelectionStore, useSchemaStore } from '../stores';
import { AssociativeEngine } from '../engine';
import type { DuckDBValue } from '../types';

const engine = new AssociativeEngine();

interface TableData {
  columns: string[];
  rows: Record<string, DuckDBValue>[];
  isLoading: boolean;
  error: string | null;
}

export function useTableData(tableName: string | null, limit = 1000): TableData {
  const [data, setData] = useState<TableData>({
    columns: [],
    rows: [],
    isLoading: false,
    error: null,
  });

  const executeQuery = useDatabaseStore(state => state.executeQuery);
  const selections = useSelectionStore(state => state.selections);
  const relationships = useSchemaStore(state => state.relationships);

  const fetchData = useCallback(async () => {
    if (!tableName) {
      setData({ columns: [], rows: [], isLoading: false, error: null });
      return;
    }

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await engine.getFilteredTableData(
        tableName,
        selections,
        relationships,
        executeQuery,
        limit
      );

      setData({
        columns: result.columns,
        rows: result.rows,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      }));
    }
  }, [tableName, selections, relationships, executeQuery, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return data;
}
