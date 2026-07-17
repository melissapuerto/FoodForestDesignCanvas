import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ModuleBar from '../../src/components/Layout/ModuleBar.svelte';
import { navCollapsed } from '../../src/lib/stores/chrome';
import { expectNoA11yViolations } from '../setup';

describe('ModuleBar collapse handle', () => {
  beforeEach(() => navCollapsed.set(false));

  it('starts expanded with a handle that controls the nav', () => {
    const { container } = render(ModuleBar, { props: { active: null, onOpen: vi.fn() } });
    const handle = container.querySelector('.nav-handle')!;
    expect(handle).toHaveAttribute('aria-controls', 'module-nav');
    expect(handle).toHaveAttribute('aria-expanded', 'true');
    const nav = container.querySelector('#module-nav') as HTMLElement;
    expect((nav as any).inert === true || nav.hasAttribute('inert')).toBe(false);
  });

  it('collapses the nav (inert + aria-expanded=false) when toggled', async () => {
    const { container } = render(ModuleBar, { props: { active: null, onOpen: vi.fn() } });
    const handle = container.querySelector('.nav-handle') as HTMLElement;
    await fireEvent.click(handle);
    expect(handle).toHaveAttribute('aria-expanded', 'false');
    const nav = container.querySelector('#module-nav') as HTMLElement;
    expect((nav as any).inert === true || nav.hasAttribute('inert')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(ModuleBar, { props: { active: null, onOpen: vi.fn() } });
    await expectNoA11yViolations(container);
  });
});
