import { useDuckDbInstance, useTableSchema, useSelectionPropagation } from './hooks';
import { useDatabaseStore, useCanvasStore, useSchemaStore } from './stores';
import {
  AppShell,
  Sidebar,
  Workspace,
  FileDropZone,
  DatabaseInfo,
  StraightTable,
  SelectionBar,
  ReportCanvas,
  ModelDiagram,
} from './components';

function App() {
  const { isReady, isInitializing, error: dbError } = useDuckDbInstance();
  const fileName = useDatabaseStore(state => state.fileName);
  const { activeTable, relationships } = useTableSchema();
  const viewMode = useCanvasStore(state => state.viewMode);
  const tables = useSchemaStore(state => state.tables);

  // Enable selection propagation
  useSelectionPropagation();

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Initializing DuckDB...</p>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center text-red-600 max-w-md">
          <p className="font-medium text-lg">Failed to initialize DuckDB</p>
          <p className="text-sm mt-2">{dbError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return null;
  }

  return (
    <AppShell sidebar={<Sidebar />}>
      <Workspace>
        {!fileName ? (
          <div className="h-full">
            <FileDropZone />
          </div>
        ) : viewMode === 'model' ? (
          <div className="flex-1 min-h-0">
            <ModelDiagram tables={tables} relationships={relationships} />
          </div>
        ) : viewMode === 'canvas' ? (
          <>
            <SelectionBar />
            <div className="flex-1 min-h-0">
              <ReportCanvas />
            </div>
          </>
        ) : (
          <>
            <DatabaseInfo />
            <SelectionBar />
            {activeTable && (
              <div className="flex-1 min-h-0">
                <StraightTable tableName={activeTable} />
              </div>
            )}
          </>
        )}
      </Workspace>
    </AppShell>
  );
}

export default App;
