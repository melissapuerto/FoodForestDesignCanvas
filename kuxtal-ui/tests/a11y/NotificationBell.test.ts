import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import NotificationBell from '../../src/components/Layout/NotificationBell.svelte';
import { expectNoA11yViolations } from '../setup';

describe('NotificationBell accessibility', () => {
  it('starts collapsed with a popup affordance', () => {
    const { container } = render(NotificationBell);
    const bell = container.querySelector('.bell-btn')!;
    expect(bell).toHaveAttribute('aria-haspopup');
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('.dropdown')).toBeNull();
  });

  it('reflects state in aria-expanded when toggled', async () => {
    const { container } = render(NotificationBell);
    const bell = container.querySelector('.bell-btn') as HTMLElement;
    await fireEvent.click(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.dropdown')).not.toBeNull();
  });

  it('closes on Escape', async () => {
    const { container } = render(NotificationBell);
    const bell = container.querySelector('.bell-btn') as HTMLElement;
    await fireEvent.click(bell);
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  it('has no axe violations with the panel open', async () => {
    const { container } = render(NotificationBell);
    await fireEvent.click(container.querySelector('.bell-btn') as HTMLElement);
    await expectNoA11yViolations(container);
  });
});
