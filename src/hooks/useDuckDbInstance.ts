import { useEffect } from 'react';
import { useDatabaseStore } from '../stores';

export function useDuckDbInstance() {
  const {
    connection,
    isInitializing,
    error,
    initialize,
  } = useDatabaseStore();

  useEffect(() => {
    if (!connection && !isInitializing) {
      initialize();
    }
  }, [connection, isInitializing, initialize]);

  return {
    isReady: !!connection,
    isInitializing,
    error,
  };
}
