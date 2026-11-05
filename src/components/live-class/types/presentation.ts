export interface SlideAnnotationStroke {
  id: string;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>; // Normalized percentage coordinates (0-100)
}

export interface SlideAnnotation {
  strokes: SlideAnnotationStroke[];
}

export interface Slide {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  diagramTitle?: string;
  codeSnippet?: string;
  presenterNotes?: string;
  annotations?: SlideAnnotation;
  createdAt: number;
  updatedAt: number;
}

export interface PresentationDeck {
  id: string;
  title: string;
  author: string;
  courseCode: string;
  slides: Slide[];
  activeSlideId: string;
  version: number;
  updatedAt: number;
}

export type PresentationMode = 'edit' | 'present';

export type AnnotationTool = 'none' | 'laser' | 'pen' | 'eraser';

export interface PresentationSyncMessage {
  type: 'LASER_MOVE' | 'LASER_TOGGLE' | 'SLIDE_CHANGE';
  sessionId: string;
  slideIndex: number;
  laserActive: boolean;
  laserPos?: { x: number; y: number };
  timestamp: number;
}
