import { describe, it, expect } from 'vitest';
import { dueCategories, DEFAULT_REMINDERS, anyEnabled, type RemindersConfig } from '../../src/lib/reminders/reminders';

const DAY = 86_400_000;
function cfg(over: Partial<RemindersConfig>): RemindersConfig {
  return { ...structuredClone(DEFAULT_REMINDERS), ...over };
}

describe('dueCategories', () => {
  const now = 1000 * DAY;

  it('returns nothing when all categories are off (default)', () => {
    expect(dueCategories(DEFAULT_REMINDERS, {}, now)).toEqual([]);
  });

  it('returns an enabled category never shown before', () => {
    const c = cfg({ watering: { enabled: true, everyDays: 3 } });
    expect(dueCategories(c, {}, now)).toEqual(['watering']);
  });

  it('respects the cadence', () => {
    const c = cfg({ watering: { enabled: true, everyDays: 3 } });
    expect(dueCategories(c, { watering: now - 2 * DAY }, now)).toEqual([]);
    expect(dueCategories(c, { watering: now - 3 * DAY }, now)).toEqual(['watering']);
  });

  it('handles several enabled categories', () => {
    const c = cfg({
      watering: { enabled: true, everyDays: 3 },
      harvest: { enabled: true, everyDays: 14 }
    });
    expect(dueCategories(c, { watering: now - 5 * DAY }, now).sort()).toEqual(['harvest', 'watering']);
  });
});

describe('anyEnabled', () => {
  it('is false by default and true once a category is opted in', () => {
    expect(anyEnabled(DEFAULT_REMINDERS)).toBe(false);
    expect(anyEnabled(cfg({ care: { enabled: true, everyDays: 7 } }))).toBe(true);
  });
});
