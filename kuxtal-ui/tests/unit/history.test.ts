import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { pushCommand, undo, redo, clearHistory, canUndo, canRedo, historyLabels } from '../../src/lib/stores/history';

function cmd(log: string[], label: string) {
  return {
    label,
    undo: () => log.push(`undo:${label}`),
    redo: () => log.push(`redo:${label}`)
  };
}

describe('history stack', () => {
  beforeEach(() => clearHistory());

  it('starts empty', () => {
    expect(get(canUndo)).toBe(false);
    expect(get(canRedo)).toBe(false);
  });

  it('undoes and redoes in LIFO order', () => {
    const log: string[] = [];
    pushCommand(cmd(log, 'A'));
    pushCommand(cmd(log, 'B'));
    expect(get(canUndo)).toBe(true);
    undo(); // undo B
    undo(); // undo A
    expect(log).toEqual(['undo:B', 'undo:A']);
    expect(get(canUndo)).toBe(false);
    expect(get(canRedo)).toBe(true);
    redo(); // redo A
    expect(log).toEqual(['undo:B', 'undo:A', 'redo:A']);
  });

  it('clears the redo stack when a new command is pushed', () => {
    const log: string[] = [];
    pushCommand(cmd(log, 'A'));
    undo();
    expect(get(canRedo)).toBe(true);
    pushCommand(cmd(log, 'B')); // new branch
    expect(get(canRedo)).toBe(false);
    expect(historyLabels().undo).toBe('B');
  });

  it('is a no-op when stacks are empty', () => {
    expect(() => { undo(); redo(); }).not.toThrow();
  });
});
