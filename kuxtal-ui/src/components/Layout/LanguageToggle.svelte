<script lang="ts">
  import { getLocale, setLocale, t } from '../../lib/i18n/index.svelte';
</script>

<div class="lang-toggle" role="group" aria-label={t('lang_switch_to' as any)}>
  <button
    type="button"
    class="lang-opt {getLocale() === 'es' ? 'on' : ''}"
    onclick={() => setLocale('es')}
    aria-pressed={getLocale() === 'es'}
  >
    ESPAÑOL
  </button>
  <button
    type="button"
    class="lang-opt {getLocale() === 'en' ? 'on' : ''}"
    onclick={() => setLocale('en')}
    aria-pressed={getLocale() === 'en'}
  >
    ENGLISH
  </button>
</div>

<style>
  .lang-toggle {
    display: inline-flex;
    background: var(--paper-warm);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 3px;
  }
  .lang-opt {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.16em;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--ink-soft);
    cursor: pointer;
    transition: all 0.2s var(--ease-codex);
  }
  .lang-opt:hover:not(.on) {
    color: var(--ink);
    background: oklch(0.9 0 0 / 0.5);
  }
  .lang-opt.on {
    background: var(--ocre);
    color: var(--paper);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
</style>
