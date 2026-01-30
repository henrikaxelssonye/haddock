export interface CanvasObjectPosition {
  x: number;
  y: number;
}

export interface CanvasObjectSize {
  width: number;
  height: number;
}

export interface CanvasTableObject {
  id: string;
  tableName: string;
  position: CanvasObjectPosition;
  size: CanvasObjectSize;
  selectedColumns: string[];
  zIndex: number;
}
