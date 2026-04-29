export interface NodeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
}

export interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
}

export interface SchemaNode {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: NodeStyle;
}

export interface SchemaEdge {
  id: string;
  source: string;
  target: string;
  type: 'linear' | 'curve';
  label?: string;
  style: EdgeStyle;
}

export interface Schema {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  metadata: SchemaMetadata;
}

export interface SchemaMetadata {
  aiProvider: string;
  model: string;
}

export const DEFAULT_NODE_STYLE: NodeStyle = {
  fill: '#ffffff',
  stroke: '#333333',
  strokeWidth: 2,
  fontSize: 14,
  fontFamily: 'Inter, sans-serif',
  fontColor: '#333333',
};

export const DEFAULT_EDGE_STYLE: EdgeStyle = {
  stroke: '#333333',
  strokeWidth: 2,
};
