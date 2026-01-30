import { useEffect, useRef } from 'react';
import { useDatabaseStore, useSelectionStore, useSchemaStore } from '../stores';
import { AssociativeEngine } from '../engine';

const engine = new AssociativeEngine();

export function useSelectionPropagation() {
  const executeQuery = useDatabaseStore(state => state.executeQuery);
  const selections = useSelectionStore(state => state.selections);
  const setFieldStates = useSelectionStore(state => state.setFieldStates);
  const tables = useSchemaStore(state => state.tables);
  const relationships = useSchemaStore(state => state.relationships);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the propagation calculation
    debounceRef.current = setTimeout(async () => {
      if (tables.length === 0) return;

      try {
        const fieldStates = await engine.propagateSelection(
          tables,
          selections,
          relationships,
          executeQuery
        );
        setFieldStates(fieldStates);
      } catch (err) {
        console.error('Selection propagation failed:', err);
      }
    }, 100); // 100ms debounce

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [selections, tables, relationships, executeQuery, setFieldStates]);
}
