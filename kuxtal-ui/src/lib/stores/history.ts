import { writable } from 'svelte/store';

/**
 * Canvas undo/redo stack (DC-06). Each canvas mutation pushes a Command with
 * `undo`/`redo` closures built from the existing appState primitives
 * (insert/delete/restore). Pure and framework-agnostic so it can be unit-tested.
 */
export type Command = {
  label: string;
  undo: () => void;
  redo: () => void;
};

const MAX_HISTORY = 100;
let undoStack: Command[] = [];
let redoStack: Command[] = [];

export const canUndo = writable(false);
export const canRedo = writable(false);

function sync(): void {
  canUndo.set(undoStack.length > 0);
  canRedo.set(redoStack.length > 0);
}

/** Record a freshly-performed action. Clears the redo stack (new branch). */
export function pushCommand(cmd: Command): void {
  undoStack.push(cmd);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  sync();
}

export function undo(): void {
  const cmd = undoStack.pop();
  if (!cmd) return;
  cmd.undo();
  redoStack.push(cmd);
  sync();
}

export function redo(): void {
  const cmd = redoStack.pop();
  if (!cmd) return;
  cmd.redo();
  undoStack.push(cmd);
  sync();
}

export function clearHistory(): void {
  undoStack = [];
  redoStack = [];
  sync();
}

/** Labels of the next undo/redo actions (for tooltips/aria), or null. */
export function historyLabels(): { undo: string | null; redo: string | null } {
  return {
    undo: undoStack.length ? undoStack[undoStack.length - 1].label : null,
    redo: redoStack.length ? redoStack[redoStack.length - 1].label : null
  };
}
