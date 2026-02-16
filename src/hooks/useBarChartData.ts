import { useState, useEffect, useCallback, useRef } from 'react';
import { useDatabaseStore, useSelectionStore, useSchemaStore } from '../stores';
import { QueryBuilder } from '../engine';
import type { BarChartConfig, DuckDBValue } from '../types';

interface BarChartRow {
  category: DuckDBValue;
  value: number;
}

interface BarChartDataResult {
  rows: BarChartRow[];
  isLoading: boolean;
  error: string | null;
}

const queryBuilder = new QueryBuilder();

function toNumericValue(value: DuckDBValue): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return Number(value ?? 0);
}

export function useBarChartData(config: BarChartConfig): BarChartDataResult {
  const [data, setData] = useState<BarChartDataResult>({
    rows: [],
    isLoading: false,
    error: null,
  });
  const executeQuery = useDatabaseStore((state) => state.executeQuery);
  const selections = useSelectionStore((state) => state.selections);
  const relationships = useSchemaStore((state) => state.relationships);
  const prevQueryRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    const query = queryBuilder.buildBarChartQuery(config, selections, relationships);

    if (query === prevQueryRef.current) {
      return;
    }
    prevQueryRef.current = query;

    setData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await executeQuery(query);
      const rows = result.rows.map((row) => ({
        category: (row.__category ?? null) as DuckDBValue,
        value: toNumericValue((row.__value ?? 0) as DuckDBValue),
      }));
      setData({
        rows,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setData({
        rows: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load chart data',
      });
    }
  }, [config, executeQuery, relationships, selections]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return data;
}
