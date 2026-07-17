<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../lib/i18n/index.svelte';
  import { announce } from '../../lib/stores/announce';
  import { setPref, prefs } from '../../lib/stores/prefs';
  import { get } from 'svelte/store';
  import LanguageToggle from './LanguageToggle.svelte';
  import AccessibilityControls from './AccessibilityControls.svelte';

  let { onEnter }: { onEnter: () => void } = $props();

  let phase = $state(0);
  let srOn = $state(get(prefs).screenReaderHints);
  let showA11y = $state(false);

  onMount(() => {
    const t1 = setTimeout(() => (phase = 1), 600);
    const t2 = setTimeout(() => (phase = 2), 1500);
    // Browsers can't detect a screen reader, so instead we make the very first
    // focusable control an offer to turn on screen-reader mode, and speak that
    // offer aloud, so a user who arrives with VoiceOver/TalkBack already running
    // hears how to optimize the app before doing anything else.
    const t3 = setTimeout(() => { if (!srOn) announce(t('splash_sr_intro')); }, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  });

  function enableSrMode(): void {
    setPref('screenReaderHints', true);
    srOn = true;
    announce(`${t('splash_sr_enabled')} ${t('a11y_welcome')}`);
  }

  function onKey(e: KeyboardEvent): void {
    if (phase >= 2 && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onEnter();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="splash" role="dialog" aria-labelledby="splash-title">
  <!-- Accessibility + language setup: the first focusable controls, so a user
       arriving with a screen reader can pick their language and turn on
       screen-reader mode before anything else (the offer is also spoken on load).
       The controls and the options panel stack in a flow column so the panel
       always opens *below* the buttons and never overlaps them — on a narrow
       screen the buttons wrap, and an absolutely-positioned panel would cover
       (and block taps on) the wrapped row. -->
  <div class="splash-top">
    <div class="splash-access" role="group" aria-label={t('splash_lang_label')}>
      <span class="splash-access-lbl">{t('splash_lang_label')}</span>
      <LanguageToggle />
      {#if !srOn}
        <button class="splash-sr-offer" onclick={enableSrMode}>{t('splash_sr_offer')}</button>
      {/if}
      <button
        class="splash-sr-offer"
        aria-expanded={showA11y}
        aria-controls="splash-a11y-panel"
        onclick={() => (showA11y = !showA11y)}
      >{t('splash_a11y_options')}</button>
    </div>
    {#if showA11y}
      <!-- Full accessibility controls, available before onboarding so the app
           renders correctly (large text, high contrast, etc.) from the start. -->
      <div id="splash-a11y-panel" class="splash-a11y-panel">
        <AccessibilityControls />
      </div>
    {/if}
  </div>
  <div class="splash-greca" aria-hidden="true"></div>

  <img class="splash-glyph" class:in={phase >= 0} src="/icons/favicon.svg" alt="" width="180" height="180" aria-hidden="true" />

  <div class="splash-version" class:in={phase >= 1}>{t('splash_version')}</div>
  <h1 id="splash-title" class="splash-title" class:in={phase >= 1}>Kuxtal</h1>
  <p class="splash-tag" class:in={phase >= 1}>{t('splash_tagline')}</p>

  <button
    class="splash-enter"
    class:in={phase >= 2}
    disabled={phase < 2}
    onclick={onEnter}
  >
    {t('splash_open')}
  </button>

  <div class="splash-weave" aria-hidden="true"></div>
</div>

<style>
  .splash {
    position: fixed;
    inset: 0;
    z-index: var(--z-splash);
    background: radial-gradient(ellipse at 50% 50%, oklch(0.30 0.05 60), oklch(0.18 0.04 60));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--papel);
    overflow: hidden;
    padding: 20px;
  }
  .splash-top {
    position: absolute;
    top: calc(12px + var(--safe-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: min(460px, calc(100% - 24px));
    max-height: calc(100% - 24px);
  }
  .splash-access {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
  }
  .splash-access-lbl {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--maiz, #E3B23C);
  }
  .splash-sr-offer {
    padding: 8px 16px;
    min-height: 44px;
    background: var(--papel, #F1ECDD);
    color: oklch(0.28 0.05 60);
    border: 1px solid var(--maiz, #E3B23C);
    border-radius: 6px;
    font-family: var(--mono);
    font-size: calc(12px * var(--text-scale));
    letter-spacing: 0.04em;
    cursor: pointer;
    opacity: 0.92;
  }
  .splash-sr-offer:hover, .splash-sr-offer:focus-visible { opacity: 1; }
  .splash-a11y-panel {
    width: 100%;
    max-height: 60vh;
    overflow-y: auto;
    background: var(--paper);
    color: var(--ink);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    padding: 14px 16px;
    box-shadow: 0 8px 30px oklch(0.15 0.03 60 / 0.4);
    text-align: left;
  }
  .splash-greca {
    position: absolute;
    inset: 0;
    opacity: 0.05;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56' width='56' height='56'><path d='M0 28 L8 28 L8 12 L24 12 L24 44 L40 44 L40 12 L56 12' fill='none' stroke='white' stroke-width='1.5'/></svg>");
  }
  .splash-glyph { animation: inkBloom 1s var(--ease-codex) both; }
  .splash-version { font-family: var(--mono); font-size: calc(11px * var(--text-scale)); letter-spacing: 0.18em; color: var(--maiz); margin-top: 22px; opacity: 0; transition: opacity 0.6s var(--ease-codex); text-transform: uppercase; }
  .splash-title { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(clamp(64px, 12vw, 96px) * var(--text-scale)); margin-top: 6px; opacity: 0; transform: translateY(20px); transition: all 0.8s var(--ease-codex); }
  .splash-tag { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(clamp(16px, 2.6vw, 22px) * var(--text-scale)); font-style: italic; color: var(--maiz); opacity: 0; margin-top: 4px; transition: opacity 0.8s var(--ease-codex) 0.2s; }
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
    font-size: calc(12px * var(--text-scale));
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
