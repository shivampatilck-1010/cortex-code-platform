export type WhiteboardTool =
  | 'select'
  | 'lasso'
  | 'pan'
  | 'pen'
  | 'pencil'
  | 'highlighter'
  | 'eraser'
  | 'object-eraser'
  | 'rectangle'
  | 'rounded-rect'
  | 'ellipse'
  | 'triangle'
  | 'line'
  | 'arrow'
  | 'double-arrow'
  | 'elbow-connector'
  | 'flow-process'
  | 'flow-decision'
  | 'flow-terminal'
  | 'flow-io'
  | 'flow-document'
  | 'text'
  | 'sticky-note'
  | 'equation'
  | 'laser'
  | 'spotlight';

export type BackgroundType =
  | 'plain-white'
  | 'light-grid'
  | 'dark-grid'
  | 'ruled'
  | 'dotted'
  | 'graph';

export interface Point {
  x: number;
  y: number;
}

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WhiteboardElement {
  id: string;
  type: WhiteboardTool;
  color: string;
  fillColor?: string; // Optional fill for shapes and flowchart nodes
  strokeWidth: number;
  strokeDash?: 'solid' | 'dashed';
  opacity?: number;
  points?: Point[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  textColor?: string;
  backgroundColor?: string;
  equationLatex?: string;
  locked?: boolean;
  zIndex?: number;
}

export interface WhiteboardPage {
  id: string;
  title: string;
  elements: WhiteboardElement[];
  background: BackgroundType;
  history: WhiteboardElement[][];
  redoStack: WhiteboardElement[][];
  viewport: {
    zoom: number;
    pan: Point;
  };
}

export interface WhiteboardDocument {
  schemaVersion: number;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  activePageId: string;
  pages: WhiteboardPage[];
}

export interface WhiteboardState {
  document: WhiteboardDocument;
  selectedTool: WhiteboardTool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeDash: 'solid' | 'dashed';
  selectedElementIds: string[];
  activePageId: string;
  zoom: number;
  pan: Point;
  snapToGrid: boolean;
  spotlightCenter: Point | null;
  laserPoints: Array<Point & { timestamp: number }>;
}
