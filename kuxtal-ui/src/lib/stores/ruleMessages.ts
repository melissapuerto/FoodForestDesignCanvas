// A small queue of rule-context messages. Only one is shown at a time on the canvas
// (under the identity card), with a counter and "Siguiente" button when others are queued.

import { writable, get } from 'svelte/store';
import { newId } from '../utils/id';

export type RuleMsgTone = 'help' | 'warn' | 'info' | 'block';

export type RuleMsg = {
  id: string;
  tone: RuleMsgTone;
  title: string;
  lines: string[];
  speciesName?: string;
};

export const ruleMessages = writable<RuleMsg[]>([]);

export function pushRuleMessage(input: Omit<RuleMsg, 'id'>): string {
  const msg: RuleMsg = { ...input, id: newId('rmsg') };
  // Latest replaces same-species duplicate; otherwise append.
  ruleMessages.update((list) => {
    const existingIdx = msg.speciesName
      ? list.findIndex((m) => m.speciesName === msg.speciesName)
      : -1;
    if (existingIdx >= 0) {
      const next = [...list];
      next[existingIdx] = msg;
      return next;
    }
    return [msg, ...list].slice(0, 10);
  });
  return msg.id;
}

export function dismissRuleMessage(id: string): void {
  ruleMessages.update((list) => list.filter((m) => m.id !== id));
}

export function dismissCurrentRuleMessage(): void {
  ruleMessages.update((list) => list.slice(1));
}

export function clearRuleMessages(): void {
  ruleMessages.set([]);
}

export function ruleMessageCount(): number {
  return get(ruleMessages).length;
}
