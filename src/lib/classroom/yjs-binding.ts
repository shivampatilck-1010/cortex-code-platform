'use client';

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

let MonacoBindingModule: any = null;

export async function getMonacoBindingClass() {
  if (typeof window === 'undefined') return null;
  if (!MonacoBindingModule) {
    try {
      const mod = await import('y-monaco');
      MonacoBindingModule = mod.MonacoBinding;
    } catch (err) {
      console.error('[YjsBinding] Failed to import y-monaco', err);
    }
  }
  return MonacoBindingModule;
}

export interface ActiveBinding {
  doc: Y.Doc;
  ytext: Y.Text;
  awareness: Awareness;
  monacoBinding: any;
  destroy: () => void;
}

/**
 * Injects dynamic CSS for remote collaborator cursor nametags and selection highlights
 */
function ensureCursorStyles() {
  if (typeof document === 'undefined') return;
  const styleId = 'cortex-collab-cursor-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = `
    .yRemoteSelection {
      background-color: rgba(255, 145, 0, 0.25);
      border-radius: 2px;
    }
    .yRemoteSelectionHead {
      position: absolute;
      border-left: 2px solid #ff9100;
      border-top: 2px solid #ff9100;
      border-bottom: 2px solid #ff9100;
      height: 100%;
      box-sizing: border-box;
    }
    .yRemoteSelectionHead::after {
      position: absolute;
      content: ' ';
      border: 3px solid #ff9100;
      border-radius: 4px;
      left: -4px;
      top: -5px;
    }
    .yRemoteSelectionHead:hover::before {
      content: attr(data-name);
      position: absolute;
      top: -18px;
      left: -2px;
      font-size: 10px;
      font-family: sans-serif;
      font-weight: 600;
      background-color: #ff9100;
      color: #000;
      padding: 1px 4px;
      border-radius: 3px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 100;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Binds a Monaco editor instance to a Yjs Text type with Awareness
 */
export async function bindMonacoToYDoc(
  editor: any,
  ydoc: Y.Doc,
  ytext: Y.Text,
  awareness: Awareness,
  canEdit: boolean = true
): Promise<ActiveBinding | null> {
  if (typeof window === 'undefined' || !editor) return null;

  ensureCursorStyles();
  const BindingClass = await getMonacoBindingClass();
  if (!BindingClass) return null;

  const model = editor.getModel();
  if (!model) return null;

  // If the Yjs text is empty but the model has initial code, seed Yjs text
  if (ytext.length === 0) {
    const initial = model.getValue();
    if (initial) {
      ydoc.transact(() => {
        ytext.insert(0, initial);
      }, 'init');
    }
  } else {
    const currentModelVal = model.getValue();
    const yStr = ytext.toString();
    if (currentModelVal !== yStr) {
      model.setValue(yStr);
    }
  }

  const monacoBinding = new BindingClass(
    ytext,
    model,
    new Set([editor]),
    awareness
  );

  return {
    doc: ydoc,
    ytext,
    awareness,
    monacoBinding,
    destroy: () => {
      try {
        monacoBinding.destroy();
      } catch (e) {
        console.error('[YjsBinding] Error destroying MonacoBinding', e);
      }
    },
  };
}
