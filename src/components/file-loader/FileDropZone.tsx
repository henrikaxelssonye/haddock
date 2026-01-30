import { useCallback, useState } from 'react';
import { useDatabaseStore, useSchemaStore, useSelectionStore } from '../../stores';

export function FileDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const { loadFile, isLoading, error } = useDatabaseStore();
  const { loadSchema } = useSchemaStore();
  const { clearAllSelections } = useSelectionStore();

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.duckdb') && !file.name.endsWith('.db')) {
      alert('Please drop a DuckDB file (.duckdb or .db)');
      return;
    }

    try {
      clearAllSelections();
      await loadFile(file);
      await loadSchema();
    } catch (err) {
      console.error('Failed to load file:', err);
    }
  }, [loadFile, loadSchema, clearAllSelections]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.duckdb,.db';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFile(file);
      }
    };
    input.click();
  }, [handleFile]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      className={`
        h-full flex flex-col items-center justify-center
        border-2 border-dashed rounded-lg cursor-pointer
        transition-colors
        ${isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }
        ${isLoading ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      {isLoading ? (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading database...</p>
        </div>
      ) : error ? (
        <div className="text-center text-red-600">
          <p className="font-medium">Error loading file</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-gray-500 text-sm mt-4">Click or drop to try again</p>
        </div>
      ) : (
        <div className="text-center">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-gray-600 font-medium">
            Drop a DuckDB file here
          </p>
          <p className="text-gray-400 text-sm mt-1">
            or click to browse
          </p>
          <p className="text-gray-400 text-xs mt-4">
            Supports .duckdb and .db files
          </p>
        </div>
      )}
    </div>
  );
}
