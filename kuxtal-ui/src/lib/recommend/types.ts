import type { SiteContext } from '../pfaf/siteContext';
import type { MoistureClass, PlantFunction, PlantLayer } from '../pfaf/pfafSchema';
import type { Goal, SunExposure } from '../permaculture/types';

/**
 * Site profile the engine scores against. Extends the canonical SiteContext
 * with optional environmental detail and the user's onboarding intent (goals,
 * site-wide sun). Microzone overrides are layered on per-point via applyMicrozone().
 */
export type EngineSite = SiteContext & {
  moisture?: MoistureClass | null;
  soil?: string | null;
  /** Microzone hard light gate (deep shade disqualifies full-sun plants). */
  sun?: 'full' | 'partial' | 'shade' | null;
  /** Microzone frost pocket — disqualifies frost-tender species. */
  frostRisk?: boolean;
  /** Onboarding intent — soft scoring bias. */
  goals?: Goal[];
  /** Onboarding site-wide sun exposure — soft scoring bias. */
  sunExposure?: SunExposure;
  /** User-stated site challenges (erosion, sequia, suelo-pobre, etc.). */
  challenges?: string[];
  /** Budget tier: ninguno | bajo | medio | alto */
  budget?: string | null;
};

export type PlacedPlant = {
  speciesId: string;
  /** Lowercased scientific name — bridges the pfaf-* and registry id namespaces for rule matching. */
  sci: string | null;
  lat: number;
  lng: number;
  layer: PlantLayer | null;
  fns: PlantFunction[];
};

export type CanvasState = {
  placed: PlacedPlant[];
  layerCounts: Record<string, number>;
  functionCounts: Record<string, number>;
  /** When set, companion/conflict bonuses only consider neighbors near this point. */
  candidatePoint?: { lat: number; lng: number } | null;
};

/** Companion / antagonist relationships indexed by lowercased scientific name. */
export type RuleIndex = {
  companions: Map<string, Set<string>>;
  antagonists: Map<string, Set<string>>;
};

export const EMPTY_RULE_INDEX: RuleIndex = { companions: new Map(), antagonists: new Map() };

export type ScoreBreakdown = {
  total: number;
  climateFit: number;
  moistureFit: number;
  soilFit: number;
  goalFit: number;
  sunFit: number;
  layerGap: number;
  functionGap: number;
  companion: number;
  conflict: number;
  invasive: number;
  challengeFit: number;
  budgetFit: number;
  eligible: boolean;
  reasons: string[];
};
