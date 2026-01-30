import { useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table';
import { useTableData } from '../../hooks';
import { useSelectionStore } from '../../stores';
import { TableCell } from './TableCell';
import type { DuckDBValue } from '../../types';

interface StraightTableProps {
  tableName: string;
}

type RowData = Record<string, DuckDBValue>;

const columnHelper = createColumnHelper<RowData>();

export function StraightTable({ tableName }: StraightTableProps) {
  const { columns, rows, isLoading, error } = useTableData(tableName);
  const selectValue = useSelectionStore(state => state.selectValue);
  const getValueState = useSelectionStore(state => state.getValueState);
  const fieldStates = useSelectionStore(state => state.fieldStates);

  const handleCellClick = useCallback(
    (column: string, value: DuckDBValue, event: React.MouseEvent) => {
      selectValue(
        { table: tableName, column, value },
        event.ctrlKey || event.metaKey
      );
    },
    [tableName, selectValue]
  );

  const tableColumns = useMemo<ColumnDef<RowData, DuckDBValue>[]>(() => {
    return columns.map((col) =>
      columnHelper.accessor((row) => row[col], {
        id: col,
        header: col,
        cell: (info) => {
          const value = info.getValue();
          const state = getValueState(tableName, col, value);
          return (
            <TableCell
              value={value}
              state={state}
              onClick={() => {}}
            />
          );
        },
      })
    );
  }, [columns, tableName, getValueState, fieldStates]);

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-red-200">
        <div className="text-center text-red-600">
          <p className="font-medium">Error loading table</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
        <div className="text-center text-gray-500">
          <p>No data matches current selection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col h-full">
      {/* Table header with name and row count */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">{tableName}</h3>
        <span className="text-sm text-gray-500">
          {rows.length.toLocaleString()} rows
          {rows.length >= 1000 && ' (limited)'}
        </span>
      </div>

      {/* Scrollable table container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-100 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/50">
                {row.getVisibleCells().map((cell) => {
                  const value = cell.getValue() as DuckDBValue;
                  const columnId = cell.column.id;
                  const state = getValueState(tableName, columnId, value);

                  return (
                    <TableCell
                      key={cell.id}
                      value={value}
                      state={state}
                      onClick={(e: React.MouseEvent) =>
                        handleCellClick(columnId, value, e)
                      }
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
