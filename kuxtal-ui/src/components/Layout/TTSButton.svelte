<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  let speaking = $state(false);
  let utterance: SpeechSynthesisUtterance | null = null;

  export function speak(text: string): void {
    stop();
    if (!window.speechSynthesis) return;
    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    // Try to find a Spanish voice
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es'));
    if (esVoice) utterance.voice = esVoice;
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
    aria-label="Parar lectura"
    title="Parar lectura en voz alta"
  >
    <Glyph name="Mic" size={16} />
    <span class="tts-pulse"></span>
  </button>
{/if}

<style>
  .tts-btn {
    position: fixed;
    bottom: 90px;
    right: 16px;
    z-index: 14;
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
</style>
