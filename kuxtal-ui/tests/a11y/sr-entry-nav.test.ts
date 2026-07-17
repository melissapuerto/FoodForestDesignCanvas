import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import { get } from 'svelte/store';

// Community pulls its data from the API on mount; stub it so the tab strip can
// be tested in isolation.
vi.mock('../../src/lib/api', () => ({
  apiFetch: vi.fn(async () => []),
  authUser: writable(null),
  authToken: writable(null),
  fetchMe: vi.fn(async () => null)
}));

import Splash from '../../src/components/Layout/Splash.svelte';
import Comunidad from '../../src/components/Comunidad/ComunidadPlaceholder.svelte';
import { prefs, setPref } from '../../src/lib/stores/prefs';
import { t } from '../../src/lib/i18n/index.svelte';

describe('Screen-reader-safe first run (no toggle needed first)', () => {
  beforeEach(() => setPref('screenReaderHints', false));

  it('offers screen-reader mode as a focusable control on the splash and enables it', async () => {
    const { getByText } = render(Splash, { props: { onEnter: vi.fn() } });
    const offer = getByText(t('splash_sr_offer'));
    expect(offer).toBeInTheDocument();
    await fireEvent.click(offer);
    expect(get(prefs).screenReaderHints).toBe(true);
  });
});

describe('Community tabs — arrow-key navigation between sections', () => {
  it('uses roving tabindex and moves section with ArrowRight', async () => {
    const { container } = render(Comunidad);
    await tick();

    const feed = container.querySelector('#comm-tab-feed') as HTMLElement;
    const foro = container.querySelector('#comm-tab-foro') as HTMLElement;
    expect(feed).toBeTruthy();
    // Only the selected tab is in the Tab order; the rest are reached by arrows.
    expect(feed.getAttribute('tabindex')).toBe('0');
    expect(foro.getAttribute('tabindex')).toBe('-1');

    await fireEvent.keyDown(feed, { key: 'ArrowRight' });
    await tick();

    expect(foro.getAttribute('aria-selected')).toBe('true');
    expect(foro.getAttribute('tabindex')).toBe('0');
    expect(feed.getAttribute('tabindex')).toBe('-1');
  });
});
