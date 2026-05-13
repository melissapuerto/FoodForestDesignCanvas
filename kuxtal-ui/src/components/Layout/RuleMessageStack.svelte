<script lang="ts">
  import { ruleMessages, dismissCurrentRuleMessage, clearRuleMessages } from '../../lib/stores/ruleMessages';
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  let current = $derived($ruleMessages[0] ?? null);
  let queued = $derived(Math.max(0, $ruleMessages.length - 1));

  $effect(() => {
    if (current) {
      const t = setTimeout(() => {
        dismissCurrentRuleMessage();
      }, 8000);
      return () => clearTimeout(t);
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
          cuidado · incompatible
        {:else if current.tone === 'block'}
          bloqueado
        {:else if current.tone === 'help'}
          compañera
        {:else}
          aviso
        {/if}
      </span>
      <div class="rmsg-actions">
        {#if queued > 0}
          <span class="rmsg-count">+{queued}</span>
          <button type="button" class="rmsg-btn" onclick={dismissCurrentRuleMessage} aria-label="Siguiente aviso">
            <Glyph name="ArrowRight" size={12} /> Siguiente
          </button>
        {/if}
        <button type="button" class="rmsg-x" onclick={() => clearRuleMessages()} aria-label="Cerrar todos">
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
    top: 70px;
    left: 14px;
    z-index: 11;
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
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--tone, var(--ocre));
  }
  .rmsg-actions { display: inline-flex; align-items: center; gap: 6px; }
  .rmsg-count {
    font-family: var(--mono);
    font-size: 10px;
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
    font-size: 10px;
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
  .rmsg-title { font-family: var(--serif); font-size: 17px; line-height: 1.25; color: var(--ink); margin-top: 2px; }
  .rmsg-lines {
    list-style: none;
    padding: 0;
    margin: 4px 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--serif);
    font-size: 13px;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  @media (max-width: 640px) {
    .rmsg-stack {
      top: 64px;
      left: 8px;
      right: 8px;
      width: auto;
    }
  }
</style>
