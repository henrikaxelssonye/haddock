import type { DuckDBValue, SelectionState } from '../../types';

interface TableCellProps {
  value: DuckDBValue;
  state: SelectionState;
  onClick: (e: React.MouseEvent) => void;
}

const stateStyles: Record<SelectionState, string> = {
  selected: 'bg-selection-selected text-white font-medium',
  possible: 'bg-selection-possible text-gray-900',
  alternative: 'bg-selection-alternative text-gray-600',
  excluded: 'bg-selection-excluded text-gray-400',
};

export function TableCell({ value, state, onClick }: TableCellProps) {
  const displayValue = formatValue(value);

  return (
    <td
      onClick={onClick}
      className={`
        px-3 py-2 cursor-pointer transition-colors
        border-r border-gray-200 last:border-r-0
        hover:ring-2 hover:ring-blue-400 hover:ring-inset
        ${stateStyles[state]}
      `}
      title={`${displayValue} (${state})`}
    >
      <span className="block truncate max-w-xs">
        {displayValue}
      </span>
    </td>
  );
}

function formatValue(value: DuckDBValue): string {
  if (value === null || value === undefined) {
    return '(null)';
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}
