import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { ES } from '../../src/lib/i18n/es';
import { EN } from '../../src/lib/i18n/en';
import { announce, liveMessage } from '../../src/lib/stores/announce';

// Every panel a blind tester can open, and every onboarding step, must have
// natural-language spoken guidance in both locales — and no robotic "1 / 5" or
// "×2" phrasing reaches the screen reader.

const MODULE_IDS = [
  'plantas', 'lienzo', 'animales', 'cuaderno', 'calendarios', 'heredado',
  'saberes', 'recursos', 'analisis', 'comunidad', 'protocolo', 'cosecha', 'ajustes'
];
const STEP_IDS = ['name', 'place', 'size', 'char', 'goals', 'challenges', 'reminder', 'preview', 'ready'];

describe('screen-reader narration coverage', () => {
  it('has a spoken orientation for every module panel, in both locales', () => {
    for (const id of MODULE_IDS) {
      const key = `intro_${id}` as keyof typeof ES;
      expect(ES[key], `es intro_${id}`).toBeTruthy();
      expect(EN[key], `en intro_${id}`).toBeTruthy();
      // Real guidance, not a stub.
      expect(ES[key].length).toBeGreaterThan(20);
      expect(EN[key].length).toBeGreaterThan(20);
    }
  });

  it('has spoken guidance for every onboarding step, in both locales', () => {
    for (const id of STEP_IDS) {
      const key = `wiz_help_${id}` as keyof typeof ES;
      expect(ES[key], `es wiz_help_${id}`).toBeTruthy();
      expect(EN[key], `en wiz_help_${id}`).toBeTruthy();
    }
  });

  it('uses natural progress phrasing, never "n / total"', () => {
    expect(ES.wiz_progress_natural).toBe('Paso {n} de {total}');
    expect(EN.wiz_progress_natural).toBe('Step {n} of {total}');
    expect(ES.wiz_progress_natural).not.toContain('/');
    expect(EN.wiz_progress_natural).not.toContain('/');
    // The tour counter is natural too.
    expect(ES.tour_progress).not.toContain(' / ');
    expect(EN.tour_progress).not.toContain(' / ');
  });

  it('reads counts as words, never the "×" symbol', () => {
    expect(ES.count_total).not.toContain('×');
    expect(EN.count_total).not.toContain('×');
    expect(ES.count_total).toContain('{n}');
  });

  it('first-run welcome and replay exist in both locales', () => {
    for (const key of ['a11y_welcome', 'a11y_replay_guidance'] as const) {
      expect(ES[key]).toBeTruthy();
      expect(EN[key]).toBeTruthy();
    }
    expect(ES.a11y_welcome.length).toBeGreaterThan(80); // a real orientation
  });

  it('announce() publishes the message on the live channel', () => {
    vi.useFakeTimers();
    try {
      announce('Estás en Plantas.');
      expect(get(liveMessage)).toBe(''); // cleared first so repeats re-announce
      vi.advanceTimersByTime(60);
      expect(get(liveMessage)).toBe('Estás en Plantas.');
    } finally {
      vi.useRealTimers();
    }
  });
});
