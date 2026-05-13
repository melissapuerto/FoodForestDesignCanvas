<script lang="ts">
  import { toasts, dismissToast } from '../../lib/stores/toast';
  import { ruleMessages } from '../../lib/stores/ruleMessages';
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  // Stack offset so we don't collide with the RuleMessageStack codex card
  // that occupies top-left when there are rule messages.
  let topOffset = $derived($ruleMessages.length > 0 ? 200 : 70);
</script>

<div class="toast-stack" aria-live="polite" aria-relevant="additions text" style="top: {topOffset}px;">
  {#each $toasts.slice(0, 4) as t (t.id)}
    <div
      class="toast codex-card-soft t-{t.tone}"
      role={t.ariaRole}
      aria-atomic="true"
    >
      <div class="toast-row">
        <span class="toast-label">
          {#if t.tone === 'ok'}
            guardado
          {:else if t.tone === 'warn'}
            atención
          {:else if t.tone === 'error'}
            error
          {:else}
            aviso
          {/if}
        </span>
        <button
          type="button"
          class="toast-x"
          aria-label="Cerrar aviso"
          onclick={() => dismissToast(t.id)}
        >
          <Glyph name="Close" size={10} />
        </button>
      </div>
      <div class="toast-msg">{t.message}</div>
      {#if t.action}
        <button
          type="button"
          class="toast-act"
          onclick={() => {
            t.action!.onAction();
            dismissToast(t.id);
          }}
        >
          <Glyph name="Reset" size={10} />
          {t.action.label}
        </button>
      {/if}
    </div>
  {/each}
  {#if $toasts.length > 4}
    <div class="toast-more coord">+{$toasts.length - 4} avisos más</div>
  {/if}
</div>

<style>
  .toast-stack {
    position: fixed;
    left: 14px;
    width: min(360px, calc(100vw - 28px));
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 60; /* below drawers (70) and above map */
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
    font-size: 9px;
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
  .toast-x:hover, .toast-x:focus-visible { color: var(--ink); background: var(--paper-warm); outline: none; }

  .toast-msg { font-family: var(--serif); font-size: 14px; line-height: 1.4; color: var(--ink); margin-top: 2px; }
  .toast-act {
    align-self: flex-start;
    margin-top: 6px;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--ink);
    padding: 4px 9px;
    border-radius: 4px;
    font-family: var(--mono);
    font-size: 10px;
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
    font-size: 10px;
    pointer-events: none;
  }

  @media (max-width: 640px) {
    .toast-stack { left: 8px; right: 8px; width: auto; }
  }
</style>
