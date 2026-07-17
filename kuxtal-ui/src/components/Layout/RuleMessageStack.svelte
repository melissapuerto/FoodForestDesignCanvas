<script lang="ts">
  import { ruleMessages, dismissCurrentRuleMessage, clearRuleMessages } from '../../lib/stores/ruleMessages';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { t } from '../../lib/i18n/index.svelte';

  let current = $derived($ruleMessages[0] ?? null);
  let queued = $derived(Math.max(0, $ruleMessages.length - 1));

  $effect(() => {
    if (current) {
      const tid = setTimeout(() => {
        dismissCurrentRuleMessage();
      }, 8000);
      return () => clearTimeout(tid);
    }
  });
</script>

{#if current}
  <aside
    class="rmsg-stack codex-card"
    role="status"
    aria-live="polite"
    style="--tone: {current.tone === 'warn' || current.tone === 'block' ? 'var(--cinabrio)' : current.tone === 'help' ? 'var(--jade-deep)' : 'var(--ocre-deep)'};"
  >
    <header class="rmsg-head">
      <span class="rmsg-label">
        {#if current.tone === 'warn'}
          {t('rule_incompatible')}
        {:else if current.tone === 'block'}
          {t('rule_blocked')}
        {:else if current.tone === 'help'}
          {t('rule_companion')}
        {:else}
          {t('rule_notice')}
        {/if}
      </span>
      <div class="rmsg-actions">
        {#if queued > 0}
          <span class="rmsg-count">+{queued}</span>
          <button type="button" class="rmsg-btn" onclick={dismissCurrentRuleMessage} aria-label={t('rule_next_aria')}>
            <Glyph name="ArrowRight" size={12} />
          </button>
        {/if}
        <button type="button" class="rmsg-x" onclick={() => clearRuleMessages()} aria-label={t('rule_close_all_aria')}>
          <Glyph name="Close" size={12} />
        </button>
      </div>
    </header>

    <div class="rmsg-title">{current.title}</div>
    {#if current.lines.length}
      <ul class="rmsg-lines">
        {#each current.lines as line}
          <li>{line}</li>
        {/each}
      </ul>
    {/if}
  </aside>
{/if}

<style>
  .rmsg-stack {
    position: absolute;
    top: calc(var(--topbar-h, 64px) + 12px);
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-canvas-rail);
    width: min(360px, calc(100vw - 28px));
    padding: 10px 12px;
    border-left: 4px solid var(--tone, var(--ocre));
    animation: floatUp 0.22s var(--ease-codex) both;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .rmsg-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .rmsg-label {
    font-family: var(--mono);
    font-size: calc(9px * var(--text-scale));
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--tone, var(--ocre));
  }
  .rmsg-actions { display: inline-flex; align-items: center; gap: 6px; }
  .rmsg-count {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    color: var(--ink-soft);
    background: var(--paper-warm);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 1px 7px;
  }
  .rmsg-btn {
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--ink);
    padding: 4px 8px;
    border-radius: 4px;
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .rmsg-btn:hover { background: var(--paper-warm); }
  .rmsg-x {
    background: transparent;
    border: none;
    color: var(--ink-soft);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .rmsg-x:hover { color: var(--ink); background: var(--paper-warm); }
  .rmsg-title { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(17px * var(--text-scale)); line-height: 1.25; color: var(--ink); margin-top: 2px; }
  .rmsg-lines {
    list-style: none;
    padding: 0;
    margin: 4px 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--serif); font-weight: var(--display-weight);
    font-size: calc(13px * var(--text-scale));
    line-height: 1.45;
    color: var(--ink-soft);
  }

  @media (max-width: 760px) {
    .rmsg-stack {
      top: calc(var(--topbar-h, 64px) + 12px);
      left: calc(8px + var(--safe-left));
      right: calc(8px + var(--safe-right));
      transform: none;
      width: auto;
    }
  }
</style>
