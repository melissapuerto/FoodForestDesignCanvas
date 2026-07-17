import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import Splash from '../../src/components/Layout/Splash.svelte';
import ModuleBar from '../../src/components/Layout/ModuleBar.svelte';
import LocationSearch from '../../src/components/Layout/LocationSearch.svelte';
import { navCollapsed } from '../../src/lib/stores/chrome';
import { setPref } from '../../src/lib/stores/prefs';
import { t } from '../../src/lib/i18n/index.svelte';

describe('First-run setup offers language and screen-reader mode', () => {
  beforeEach(() => setPref('screenReaderHints', false));

  it('shows a language control and a screen-reader-mode control on the splash', () => {
    const { getByText, getByLabelText } = render(Splash, { props: { onEnter: vi.fn() } });
    // Language toggle (LanguageToggle exposes a switch-language control).
    expect(getByLabelText(t('lang_switch_to'))).toBeInTheDocument();
    // Screen-reader-mode offer.
    expect(getByText(t('splash_sr_offer'))).toBeInTheDocument();
  });
});

describe('ModuleBar drops the collapse handle in screen-reader mode', () => {
  beforeEach(() => navCollapsed.set(false));

  it('hides the visual-only collapse handle when srMode is on', () => {
    const on = render(ModuleBar, { props: { active: null, onOpen: vi.fn(), srMode: true } });
    expect(on.container.querySelector('.nav-handle')).toBeNull();

    const off = render(ModuleBar, { props: { active: null, onOpen: vi.fn(), srMode: false } });
    expect(off.container.querySelector('.nav-handle')).not.toBeNull();
  });
});

describe('LocationSearch shows results automatically as you type', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn(async () => ({
      json: async () => [
        { lat: '6.2518', lon: '-75.5636', display_name: 'Medellín, Antioquia, Colombia' }
      ]
    }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('searches after typing (no button press) and lets you pick a result', async () => {
    const onSelect = vi.fn();
    const { getByLabelText, findByText } = render(LocationSearch, { props: { onSelect } });
    const input = getByLabelText(t('locsearch_label')) as HTMLInputElement;

    // Just type — results appear on their own (debounced).
    await fireEvent.input(input, { target: { value: 'Medellin' } });
    const result = await findByText('Medellín, Antioquia, Colombia', undefined, { timeout: 2000 });
    expect((globalThis as any).fetch).toHaveBeenCalled();

    await fireEvent.click(result);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].lat).toBeCloseTo(6.2518, 3);
  });
});
