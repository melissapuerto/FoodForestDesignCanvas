import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Drawer from '../../src/components/Layout/Drawer.svelte';
import { expectNoA11yViolations } from '../setup';

describe('Drawer accessibility', () => {
  it('is a modal dialog named by its title', () => {
    const { container } = render(Drawer, { props: { open: true, title: 'Plantas', onClose: vi.fn() } });
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelId = dialog.getAttribute('aria-labelledby')!;
    expect(labelId).toBeTruthy();
    const heading = container.querySelector('#' + labelId);
    expect(heading?.textContent).toContain('Plantas');
  });

  it('gives every instance a unique title id (no duplicate ids in the DOM)', () => {
    const a = render(Drawer, { props: { open: true, title: 'A', onClose: vi.fn() } });
    const b = render(Drawer, { props: { open: true, title: 'B', onClose: vi.fn() } });
    const idA = a.container.querySelector('[role="dialog"]')!.getAttribute('aria-labelledby');
    const idB = b.container.querySelector('[role="dialog"]')!.getAttribute('aria-labelledby');
    expect(idA).not.toBe(idB);
  });

  it('is inert + aria-hidden (removed from tab order + a11y tree) when closed', () => {
    const { container } = render(Drawer, { props: { open: false, title: 'X', onClose: vi.fn() } });
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    // Svelte may set `inert` as a DOM property rather than a reflected attribute.
    expect((dialog as any).inert === true || dialog.hasAttribute('inert')).toBe(true);
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no axe violations when open', async () => {
    const { container } = render(Drawer, { props: { open: true, title: 'Plantas', onClose: vi.fn() } });
    await expectNoA11yViolations(container);
  });
});
