import { showToast } from './toast';

export type UndoAction = {
  description: string;
  perform: () => void;
};

export function offerUndo(action: UndoAction, undoLabel: string = 'Deshacer'): void {
  showToast({
    tone: 'info',
    message: action.description,
    durationMs: 6500,
    action: {
      label: undoLabel,
      onAction: () => action.perform()
    }
  });
}
