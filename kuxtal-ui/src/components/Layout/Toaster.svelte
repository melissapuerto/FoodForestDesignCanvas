<script lang="ts">
  import { toasts, dismissToast } from '../../lib/stores/toast';
  import { ruleMessages } from '../../lib/stores/ruleMessages';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { t } from '../../lib/i18n/index.svelte';

  // Offset below the live top-bar height (--topbar-h, published by CodexTopBar)
  // plus extra room when the RuleMessageStack card is occupying the top-centre.
  let belowRules = $derived($ruleMessages.length > 0 ? 132 : 12);
</script>

<div
  class="toast-stack"
  aria-live="polite"
  aria-relevant="additions text"
  style="top: calc(var(--topbar-h, 64px) + {belowRules}px);"
>
  {#each $toasts.slice(0, 4) as toast (toast.id)}
    <div
      class="toast codex-card-soft t-{toast.tone}"
      role={toast.ariaRole}
      aria-atomic="true"
    >
      <div class="toast-row">
        <span class="toast-label">
          {#if toast.tone === 'ok'}
            {t('toast_ok')}
          {:else if toast.tone === 'warn'}
            {t('toast_warn')}
          {:else if toast.tone === 'error'}
            {t('toast_error')}
          {:else}
            {t('toast_info')}
          {/if}
        </span>
        <button
          type="button"
          class="toast-x"
          aria-label={t('toast_close_aria')}
          onclick={() => dismissToast(toast.id)}
        >
          <Glyph name="Close" size={10} />
        </button>
      </div>
      <div class="toast-msg">{toast.message}</div>
      {#if toast.action}
        <button
          type="button"
          class="toast-act"
          onclick={() => {
            toast.action!.onAction();
            dismissToast(toast.id);
          }}
        >
          <Glyph name="Reset" size={10} />
          {toast.action.label}
        </button>
      {/if}
    </div>
  {/each}
  {#if $toasts.length > 4}
    <div class="toast-more coord">{t('toast_more', { n: String($toasts.length - 4) })}</div>
  {/if}
</div>

<style>
  .toast-stack {
    position: fixed;
    left: calc(14px + var(--safe-left));
    width: min(360px, calc(100vw - 28px - var(--safe-left) - var(--safe-right)));
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: var(--z-toast);
    pointer-events: none;
    transition: top 0.3s var(--ease-codex);
  }
  .toast {
    pointer-events: auto;
    padding: 8px 10px 10px;
    border-left: 3px solid var(--ocre);
    animation: floatUp 0.22s var(--ease-codex) both;
    background: var(--paper);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .toast.t-ok { border-left-color: var(--jade-deep); }
  .toast.t-warn { border-left-color: var(--cinabrio); }
  .toast.t-error { border-left-color: var(--cinabrio); background: oklch(0.97 0.04 28); }
  .toast.t-info { border-left-color: var(--ocre); }

  .toast-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .toast-label {
    font-family: var(--mono);
    font-size: calc(9px * var(--text-scale));
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .toast.t-ok .toast-label { color: var(--jade-deep); }
  .toast.t-warn .toast-label, .toast.t-error .toast-label { color: var(--cinabrio); }
  .toast-x {
    background: transparent;
    border: none;
    color: var(--ink-soft);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    line-height: 0;
  }
  .toast-x:hover, .toast-x:focus-visible { color: var(--ink); background: var(--paper-warm); }

  .toast-msg { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); line-height: 1.4; color: var(--ink); margin-top: 2px; }
  .toast-act {
    align-self: flex-start;
    margin-top: 6px;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--ink);
    padding: 4px 9px;
    border-radius: 4px;
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .toast-act:hover { background: var(--paper-warm); }
  .toast-more {
    align-self: flex-start;
    background: var(--paper);
    border: 1px dashed var(--line);
    border-radius: 999px;
    padding: 2px 10px;
    font-size: calc(10px * var(--text-scale));
    pointer-events: none;
  }

  @media (max-width: 760px) {
    .toast-stack {
      left: calc(8px + var(--safe-left));
      right: calc(8px + var(--safe-right));
      width: auto;
    }
  }
</style>
