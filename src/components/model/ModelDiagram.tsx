import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TableNode, type TableNodeData } from './TableNode';
import type { TableSchema, Relationship } from '../../types';

interface ModelDiagramProps {
  tables: TableSchema[];
  relationships: Relationship[];
}

const nodeTypes = {
  tableNode: TableNode,
} as const;

// Simple grid layout algorithm
function calculateLayout(tables: TableSchema[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const cols = Math.ceil(Math.sqrt(tables.length));
  const nodeWidth = 280;
  const nodeHeight = 250;
  const gapX = 100;
  const gapY = 80;

  tables.forEach((table, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions.set(table.name, {
      x: col * (nodeWidth + gapX) + 50,
      y: row * (nodeHeight + gapY) + 50,
    });
  });

  return positions;
}

export function ModelDiagram({ tables, relationships }: ModelDiagramProps) {
  // Build a set of relationship columns per table
  const relationshipColumnsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();

    for (const rel of relationships) {
      if (!map.has(rel.fromTable)) {
        map.set(rel.fromTable, new Set());
      }
      map.get(rel.fromTable)!.add(rel.fromColumn);

      if (!map.has(rel.toTable)) {
        map.set(rel.toTable, new Set());
      }
      map.get(rel.toTable)!.add(rel.toColumn);
    }

    return map;
  }, [relationships]);

  // Convert tables to React Flow nodes
  const initialNodes = useMemo(() => {
    const positions = calculateLayout(tables);

    return tables.map((table): Node => {
      const pos = positions.get(table.name) || { x: 0, y: 0 };
      const nodeData: TableNodeData = {
        tableName: table.name,
        columns: table.columns,
        relationshipColumns: relationshipColumnsMap.get(table.name) || new Set(),
        rowCount: table.rowCount,
      };

      return {
        id: table.name,
        type: 'tableNode',
        position: pos,
        data: nodeData as unknown as Record<string, unknown>,
      };
    });
  }, [tables, relationshipColumnsMap]);

  // Convert relationships to React Flow edges
  const initialEdges = useMemo<Edge[]>(() => {
    return relationships.map((rel) => {
      const isHighConfidence = rel.confidence === 'high';
      const isMediumConfidence = rel.confidence === 'medium';

      return {
        id: rel.id,
        source: rel.fromTable,
        target: rel.toTable,
        label: `${rel.fromColumn} → ${rel.toColumn}`,
        labelStyle: { fontSize: 10, fill: '#666' },
        labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        labelBgPadding: [4, 2] as [number, number],
        style: {
          stroke: isHighConfidence ? '#3b82f6' : isMediumConfidence ? '#f59e0b' : '#9ca3af',
          strokeWidth: isHighConfidence ? 2 : 1,
          strokeDasharray: isHighConfidence ? undefined : '5 5',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isHighConfidence ? '#3b82f6' : isMediumConfidence ? '#f59e0b' : '#9ca3af',
        },
        animated: !isHighConfidence,
      };
    });
  }, [relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when tables change
  useMemo(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Sync edges when relationships change
  useMemo(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls />
        <MiniMap
          nodeColor="#3b82f6"
          maskColor="rgba(0, 0, 0, 0.1)"
          className="!bg-gray-100"
        />
      </ReactFlow>
    </div>
  );
}
