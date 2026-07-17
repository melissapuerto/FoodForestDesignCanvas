<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { t, getLocale } from '../../lib/i18n/index.svelte';

  let speaking = $state(false);
  let utterance: SpeechSynthesisUtterance | null = null;

  export function speak(text: string): void {
    stop();
    if (!window.speechSynthesis) return;
    utterance = new SpeechSynthesisUtterance(text);
    // Match the spoken language to the app locale so English content is not
    // read aloud with a Spanish voice (and vice versa).
    const loc = getLocale();
    const langPrefix = loc === 'en' ? 'en' : 'es';
    utterance.lang = loc === 'en' ? 'en-US' : 'es-MX';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang.startsWith(langPrefix));
    if (match) utterance.voice = match;
    utterance.onstart = () => (speaking = true);
    utterance.onend = () => (speaking = false);
    utterance.onerror = () => (speaking = false);
    window.speechSynthesis.speak(utterance);
  }

  export function stop(): void {
    window.speechSynthesis?.cancel();
    speaking = false;
    utterance = null;
  }

  function toggle(): void {
    if (speaking) stop();
  }
</script>

{#if speaking}
  <button
    type="button"
    class="tts-btn"
    onclick={toggle}
    aria-label={t('tts_stop_aria')}
    title={t('tts_stop_title')}
  >
    <Glyph name="Mic" size={16} />
    <span class="tts-pulse"></span>
  </button>
{/if}

<style>
  .tts-btn {
    position: fixed;
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 14px);
    right: calc(16px + var(--safe-right));
    z-index: var(--z-canvas-tip);
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: var(--jade);
    color: var(--paper);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 12px oklch(0.3 0.08 160 / 0.3);
    transition: transform 0.15s ease;
  }
  .tts-btn:hover { transform: scale(1.1); }
  .tts-pulse {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid var(--jade);
    animation: ttsPulse 1.2s ease-in-out infinite;
  }
  @keyframes ttsPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0; transform: scale(1.4); }
  }

  /* On phones the bottom edge is crowded (nav + tool rail). Dock the stop
     button just under the top bar instead so it never overlaps the tools. */
  @media (max-width: 760px) {
    .tts-btn {
      bottom: auto;
      top: calc(var(--topbar-h) + 10px);
      right: calc(8px + var(--safe-right));
    }
  }
</style>
