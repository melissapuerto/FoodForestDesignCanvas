<script lang="ts">
  /**
   * The accessibility toggle list (screen-reader mode, large text, high
   * contrast, reduced motion, dyslexia font, tutorial) plus the replay-voice
   * control. Shared so the exact same controls appear in Settings AND on the
   * splash, letting users set things up correctly *before* onboarding.
   */
  import { prefs, setPref, type AccessibilityPrefs } from '../../lib/stores/prefs';
  import { announce } from '../../lib/stores/announce';
  import { t } from '../../lib/i18n/index.svelte';

  const TOGGLE_KEYS: Array<{ key: keyof AccessibilityPrefs; lk: string; dk: string }> = [
    { key: 'screenReaderHints', lk: 'a11y_screen_reader', dk: 'a11y_screen_reader_desc' },
    { key: 'largeText', lk: 'a11y_large_text', dk: 'a11y_large_text_desc' },
    { key: 'highContrast', lk: 'a11y_high_contrast', dk: 'a11y_high_contrast_desc' },
    { key: 'reducedMotion', lk: 'a11y_reduced_motion', dk: 'a11y_reduced_motion_desc' },
    { key: 'dyslexiaFont', lk: 'a11y_dyslexia_font', dk: 'a11y_dyslexia_font_desc' },
    { key: 'showTutorialOnStart', lk: 'a11y_tutorial', dk: 'a11y_tutorial_desc' },
    { key: 'loadingFacts', lk: 'a11y_loading_facts', dk: 'a11y_loading_facts_desc' },
    { key: 'loadingEnergyHint', lk: 'a11y_loading_energy', dk: 'a11y_loading_energy_desc' }
  ];
</script>

<div class="toggle-list">
  {#each TOGGLE_KEYS as tg}
    <label class="toggle-row">
      <div class="toggle-text">
        <b>{t(tg.lk as any)}</b>
        <span class="sub">{t(tg.dk as any)}</span>
      </div>
      <button
        type="button"
        class="switch"
        class:on={$prefs[tg.key]}
        role="switch"
        aria-checked={$prefs[tg.key]}
        aria-label={t(tg.lk as any)}
        onclick={() => { setPref(tg.key, !$prefs[tg.key]); if (tg.key === 'screenReaderHints' && $prefs[tg.key]) announce(t('a11y_welcome')); }}
      >
        <span class="knob"></span>
      </button>
    </label>
  {/each}
</div>
<div class="weave" style="margin: 12px 0;" aria-hidden="true"></div>
<div class="toggle-row" style="align-items: flex-start;">
  <div class="toggle-text">
    <b>{t('a11y_replay_guidance')}</b>
    <span class="sub">{t('a11y_replay_guidance_hint')}</span>
  </div>
  <button type="button" class="btn btn-sm" onclick={() => announce(t('a11y_welcome'))}>
    {t('a11y_replay_guidance')}
  </button>
</div>

<style>
  .toggle-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
  .toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px dashed var(--line); }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .toggle-text b { font-family: var(--serif); font-weight: 400; font-size: calc(16px * var(--text-scale)); color: var(--ink); }
  .switch {
    width: 44px; height: 24px; border-radius: 999px;
    background: var(--line-strong); border: none; position: relative; cursor: pointer; flex-shrink: 0; padding: 0;
  }
  .switch .knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--paper); box-shadow: 0 1px 2px oklch(0.2 0.04 60 / 0.3); transition: left 0.2s var(--ease-codex); }
  .switch.on { background: var(--ocre); }
  .switch.on .knob { left: 22px; }
  :global(.a11y-reduced-motion) .switch .knob { transition: none !important; }
</style>
