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
import { TableCell } from '../tables/TableCell';
import type { DuckDBValue } from '../../types';

interface CanvasTableProps {
  tableName: string;
  selectedColumns: string[];
}

type RowData = Record<string, DuckDBValue>;

const columnHelper = createColumnHelper<RowData>();

export function CanvasTable({ tableName, selectedColumns }: CanvasTableProps) {
  const { columns, rows, isLoading, error } = useTableData(tableName);
  const selectValue = useSelectionStore((state) => state.selectValue);
  const getValueState = useSelectionStore((state) => state.getValueState);
  const fieldStates = useSelectionStore((state) => state.fieldStates);

  const filteredColumns = useMemo(
    () => columns.filter((col) => selectedColumns.includes(col)),
    [columns, selectedColumns]
  );

  const handleCellClick = useCallback(
    (column: string, value: DuckDBValue, event: React.MouseEvent) => {
      selectValue(
        { table: tableName, column, value },
        event.ctrlKey || event.metaKey
      );
    },
    [tableName, selectValue]
  );

  const tableColumns = useMemo<ColumnDef<RowData, DuckDBValue>[]>(
    () =>
      filteredColumns.map((col) =>
        columnHelper.accessor((row) => row[col], {
          id: col,
          header: col,
          cell: (info) => {
            const value = info.getValue();
            const state = getValueState(tableName, col, value);
            return <TableCell value={value} state={state} onClick={() => {}} />;
          },
        })
      ),
    [filteredColumns, tableName, getValueState, fieldStates]
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2" />
          <p className="text-gray-500 text-xs">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-600 text-xs p-2">
        <p>{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-xs">
        <p>No data matches current selection</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-gray-100 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
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
  );
}
