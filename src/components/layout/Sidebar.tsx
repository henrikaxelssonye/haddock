import { useTableSchema } from '../../hooks';
import { useDatabaseStore, useCanvasStore, useSchemaStore } from '../../stores';

export function Sidebar() {
  const { tables, activeTable, setActiveTable, relationships } = useTableSchema();
  const fileName = useDatabaseStore(state => state.fileName);
  const isCanvasMode = useCanvasStore(state => state.isCanvasMode);
  const setCanvasMode = useCanvasStore(state => state.setCanvasMode);
  const addTableObject = useCanvasStore(state => state.addTableObject);
  const allTables = useSchemaStore(state => state.tables);

  const handleTableClick = (tableName: string) => {
    if (isCanvasMode) {
      const table = allTables.find(t => t.name === tableName);
      if (table) {
        addTableObject(tableName, table.columns.map(c => c.name));
      }
    } else {
      setActiveTable(tableName);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Database info */}
      <div className="p-3 border-b border-gray-200">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Database
        </div>
        <div className="text-sm font-medium text-gray-900 truncate">
          {fileName || 'No file loaded'}
        </div>
      </div>

      {/* View mode toggle */}
      {fileName && (
        <div className="p-3 border-b border-gray-200">
          <div className="flex rounded-md bg-gray-100 p-0.5">
            <button
              onClick={() => setCanvasMode(false)}
              className={`flex-1 text-xs font-medium py-1.5 rounded transition-colors ${
                !isCanvasMode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setCanvasMode(true)}
              className={`flex-1 text-xs font-medium py-1.5 rounded transition-colors ${
                isCanvasMode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Canvas
            </button>
          </div>
        </div>
      )}

      {/* Tables list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Tables ({tables.length})
            {isCanvasMode && (
              <span className="ml-1 normal-case text-gray-400">- click to add</span>
            )}
          </div>
          <ul className="space-y-1">
            {tables.map(table => (
              <li key={table.name}>
                <button
                  onClick={() => handleTableClick(table.name)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    !isCanvasMode && activeTable === table.name
                      ? 'bg-blue-100 text-blue-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{table.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {table.rowCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {table.columns.length} columns
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Relationships */}
      {relationships.length > 0 && (
        <div className="border-t border-gray-200 p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Relationships ({relationships.length})
          </div>
          <ul className="space-y-1 text-xs text-gray-600 max-h-40 overflow-y-auto">
            {relationships.map(rel => (
              <li
                key={rel.id}
                className="py-1 px-2 bg-gray-50 rounded"
                title={`${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}`}
              >
                <div className="truncate">
                  {rel.fromTable}.{rel.fromColumn}
                </div>
                <div className="text-gray-400">↓</div>
                <div className="truncate">
                  {rel.toTable}.{rel.toColumn}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
