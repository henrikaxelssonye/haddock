import { useMemo } from 'react';
import { usePieChartData } from '../../hooks';
import { useSelectionStore } from '../../stores';
import type { PieChartConfig, DuckDBValue } from '../../types';

interface CanvasPieChartProps {
  config: PieChartConfig;
}

const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;
const RADIUS = 150;
const LABEL_RADIUS = RADIUS + 24;

const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

function formatCategory(value: DuckDBValue): string {
  if (value === null) return 'NULL';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

export function CanvasPieChart({ config }: CanvasPieChartProps) {
  const { rows, isLoading, error } = usePieChartData(config);
  const selectValue = useSelectionStore((state) => state.selectValue);
  const getValueState = useSelectionStore((state) => state.getValueState);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + Math.max(0, row.value), 0),
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

  if (rows.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-xs">
        <p>No data matches current selection</p>
      </div>
    );
  }

  // Build slices
  let currentAngle = -Math.PI / 2; // start at top
  const slices = rows.map((row, index) => {
    const value = Math.max(0, row.value);
    const sliceAngle = (value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const midAngle = startAngle + sliceAngle / 2;
    const labelPos = polarToCartesian(CENTER, CENTER, LABEL_RADIUS, midAngle);

    const selectionState = getValueState(
      config.category.table,
      config.category.column,
      row.category
    );

    const baseColor = COLORS[index % COLORS.length];
    const fill =
      selectionState === 'excluded' ? '#d1d5db' : baseColor;
    const opacity = selectionState === 'excluded' ? 0.5 : 1;

    return {
      row,
      index,
      startAngle,
      endAngle,
      sliceAngle,
      midAngle,
      labelPos,
      fill,
      opacity,
      percentage: ((value / total) * 100).toFixed(1),
    };
  });

  return (
    <div className="h-full w-full p-2">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        role="img"
        aria-label="Pie chart"
      >
        <rect x={0} y={0} width={SVG_SIZE} height={SVG_SIZE} fill="white" />

        {slices.map((slice) => {
          const categoryLabel = formatCategory(slice.row.category);

          // For a single slice covering 100%, draw a circle
          if (slice.sliceAngle >= 2 * Math.PI - 0.001) {
            return (
              <g key={`${categoryLabel}-${slice.index}`}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill={slice.fill}
                  opacity={slice.opacity}
                  className="cursor-pointer"
                  onClick={(event) =>
                    selectValue(
                      {
                        table: config.category.table,
                        column: config.category.column,
                        value: slice.row.category,
                      },
                      event.ctrlKey || event.metaKey
                    )
                  }
                />
              </g>
            );
          }

          return (
            <g key={`${categoryLabel}-${slice.index}`}>
              <path
                d={describeArc(CENTER, CENTER, RADIUS, slice.startAngle, slice.endAngle)}
                fill={slice.fill}
                opacity={slice.opacity}
                stroke="white"
                strokeWidth={2}
                className="cursor-pointer"
                onClick={(event) =>
                  selectValue(
                    {
                      table: config.category.table,
                      column: config.category.column,
                      value: slice.row.category,
                    },
                    event.ctrlKey || event.metaKey
                  )
                }
              />
              {slice.sliceAngle > 0.15 && (
                <text
                  x={slice.labelPos.x}
                  y={slice.labelPos.y}
                  textAnchor={slice.labelPos.x > CENTER ? 'start' : 'end'}
                  dominantBaseline="central"
                  className="fill-gray-700 text-[10px]"
                >
                  {categoryLabel} ({slice.percentage}%)
                </text>
              )}
            </g>
          );
        })}

        <text
          x={CENTER}
          y={SVG_SIZE - 8}
          textAnchor="middle"
          className="fill-gray-500 text-[11px]"
        >
          {config.aggregation.toUpperCase()}
          {config.measure ? `(${config.measure.column})` : '(*)'}
          {' — Total: '}
          {formatValue(total)}
        </text>
      </svg>
    </div>
  );
}
