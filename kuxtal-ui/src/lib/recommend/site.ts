import { getSiteContext } from '../pfaf/siteContext';
import { loadPlan } from '../permaculture/realize';
import type { MoistureClass } from '../pfaf/pfafSchema';
import type { WaterAccess } from '../permaculture/types';
import type { EngineSite } from './types';

const WATER_TO_MOISTURE: Record<WaterAccess, MoistureClass> = {
  rio: 'high', pozo: 'medium', lluvia: 'medium', limitada: 'low', nada: 'low'
};

/**
 * Build the engine site profile: the canonical SiteContext enriched with the
 * wizard's water access (→ moisture) and soil. Microzone overrides are layered
 * on top per-point via applyMicrozone().
 */
export function getEngineSite(): EngineSite {
  const base = getSiteContext();
  const inputs = loadPlan()?.inputs ?? null;
  return {
    ...base,
    moisture: inputs?.waterAccess ? WATER_TO_MOISTURE[inputs.waterAccess] : null,
    soil: inputs?.soil || null,
    goals: inputs?.goals ?? [],
    sunExposure: inputs?.sunExposure ?? 'mixto',
    challenges: inputs?.challenges ?? [],
    budget: inputs?.budget ?? null
  };
}
