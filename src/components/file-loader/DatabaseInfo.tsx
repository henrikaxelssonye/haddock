import { useDatabaseStore, useSchemaStore } from '../../stores';

export function DatabaseInfo() {
  const fileName = useDatabaseStore(state => state.fileName);
  const tables = useSchemaStore(state => state.tables);
  const relationships = useSchemaStore(state => state.relationships);

  if (!fileName) return null;

  const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);
  const totalColumns = tables.reduce((sum, t) => sum + t.columns.length, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="font-medium text-gray-900 mb-3">Database Overview</h3>
      <div className="grid grid-cols-4 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">
            {tables.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Tables</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">
            {totalColumns}
          </div>
          <div className="text-xs text-gray-500 mt-1">Columns</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-600">
            {totalRows.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Rows</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-orange-600">
            {relationships.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Relationships</div>
        </div>
      </div>
    </div>
  );
}
