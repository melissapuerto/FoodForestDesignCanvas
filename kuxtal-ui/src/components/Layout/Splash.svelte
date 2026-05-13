<script lang="ts">
  import { onMount } from 'svelte';

  let { onEnter }: { onEnter: () => void } = $props();

  let phase = $state(0);

  onMount(() => {
    const t1 = setTimeout(() => (phase = 1), 600);
    const t2 = setTimeout(() => (phase = 2), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  });

  function onKey(e: KeyboardEvent): void {
    if (phase >= 2 && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onEnter();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="splash" role="dialog" aria-labelledby="splash-title">
  <div class="splash-greca" aria-hidden="true"></div>

  <svg class="splash-glyph" class:in={phase >= 0} viewBox="0 0 200 200" width="180" height="180" aria-hidden="true">
    <circle cx="100" cy="100" r="80" fill="none" stroke="var(--ocre)" stroke-width="1.5" />
    <circle cx="100" cy="100" r="62" fill="none" stroke="var(--maiz)" stroke-width="0.8" />
    <path d="M100 40 V 160 M40 100 H 160" stroke="var(--maiz)" stroke-width="0.6" stroke-opacity="0.5" />
    <ellipse cx="100" cy="105" rx="14" ry="22" fill="var(--ocre)" />
    <path d="M100 90 C 100 80 110 75 120 80" stroke="var(--maiz)" stroke-width="2" fill="none" stroke-linecap="round" />
    <path d="M100 100 L 95 100 M100 110 L 95 110 M100 120 L 95 120" stroke="oklch(0.18 0.04 60)" stroke-width="1" />
  </svg>

  <div class="splash-version" class:in={phase >= 1}>códice viviente · v0.5</div>
  <h1 id="splash-title" class="splash-title" class:in={phase >= 1}>Kuxtal</h1>
  <p class="splash-tag" class:in={phase >= 1}>tu finca · tu memoria · tu tierra</p>

  <button
    class="splash-enter"
    class:in={phase >= 2}
    disabled={phase < 2}
    onclick={onEnter}
  >
    Abrir el códice ↦
  </button>

  <div class="splash-weave" aria-hidden="true"></div>
</div>

<style>
  .splash {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: radial-gradient(ellipse at 50% 50%, oklch(0.30 0.05 60), oklch(0.18 0.04 60));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--papel);
    overflow: hidden;
    padding: 20px;
  }
  .splash-greca {
    position: absolute;
    inset: 0;
    opacity: 0.05;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56' width='56' height='56'><path d='M0 28 L8 28 L8 12 L24 12 L24 44 L40 44 L40 12 L56 12' fill='none' stroke='white' stroke-width='1.5'/></svg>");
  }
  .splash-glyph { animation: inkBloom 1s var(--ease-codex) both; }
  .splash-version { font-family: var(--mono); font-size: 11px; letter-spacing: 0.18em; color: var(--maiz); margin-top: 22px; opacity: 0; transition: opacity 0.6s var(--ease-codex); text-transform: uppercase; }
  .splash-title { font-family: var(--serif); font-size: clamp(64px, 12vw, 96px); margin-top: 6px; opacity: 0; transform: translateY(20px); transition: all 0.8s var(--ease-codex); }
  .splash-tag { font-family: var(--serif); font-size: clamp(16px, 2.6vw, 22px); font-style: italic; color: var(--maiz); opacity: 0; margin-top: 4px; transition: opacity 0.8s var(--ease-codex) 0.2s; }
  .splash-version.in, .splash-tag.in { opacity: 0.85; }
  .splash-title.in { opacity: 1; transform: translateY(0); }

  .splash-enter {
    margin-top: 48px;
    padding: 14px 28px;
    background: var(--ocre);
    border: 1px solid var(--maiz);
    color: var(--papel);
    border-radius: 4px;
    cursor: pointer;
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.5s var(--ease-codex);
  }
  .splash-enter.in { opacity: 1; transform: translateY(0); }
  .splash-enter:hover:enabled { background: var(--ocre-deep); }
  .splash-enter:disabled { cursor: default; }

  .splash-weave {
    position: absolute;
    bottom: 24px;
    width: 60%;
    max-width: 500px;
    height: 8px;
    background: linear-gradient(90deg, transparent 0, transparent 8px, var(--ocre) 8px, var(--ocre) 16px, transparent 16px, transparent 24px, var(--maiz) 24px, var(--maiz) 32px, transparent 32px);
    background-size: 32px 8px;
    opacity: 0.45;
  }
</style>
