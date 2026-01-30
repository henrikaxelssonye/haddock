import { useCallback } from 'react';
import { useSchemaStore } from '../stores';
import type { TableSchema } from '../types';

export function useTableSchema() {
  const {
    tables,
    relationships,
    isLoading,
    error,
    activeTable,
    loadSchema,
    setActiveTable,
  } = useSchemaStore();

  const getTable = useCallback(
    (tableName: string): TableSchema | undefined => {
      return tables.find(t => t.name === tableName);
    },
    [tables]
  );

  const getActiveTableSchema = useCallback((): TableSchema | undefined => {
    if (!activeTable) return undefined;
    return tables.find(t => t.name === activeTable);
  }, [tables, activeTable]);

  return {
    tables,
    relationships,
    isLoading,
    error,
    activeTable,
    loadSchema,
    setActiveTable,
    getTable,
    getActiveTableSchema,
  };
}
