import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import LoadingFacts from '../../src/components/Layout/LoadingFacts.svelte';
import { prefs, DEFAULT_PREFS } from '../../src/lib/stores/prefs';
import { expectNoA11yViolations } from '../setup';

afterEach(() => {
  cleanup();
  prefs.set({ ...DEFAULT_PREFS });
});

describe('LoadingFacts', () => {
  it('shows a polite loading status and an attributed fact by default', () => {
    prefs.set({ ...DEFAULT_PREFS });
    const { container } = render(LoadingFacts, { props: { moduleKey: 'boot' } });
    const status = container.querySelector('[role="status"]')!;
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(container.querySelector('.lf-fact')?.textContent?.length).toBeGreaterThan(0);
    // Attribution is always shown (R10).
    expect(container.querySelector('.lf-src')?.textContent?.length).toBeGreaterThan(0);
  });

  it('keeps the energy/data seam OFF unless the user opts in', () => {
    prefs.set({ ...DEFAULT_PREFS, loadingEnergyHint: false });
    const { container } = render(LoadingFacts, { props: { moduleKey: 'boot' } });
    expect(container.textContent).not.toContain('≈');
  });

  it('exposes the estimated energy when the seam is enabled', () => {
    prefs.set({ ...DEFAULT_PREFS, loadingEnergyHint: true });
    const { container } = render(LoadingFacts, { props: { moduleKey: 'boot' } });
    expect(container.textContent).toContain('≈');
  });

  it('stops the spinner animation under reduced motion', () => {
    prefs.set({ ...DEFAULT_PREFS, reducedMotion: true });
    const { container } = render(LoadingFacts, { props: { moduleKey: 'boot' } });
    expect(container.querySelector('.lf-spinner.still')).toBeTruthy();
  });

  it('renders a stable placeholder (no fact) when turned off', () => {
    prefs.set({ ...DEFAULT_PREFS, loadingFacts: false });
    const { container } = render(LoadingFacts, { props: { moduleKey: 'boot' } });
    expect(container.querySelector('.lf-fact')).toBeNull();
    expect(container.querySelector('.lf-fill')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    prefs.set({ ...DEFAULT_PREFS, loadingEnergyHint: true });
    const { container } = render(LoadingFacts, { props: { moduleKey: 'boot' } });
    await expectNoA11yViolations(container);
  });
});
