import { writable } from 'svelte/store';

export type DialogKind = 'confirm' | 'alert' | 'prompt' | 'textarea';

export type DialogRequest = {
  kind: DialogKind;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  danger?: boolean;
  allowEmpty?: boolean;
};

type DialogInternal = DialogRequest & {
  resolve: (value: string | boolean | null) => void;
};

export const activeDialog = writable<DialogInternal | null>(null);

export function dialogConfirm(req: Omit<DialogRequest, 'kind'>): Promise<boolean> {
  return new Promise((resolve) => {
    activeDialog.set({
      ...req,
      kind: 'confirm',
      resolve: (value) => resolve(value === true)
    });
  });
}

export function dialogAlert(req: Omit<DialogRequest, 'kind'>): Promise<void> {
  return new Promise((resolve) => {
    activeDialog.set({
      ...req,
      kind: 'alert',
      cancelLabel: '',
      resolve: () => resolve()
    });
  });
}

export function dialogPrompt(req: Omit<DialogRequest, 'kind'>): Promise<string | null> {
  return new Promise((resolve) => {
    activeDialog.set({
      ...req,
      kind: 'prompt',
      resolve: (value) => resolve(typeof value === 'string' ? value : null)
    });
  });
}

export function dialogTextarea(req: Omit<DialogRequest, 'kind'>): Promise<string | null> {
  return new Promise((resolve) => {
    activeDialog.set({
      ...req,
      kind: 'textarea',
      resolve: (value) => resolve(typeof value === 'string' ? value : null)
    });
  });
}

export function closeDialog(value: string | boolean | null): void {
  activeDialog.update((dlg) => {
    if (dlg) dlg.resolve(value);
    return null;
  });
}
