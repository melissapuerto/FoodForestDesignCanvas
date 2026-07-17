/**
 * Svelte action that makes a hand-rolled modal actually usable without sight:
 * on mount it moves focus to the first focusable control inside (a dialog with
 * aria-modal that never receives focus strands a screen-reader user on the
 * hidden page behind it), traps Tab within the dialog, closes on Escape, and
 * restores focus to whatever opened it when it unmounts.
 *
 * Usage: <div role="dialog" aria-modal="true" use:modalA11y={{ onClose }}>
 */
export function modalA11y(node: HTMLElement, params: { onClose: () => void }) {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  function focusables(): HTMLElement[] {
    const sel = 'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(node.querySelectorAll<HTMLElement>(sel)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
    );
  }

  // Focus the first form field so the screen reader enters the dialog ready to
  // act (falling back to the first control — usually Close — then the node).
  queueMicrotask(() => {
    const els = focusables();
    const firstField = els.find((el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    (firstField ?? els[0] ?? node).focus();
  });

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      params.onClose();
      return;
    }
    if (e.key === 'Tab') {
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  node.addEventListener('keydown', onKeydown);

  return {
    destroy() {
      node.removeEventListener('keydown', onKeydown);
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    }
  };
}
