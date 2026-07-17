import { describe, it, expect } from 'vitest';
import { ES } from '../../src/lib/i18n/es';
import { EN } from '../../src/lib/i18n/en';

// Screen-reader names follow the active locale only if every key exists in both
// locales. The Record<Locale, Record<TranslationKey,string>> typing enforces
// this at compile time; this test guards it at runtime too and catches blanks.
describe('i18n locale parity', () => {
  it('en defines exactly the same keys as es', () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(ES).sort());
  });

  it('has no empty strings in either locale', () => {
    for (const [k, v] of Object.entries(ES)) expect(v, `es.${k}`).not.toBe('');
    for (const [k, v] of Object.entries(EN)) expect(v, `en.${k}`).not.toBe('');
  });

  it('keeps interpolation placeholders consistent between locales', () => {
    const ph = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort();
    for (const k of Object.keys(ES) as (keyof typeof ES)[]) {
      expect(ph(EN[k]), `placeholders for "${String(k)}"`).toEqual(ph(ES[k]));
    }
  });
});
