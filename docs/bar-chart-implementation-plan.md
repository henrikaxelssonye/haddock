# Bar Chart Canvas Support Implementation Plan

## Goal
Add support for bar chart objects in Canvas mode, reusing existing selection propagation and query logic, and validating each phase with Playwright while preserving browser tab/session state.

## Phase 1: Canvas object model and store support
- Introduce typed canvas object variants in `src/types/canvas.ts` with a discriminated union:
  - `table` objects (existing behavior)
  - `barChart` objects (new)
- Add bar chart config shape (category, measure, aggregation, sort, limit).
- Update `src/stores/canvasStore.ts` to store union-typed canvas objects.
- Add bar chart actions:
  - create/add
  - update config
- Preserve existing table APIs for backward compatibility.

## Phase 2: Generalized canvas rendering
- Update `src/components/canvas/ReportCanvas.tsx` to render multiple canvas object types.
- Evolve or replace `CanvasTableWrapper` with a generic wrapper that supports shared interactions:
  - drag
  - resize
  - bring-to-front
  - remove
- Render table content for `table` objects and bar chart content for `barChart` objects.

## Phase 3: Bar chart data pipeline
- Extend `src/engine/QueryBuilder.ts` with `buildBarChartQuery(...)`.
- Reuse relationship path/join/filter logic used by composite table queries.
- Support grouped category + aggregate measure:
  - `count`
  - `sum`
  - `avg`
  - `min`
  - `max`
- Add `src/hooks/useBarChartData.ts` following the query execution pattern from existing hooks.
- Add/extend unit tests in `src/engine/QueryBuilder.test.ts` for:
  - aggregate SQL generation
  - cross-table filtering with joins
  - edge conditions (no measure for count, unreachable paths)

## Phase 4: Bar chart creation and configuration UX
- Add `Add Bar Chart` action in `src/components/canvas/CanvasToolbar.tsx`.
- Provide config UI to select:
  - category column
  - measure column (optional for count)
  - aggregation
  - optional top-N limit
- Add inline edit action in chart object header for reconfiguration.

## Phase 5: Chart renderer
- Implement `src/components/canvas/CanvasBarChart.tsx` using SVG (initial version, no extra chart dependency).
- Include chart states:
  - loading
  - empty
  - error
- Add axis labels and readable category/value display.
- Enable bar click to trigger selection via existing selection store.

## Phase 6: Incremental Playwright validation
- Use Playwright CLI in headed persistent mode.
- Keep the same browser session/tab across iterations.
- Do not refresh/restart browser session unless explicitly requested.
- After each phase:
  - take snapshot
  - validate expected behavior for that phase
  - capture screenshot to `output/playwright/`

## Validation checklist (minimum)
1. Can create a bar chart object from canvas toolbar.
2. Can drag, resize, remove, and reconfigure bar chart objects.
3. Chart renders grouped data with chosen aggregation.
4. Cross-table selections correctly filter chart data.
5. Clicking chart bars applies selections.
6. Existing canvas table behavior remains intact.
