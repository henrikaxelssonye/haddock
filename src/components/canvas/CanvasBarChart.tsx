import { useMemo } from 'react';
import { useBarChartData } from '../../hooks';
import { useSelectionStore } from '../../stores';
import type { BarChartConfig, DuckDBValue } from '../../types';

interface CanvasBarChartProps {
  config: BarChartConfig;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 420;
const PADDING = { top: 28, right: 20, bottom: 96, left: 72 };

function formatCategory(value: DuckDBValue): string {
  if (value === null) {
    return 'NULL';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2);
}

export function CanvasBarChart({ config }: CanvasBarChartProps) {
  const { rows, isLoading, error } = useBarChartData(config);
  const selectValue = useSelectionStore((state) => state.selectValue);
  const getValueState = useSelectionStore((state) => state.getValueState);

  const chartWidth = SVG_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = useMemo(
    () => Math.max(...rows.map((row) => row.value), 0),
    [rows]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2" />
          <p className="text-gray-500 text-xs">Loading chart...</p>
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

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const ratio = index / tickCount;
    return {
      y: PADDING.top + chartHeight * (1 - ratio),
      value: maxValue * ratio,
    };
  });

  const gap = 12;
  const barWidth = Math.max(12, (chartWidth - gap * (rows.length - 1)) / rows.length);

  return (
    <div className="h-full w-full p-2">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        role="img"
        aria-label="Bar chart"
      >
        <rect x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT} fill="white" />
        {ticks.map((tick) => (
          <g key={`tick-${tick.value}`}>
            <line
              x1={PADDING.left}
              x2={SVG_WIDTH - PADDING.right}
              y1={tick.y}
              y2={tick.y}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-gray-500 text-[11px]"
            >
              {formatValue(tick.value)}
            </text>
          </g>
        ))}

        <line
          x1={PADDING.left}
          x2={PADDING.left}
          y1={PADDING.top}
          y2={PADDING.top + chartHeight}
          stroke="#9ca3af"
          strokeWidth={1.5}
        />
        <line
          x1={PADDING.left}
          x2={SVG_WIDTH - PADDING.right}
          y1={PADDING.top + chartHeight}
          y2={PADDING.top + chartHeight}
          stroke="#9ca3af"
          strokeWidth={1.5}
        />

        {rows.map((row, index) => {
          const x = PADDING.left + index * (barWidth + gap);
          const safeMax = maxValue > 0 ? maxValue : 1;
          const height = (row.value / safeMax) * chartHeight;
          const y = PADDING.top + chartHeight - height;
          const categoryLabel = formatCategory(row.category);
          const selectionState = getValueState(
            config.category.table,
            config.category.column,
            row.category
          );
          const fill =
            selectionState === 'selected'
              ? '#2563eb'
              : selectionState === 'excluded'
                ? '#d1d5db'
                : '#60a5fa';

          return (
            <g key={`${categoryLabel}-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(0, height)}
                rx={4}
                fill={fill}
                className="cursor-pointer"
                onClick={(event) =>
                  selectValue(
                    {
                      table: config.category.table,
                      column: config.category.column,
                      value: row.category,
                    },
                    event.ctrlKey || event.metaKey
                  )
                }
              />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-gray-700 text-[11px]"
              >
                {formatValue(row.value)}
              </text>
              <text
                x={x + barWidth / 2}
                y={PADDING.top + chartHeight + 14}
                textAnchor="end"
                transform={`rotate(-35 ${x + barWidth / 2} ${PADDING.top + chartHeight + 14})`}
                className="fill-gray-600 text-[11px]"
              >
                {categoryLabel}
              </text>
            </g>
          );
        })}

        <text
          x={PADDING.left + chartWidth / 2}
          y={SVG_HEIGHT - 10}
          textAnchor="middle"
          className="fill-gray-700 text-[12px]"
        >
          {config.category.table}.{config.category.column}
        </text>
        <text
          x={18}
          y={PADDING.top + chartHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${PADDING.top + chartHeight / 2})`}
          className="fill-gray-700 text-[12px]"
        >
          {config.aggregation.toUpperCase()}
          {config.measure ? `(${config.measure.column})` : '(*)'}
        </text>
      </svg>
    </div>
  );
}
