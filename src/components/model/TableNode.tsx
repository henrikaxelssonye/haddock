import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ColumnInfo } from '../../types';

export interface TableNodeData {
  tableName: string;
  columns: ColumnInfo[];
  relationshipColumns: Set<string>;
  rowCount: number;
  [key: string]: unknown; // Index signature for React Flow compatibility
}

interface TableNodeProps {
  data: TableNodeData;
}

function TableNodeComponent({ data }: TableNodeProps) {
  const { tableName, columns, relationshipColumns, rowCount } = data;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 min-w-[200px] max-w-[300px]">
      {/* Table header */}
      <div className="bg-blue-600 text-white px-3 py-2 rounded-t-lg">
        <div className="font-semibold text-sm truncate">{tableName}</div>
        <div className="text-xs text-blue-200">{rowCount.toLocaleString()} rows</div>
      </div>

      {/* Columns list */}
      <div className="max-h-[300px] overflow-y-auto">
        {columns.map((col) => {
          const isRelationshipCol = relationshipColumns.has(col.name);
          return (
            <div
              key={col.name}
              className={`px-3 py-1.5 text-xs border-b border-gray-100 last:border-b-0 flex items-center justify-between ${
                isRelationshipCol ? 'bg-yellow-50' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isRelationshipCol && (
                  <span className="text-yellow-600" title="Relationship column">
                    🔗
                  </span>
                )}
                <span className={`truncate ${isRelationshipCol ? 'font-medium' : ''}`}>
                  {col.name}
                </span>
              </div>
              <span className="text-gray-400 ml-2 shrink-0">{col.type}</span>
            </div>
          );
        })}
      </div>

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-500 !w-3 !h-3"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500 !w-3 !h-3"
      />
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
