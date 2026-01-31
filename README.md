# Haddock

Associative engine built on DuckDB-WASM.

## Features

### Canvas Mode
- **Composite Tables**: Create canvas tables that combine columns from multiple related tables into a single view
  - Select any columns from any tables in the database
  - Automatic JOIN path detection using relationship graph
  - Visual warnings when tables cannot be joined
  - Full support for selection propagation across composite columns

### Associative Selection
- Click any cell to filter related data across all tables
- Visual state indicators (selected, possible, excluded)
- Cross-table filtering via auto-detected relationships

## Tech Stack

- React 18 + TypeScript
- DuckDB-WASM for in-browser analytics
- TanStack Query & Table
- Zustand for state management
- Vite + Tailwind CSS

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
