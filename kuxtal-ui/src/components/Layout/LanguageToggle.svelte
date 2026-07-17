<script lang="ts">
  import { getLocale, setLocale, t } from '../../lib/i18n/index.svelte';
</script>

<button
  type="button"
  class="lang-btn"
  onclick={() => setLocale(getLocale() === 'es' ? 'en' : 'es')}
  title={t('lang_switch_to')}
  aria-label={t('lang_switch_to')}
>
  {getLocale() === 'es' ? t('lang_en') : t('lang_es')}
</button>

<style>
  .lang-btn {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.16em;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--ink-soft);
    cursor: pointer;
    transition: all 0.15s var(--ease-codex);
  }
  .lang-btn:hover {
    background: var(--ocre);
    color: var(--paper);
    border-color: var(--ocre);
  }
</style>
