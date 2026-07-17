<script lang="ts">
  import { activeDialog, closeDialog } from '../../lib/stores/dialog';
  import { onMount } from 'svelte';
  import { t } from '../../lib/i18n/index.svelte';

  let inputEl: HTMLInputElement | null = $state(null);
  let textareaEl: HTMLTextAreaElement | null = $state(null);
  let confirmBtn: HTMLButtonElement | null = $state(null);
  let inputValue = $state('');
  let lastFocus: HTMLElement | null = null;
  let dlgEl: HTMLElement | null = $state(null);

  function focusableEls(): HTMLElement[] {
    if (!dlgEl) return [];
    const sel =
      'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(dlgEl.querySelectorAll<HTMLElement>(sel)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
    );
  }

  $effect(() => {
    const dlg = $activeDialog;
    if (dlg) {
      inputValue = dlg.defaultValue ?? '';
      lastFocus = (document.activeElement as HTMLElement | null) ?? null;
      queueMicrotask(() => {
        if (dlg.kind === 'prompt') inputEl?.focus();
        else if (dlg.kind === 'textarea') textareaEl?.focus();
        else confirmBtn?.focus();
      });
    } else if (lastFocus && document.body.contains(lastFocus)) {
      lastFocus.focus();
    }
  });

  function onKey(e: KeyboardEvent): void {
    const dlg = $activeDialog;
    if (!dlg) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog(dlg.kind === 'confirm' ? false : null);
    }
    if (e.key === 'Enter' && dlg.kind !== 'textarea') {
      const allow = dlg.allowEmpty ?? true;
      const value = dlg.kind === 'prompt' ? inputValue : true;
      if (dlg.kind === 'prompt' && !allow && !inputValue.trim()) return;
      e.preventDefault();
      closeDialog(value);
    }
    if (e.key === 'Tab') {
      // Trap focus inside the modal dialog.
      const els = focusableEls();
      if (els.length === 0) {
        e.preventDefault();
        dlgEl?.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !dlgEl?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function confirm(): void {
    const dlg = $activeDialog;
    if (!dlg) return;
    if (dlg.kind === 'prompt' || dlg.kind === 'textarea') {
      const allow = dlg.allowEmpty ?? true;
      if (!allow && !inputValue.trim()) {
        (dlg.kind === 'prompt' ? inputEl : textareaEl)?.focus();
        return;
      }
      closeDialog(inputValue);
    } else {
      closeDialog(true);
    }
  }

  function cancel(): void {
    closeDialog($activeDialog?.kind === 'confirm' ? false : null);
  }

  onMount(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

{#if $activeDialog}
  {@const dlg = $activeDialog}
  <div
    class="dlg-overlay"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) cancel();
    }}
  >
    <div
      bind:this={dlgEl}
      class="dlg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlgTitle"
      aria-describedby={dlg.body ? 'dlgBody' : undefined}
      tabindex="-1"
    >
      <h2 id="dlgTitle">{dlg.title}</h2>
      {#if dlg.body}
        <p id="dlgBody" class="dlg-body">{dlg.body}</p>
      {/if}
      {#if dlg.kind === 'prompt'}
        <input
          bind:this={inputEl}
          bind:value={inputValue}
          class="inp"
          type="text"
          placeholder={dlg.placeholder ?? ''}
          aria-label={dlg.title}
        />
      {:else if dlg.kind === 'textarea'}
        <textarea
          bind:this={textareaEl}
          bind:value={inputValue}
          class="inp"
          rows="4"
          placeholder={dlg.placeholder ?? ''}
          aria-label={dlg.title}
        ></textarea>
      {/if}
      {#if dlg.hint}
        <div class="dlg-hint">{dlg.hint}</div>
      {/if}
      <div class="dlg-actions">
        {#if dlg.cancelLabel !== ''}
          <button type="button" class="btn bo" onclick={cancel}>
            {dlg.cancelLabel ?? t('dialog_cancel')}
          </button>
        {/if}
        <button
          type="button"
          class="btn"
          class:bd={dlg.danger}
          bind:this={confirmBtn}
          onclick={confirm}
        >
          {dlg.confirmLabel ?? (dlg.kind === 'alert' ? t('dialog_understood') : t('dialog_confirm'))}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dlg-overlay {
    position: fixed;
    inset: 0;
    background: rgba(44, 36, 21, 0.55);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: var(--z-dialog);
    padding: max(12px, var(--safe-top)) max(12px, var(--safe-right)) max(12px, var(--safe-bottom)) max(12px, var(--safe-left));
  }
  .dlg {
    background: var(--paper, #FAF8F2);
    border-radius: 12px 12px 0 0;
    padding: 20px;
    width: 100%;
    max-width: 420px;
    max-height: 85dvh;
    overflow-y: auto;
    box-shadow: 0 -4px 12px oklch(0.2 0.04 60 / 0.15);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .dlg h2 { color: var(--ink, #3B2F1E); font-size: 1.15rem; font-family: var(--serif); font-weight: var(--display-weight); }
  .dlg-body { font-size: 0.95rem; color: var(--ink-soft, #6B5340); line-height: 1.5; font-family: var(--serif); font-weight: var(--display-weight); }
  .dlg-hint { font-size: 0.8rem; color: var(--ink-soft); }
  .dlg-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
  .bo { background: var(--paper-warm); border: 1px solid var(--line-strong); color: var(--ink); }
  .bd { background: var(--cinabrio); color: var(--paper); border: none; }
  @media (min-width: 640px) {
    .dlg-overlay { align-items: center; }
    .dlg { border-radius: 12px; box-shadow: 0 4px 12px oklch(0.2 0.04 60 / 0.15); }
  }
</style>
